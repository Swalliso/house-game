/*
  Vendored from zzfx@1.4.0 (https://github.com/KilledByAPixel/ZzFX), ZzFX.js.
  Only ZZFX.buildSamples is kept, typed for TypeScript, and given the sample rate
  as an argument. The npm package creates an AudioContext when it is imported;
  this file has no module-level side effects. Playback lives in ./audio.ts.

  ZzFX - Zuper Zmall Zound Zynth v1.4.0 by Frank Force

  ZzFX MIT License

  Copyright (c) 2019 - Frank Force

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

/**
 * ZzFX's 21 parameters, in ZzFX's order, so sounds can be pasted to and from the
 * ZzFX designer (https://killedbyapixel.github.io/ZzFX/). A hole or undefined
 * takes ZzFX's default.
 */
export type ZzfxParams = readonly [
  volume?: number, // 1
  randomness?: number, // .05: random frequency spread, from Math.random
  frequency?: number, // 220 Hz
  attack?: number, // 0 s
  sustain?: number, // 0 s
  release?: number, // .1 s
  shape?: number, // 0: 0 sin, 1 triangle, 2 saw, 3 tan, 4 noise, 5 square
  shapeCurve?: number, // 1 (the square duty cycle for shape 5)
  slide?: number, // 0
  deltaSlide?: number, // 0
  pitchJump?: number, // 0 Hz
  pitchJumpTime?: number, // 0 s
  repeatTime?: number, // 0 s
  noise?: number, // 0
  modulation?: number, // 0 Hz
  bitCrush?: number, // 0
  delay?: number, // 0 s
  sustainVolume?: number, // 1
  decay?: number, // 0 s
  tremolo?: number, // 0
  filter?: number, // 0: cutoff in Hz, positive for high-pass, negative for low-pass
];

/** Builds one channel of samples for a ZzFX sound at the given sample rate. */
export function buildSamples(sampleRate: number, params: ZzfxParams): Float32Array {
  let [
    volume = 1,
    randomness = 0.05,
    frequency = 220,
    attack = 0,
    sustain = 0,
    release = 0.1,
    shape = 0,
    shapeCurve = 1,
    slide = 0,
    deltaSlide = 0,
    pitchJump = 0,
    pitchJumpTime = 0,
    repeatTime = 0,
    noise = 0,
    modulation = 0,
    bitCrush = 0,
    delay = 0,
    sustainVolume = 1,
    decay = 0,
    tremolo = 0,
    filter = 0,
  ] = params;

  // init parameters
  const PI2 = Math.PI * 2;
  const abs = Math.abs;
  const sign = (v: number): number => (v < 0 ? -1 : 1);
  slide *= (500 * PI2) / sampleRate / sampleRate;
  const startSlide = slide;
  frequency *= ((1 + randomness * 2 * Math.random() - randomness) * PI2) / sampleRate;
  let startFrequency = frequency;
  let modOffset = 0; // modulation offset
  let repeat = 0; // repeat offset
  let crush = 0; // bit crush offset
  let jump = 1; // pitch jump timer
  let t = 0; // sample time
  let i = 0; // sample index
  let s = 0; // sample value
  let f: number; // wave frequency

  // biquad LP/HP filter
  const quality = 2;
  const w = (PI2 * abs(filter) * 2) / sampleRate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / 2 / quality;
  const a0 = 1 + alpha;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  const b0 = (1 + sign(filter) * cos) / 2 / a0;
  const b1 = -(sign(filter) + cos) / a0;
  const b2 = b0;
  let x2 = 0;
  let x1 = 0;
  let y2 = 0;
  let y1 = 0;

  // scale by sample rate
  const minAttack = 9; // prevent pop if attack is 0
  attack = attack * sampleRate || minAttack;
  decay *= sampleRate;
  sustain *= sampleRate;
  release *= sampleRate;
  delay *= sampleRate;
  deltaSlide *= (500 * PI2) / sampleRate ** 3;
  modulation *= PI2 / sampleRate;
  pitchJump *= PI2 / sampleRate;
  pitchJumpTime *= sampleRate;
  repeatTime = (repeatTime * sampleRate) | 0;

  // allocate the full sample buffer up front, much faster than growing an array
  const length = (attack + decay + sustain + release + delay) | 0;
  const b = new Float32Array(length > 0 ? length : 0);

  // generate waveform
  for (; i < length; b[i++] = s * volume) {
    // bit crush (x % 0 is NaN, so no bit crush updates every sample)
    if (!(++crush % ((bitCrush * 100) | 0))) {
      s = wave(shape, shapeCurve, t, PI2);

      s =
        (repeatTime
          ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) // tremolo
          : 1) *
        (shape > 4 ? s : sign(s) * abs(s) ** shapeCurve) * // shape curve
        (i < attack
          ? i / attack // attack
          : i < attack + decay
            ? 1 - ((i - attack) / decay) * (1 - sustainVolume) // decay falloff
            : i < attack + decay + sustain
              ? sustainVolume // sustain volume
              : i < length - delay
                ? ((length - i - delay) / release) * sustainVolume // release falloff
                : 0); // post release

      s = delay
        ? s / 2 +
          (delay > i
            ? 0 // delay
            : ((i < length - delay ? 1 : (length - i) / delay) * // release delay
                b[(i - delay) | 0]!) / // sample delay
              2 /
              volume)
        : s;

      if (filter) {
        // apply filter
        const y = b2 * x2 + b1 * x1 + b0 * s - a2 * y2 - a1 * y1;
        x2 = x1;
        x1 = s;
        y2 = y1;
        y1 = y;
        s = y;
      }
    }

    slide += deltaSlide;
    frequency += slide;
    f = frequency * Math.cos(modulation * modOffset++); // modulation
    t += f + f * noise * (((i * i * PI2) % 2) - 1); // noise

    if (jump && ++jump > pitchJumpTime) {
      // pitch jump
      frequency += pitchJump; // apply pitch jump
      startFrequency += pitchJump; // also apply to start
      jump = 0; // stop pitch jump time
    }

    if (repeatTime && !(++repeat % repeatTime)) {
      // repeat
      frequency = startFrequency; // reset frequency
      slide = startSlide; // reset slide
      jump ||= 1; // reset pitch jump time
    }
  }

  return b; // return sample buffer
}

/** One sample of ZzFX's wave shapes at phase t. */
function wave(shape: number, shapeCurve: number, t: number, PI2: number): number {
  if (!shape) return Math.sin(t); // 0 sin
  if (!(shape > 1)) return 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2); // 1 triangle
  if (!(shape > 2)) return 1 - (((((2 * t) / PI2) % 2) + 2) % 2); // 2 saw
  if (!(shape > 3)) return Math.max(Math.min(Math.tan(t), 1), -1); // 3 tan
  if (!(shape > 4)) return Math.sin(t ** 3); // 4 noise
  return (t / PI2) % 1 < shapeCurve / 2 ? 1 : -1; // 5 square duty
}
