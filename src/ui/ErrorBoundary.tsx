// The error boundary (implementation-plan.md §6): any exception in apply or rendering shows
// "Something broke" with the run code and a feedback link, so every crash becomes a bug report.
// The crash leaves the saved run as it was, so the first way out is a reload, which offers
// Continue on the title. Start a new run is there for a crash that comes straight back: it puts
// the saved run aside the way a link does (its code is kept, and the note can go back to it).

import { Component, type ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { BUILD_LABEL } from './build-info.ts';
import { crash, crashRunCode, newRunAfterCrash } from './store.ts';

const ISSUES = 'https://github.com/Swalliso/house-game/issues/new';

function safeRunCode(): string {
  try {
    return crashRunCode();
  } catch {
    return '(the run code could not be made)';
  }
}

/** A new GitHub issue, filled in with the build, the error (if any), and the run code. */
function reportLink(title: string, code: string, message?: string): string {
  const body = [
    '**What happened?**',
    '',
    '',
    '**What were you doing just before?**',
    '',
    '',
    `Build: \`${BUILD_LABEL}\``,
    ...(message === undefined ? [] : [`Error: \`${message}\``]),
    '',
    'Run code (open it with `?run=` to replay):',
    '```',
    code,
    '```',
  ].join('\n');
  return `${ISSUES}?${new URLSearchParams({ title, body })}`;
}

export function issueUrl(message: string, code: string): string {
  return reportLink(`Bug: ${message.slice(0, 80)}`, code, message);
}

/** The Menu's Report a bug: the same form, with this run's code and no error. */
export function bugReportUrl(code: string): string {
  return reportLink('Bug: ', code);
}

export function CrashScreen({ message }: { message: string }) {
  const code = safeRunCode();
  const box = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // The clipboard is off limits here: select the code so it can be copied by hand.
      box.current?.focus();
      box.current?.select();
    }
  };
  return (
    <div class="crash" role="alert">
      <div class="crash-card">
        <h1>Something broke.</h1>
        <p>Sorry! Copy the run code and send it along: it replays exactly what happened.</p>
        <textarea
          ref={box}
          readOnly
          value={code}
          rows={4}
          onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
        />
        <div class="crash-buttons">
          <button type="button" onClick={() => location.reload()}>
            Reload and continue
          </button>
          <button type="button" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy run code'}
          </button>
          <a class="button" href={issueUrl(message, code)} target="_blank" rel="noreferrer">
            Report it on GitHub
          </a>
          <button type="button" onClick={() => newRunAfterCrash()}>
            Start a new run
          </button>
        </div>
        <p>
          <small>Build: {BUILD_LABEL}</small>
        </p>
        <details>
          <summary>Details</summary>
          <pre>{message}</pre>
        </details>
      </div>
    </div>
  );
}

interface State {
  error: unknown;
}

export class ErrorBoundary extends Component<{ children: ComponentChildren }, State> {
  override state: State = { error: null };

  override componentDidCatch(error: unknown): void {
    console.error(error);
    // Anything can be thrown, not only Errors.
    const message = error instanceof Error ? error.message : String(error);
    crash.value = { message, stack: error instanceof Error ? error.stack : undefined };
    this.setState({ error: error ?? 'error' });
  }

  override render() {
    const c = crash.value;
    if (c) {
      return <CrashScreen message={c.message} key={c.message} />;
    }
    if (this.state.error) {
      // The crash was cleared (a new run): render the game again.
      queueMicrotask(() => this.setState({ error: null }));
      return null;
    }
    return this.props.children;
  }
}
