// The public API of the pure rules module and all its shared types: src/ui and sim/
// import only from here. It's empty until M1 (implementation-plan.md §4).
//
// Pure means no DOM, no Preact, no Math.random, no Date, and imports only from
// src/rules and src/content. tsconfig.rules.json and purity.test.ts enforce it.
export {};
