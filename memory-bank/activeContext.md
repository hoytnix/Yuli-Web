# Active Context: @yuli-ai/web

## Current Status
- Package version: `0.3.0` (RFC-0003 implementation complete)
- Standardized package manager: `pnpm` (configured in `GEMINI.md` and `techContext.md`)
- Deployment policy: Strict prohibition on publishing to npmjs without explicit prior user instruction.
- Subsystems implemented:
  - Universal Character FSM (`src/fsm/character-fsm.ts`)
  - Dynamic Action Grammar Compiler (`src/fsm/action-grammar.ts`)
  - Real-Time Typewriter Buffer (`src/dialogue/typewriter.ts`)
  - Real-Time Dialogue Pipeline (`src/dialogue/pipeline.ts`)
  - Zero-Copy Token Ring Buffer (`src/ringbuffer/`)
  - Grammar-Constrained Decoding (`src/grammar/`)
  - KV-Cache & Timeline State Snapshot Manager (`src/snapshot/`)
  - Continuous Hypercube 4D Vector Blending (`src/vector/` & `src/parser/ccd.ts`)
  - OPFS snapshot persistence (`src/storage/opfs.ts`)

## Active Integrations & Exports
- Package root exports: `dist/index` and `dist/worker` with dual ESM, CJS, and `.d.ts` declaration maps.
- Test suite: 25/25 tests passing across 7 suites via `pnpm test`.
- Demo app configured with Vite in `demo/`.
