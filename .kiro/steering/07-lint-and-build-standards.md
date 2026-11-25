---
inclusion: always
---

# Steering 07 — Zero-Warning Lint, Strict TypeScript & Build Standards

## Quality Gate Mandate
Every change to StitchCut must pass all four verification gates cleanly before commit:
1. `npm test` — All Vitest suites (`tests/silenceDetector.test.ts`, `tests/planner.pbt.test.ts`, `tests/hardening.test.ts` — 33/33 tests).
2. `npm run lint` — `oxlint` with **0 warnings and 0 errors** (`.oxlintrc.json` ignores only build outputs `dist/**`, `mcp-server/dist/**`, and vendored `public/ffmpeg/**`).
3. `npm run build` — `tsc -b && vite build` with zero TypeScript project-reference diagnostics and clean production bundle generation.
4. `(cd mcp-server && npm run build && npm test)` — Clean `tsc` compilation to `mcp-server/dist/index.js` and 6/6 `node:test` suites passing.

## Coding Conventions
- Use `import type { ... }` for type-only imports (`verbatimModuleSyntax` compatibility).
- Avoid `any`; use narrow interfaces from `src/types.ts` (`SilenceConfig`, `AudioSegment`, `CutPlan`, `ForgeProgress`) or explicit type guards.
- Keep `.kiro/` tracked in Git at all times — never add `.kiro` to `.gitignore`.
