// Stamped into every build by vite.config.ts (implementation-plan.md §6).
// Only the UI reads these; src/rules stays build-agnostic (tsconfig.rules.json doesn't include this file).
declare const __BUILD_SHA__: string;
declare const __BUILD_CHANNEL__: 'main' | 'dev' | 'local';
