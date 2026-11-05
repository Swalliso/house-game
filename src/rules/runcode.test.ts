import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { RunCodeData } from './index.ts';
import {
  base64urlDecode,
  base64urlEncode,
  contentHash,
  decodeRunCode,
  encodeRunCode,
} from './runcode.ts';
import { TEST_CONTENT as C, withPieces } from './testing.ts';

const data: RunCodeData = {
  build: 'abc1234',
  contentHash: contentHash(C),
  setup: { seed: 'Ünïcode 🏠 seed', mode: 'standard' },
  actions: [{ t: 'place', from: 'hand', i: 2, x: 11, y: 20, rot: 3 }, { t: 'pass' }],
};

describe('run codes', () => {
  it('round-trip, with an optional pending placement', () => {
    const code = encodeRunCode(data);
    expect(code.startsWith('OH1.')).toBe(true);
    expect(code).toMatch(/^OH1\.[A-Za-z0-9_-]+$/);
    expect(decodeRunCode(code)).toEqual({ ok: true, data });
    const pending = {
      ...data,
      pending: { t: 'place', from: 'hand', i: 0, x: 1, y: 2, rot: 1 },
    } as const;
    expect(decodeRunCode(encodeRunCode(pending))).toEqual({ ok: true, data: pending });
    // Whitespace from a paste is fine.
    expect(decodeRunCode(`  ${code}\n`)).toEqual({ ok: true, data });
  });

  it('report damaged or foreign codes instead of throwing', () => {
    expect(decodeRunCode('hello')).toMatchObject({ ok: false });
    expect(decodeRunCode('OH1.!!!!')).toMatchObject({ ok: false });
    expect(
      decodeRunCode('OH1.' + base64urlEncode([...'{"x":1}'].map((c) => c.charCodeAt(0)))),
    ).toMatchObject({ ok: false });
    const unknownAction = encodeRunCode({ ...data, actions: [{ t: 'dance' } as never] });
    expect(decodeRunCode(unknownAction)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/action/),
    });
    const badRot = encodeRunCode({
      ...data,
      actions: [{ t: 'place', from: 'hand', i: 0, x: 0, y: 0, rot: 5 } as never],
    });
    expect(decodeRunCode(badRot)).toMatchObject({ ok: false });
    expect(decodeRunCode(encodeRunCode(data).slice(0, -7))).toMatchObject({ ok: false });
  });

  it('drop unknown fields from actions', () => {
    const code = encodeRunCode({ ...data, actions: [{ t: 'pass', extra: 1 } as never] });
    expect(decodeRunCode(code)).toMatchObject({ ok: true, data: { actions: [{ t: 'pass' }] } });
  });

  it('hash the content, so a code from other content is spotted', () => {
    expect(contentHash(C)).toBe(contentHash({ ...C }));
    expect(contentHash(C)).toMatch(/^[0-9a-f]{8}$/);
    expect(contentHash(withPieces({ lawn: { drawWeight: 11 } }))).not.toBe(contentHash(C));
  });
});

describe('base64url', () => {
  it('round-trips any bytes (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 40 }), (bytes) => {
        expect(base64urlDecode(base64urlEncode(bytes))).toEqual(bytes);
      }),
    );
  });

  it('matches the standard encoding', () => {
    const bytes = [...'Many hands make light work.'].map((c) => c.charCodeAt(0));
    expect(base64urlEncode(bytes)).toBe('TWFueSBoYW5kcyBtYWtlIGxpZ2h0IHdvcmsu');
    expect(base64urlEncode([0xfb, 0xff])).toBe('-_8');
  });
});
