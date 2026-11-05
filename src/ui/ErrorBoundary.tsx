// The error boundary (implementation-plan.md §6): any exception in apply or rendering shows
// "Something broke" with the run code and a feedback link, so every crash becomes a bug report.

import { Component, type ComponentChildren } from 'preact';
import { BUILD_LABEL } from './build-info.ts';
import { crash, newRun, runCode } from './store.ts';

const ISSUES = 'https://github.com/Swalliso/house-game/issues/new';

function safeRunCode(): string {
  try {
    return runCode();
  } catch {
    return '(the run code could not be made)';
  }
}

export function issueUrl(message: string, code: string): string {
  const body = [
    '**What happened?**',
    '',
    '',
    '**What were you doing just before?**',
    '',
    '',
    `Build: \`${BUILD_LABEL}\``,
    `Error: \`${message}\``,
    '',
    'Run code (open it with `?run=` to replay):',
    '```',
    code,
    '```',
  ].join('\n');
  return `${ISSUES}?${new URLSearchParams({ title: `Bug: ${message.slice(0, 80)}`, body })}`;
}

export function CrashScreen({ message }: { message: string }) {
  const code = safeRunCode();
  return (
    <div class="crash" role="alert">
      <div class="crash-card">
        <h1>Something broke.</h1>
        <p>Sorry! Copy the run code and send it along: it replays exactly what happened.</p>
        <textarea
          readOnly
          value={code}
          rows={4}
          onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
        />
        <div class="crash-buttons">
          <button type="button" onClick={() => void navigator.clipboard?.writeText(code)}>
            Copy run code
          </button>
          <a class="button" href={issueUrl(message, code)} target="_blank" rel="noreferrer">
            Report it on GitHub
          </a>
          <button
            type="button"
            onClick={() => {
              crash.value = null;
              newRun();
            }}
          >
            Start a new run
          </button>
        </div>
        <details>
          <summary>Details</summary>
          <pre>{message}</pre>
        </details>
      </div>
    </div>
  );
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ComponentChildren }, State> {
  override state: State = { error: null };

  override componentDidCatch(error: Error): void {
    console.error(error);
    crash.value = { message: error.message, stack: error.stack };
    this.setState({ error });
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
