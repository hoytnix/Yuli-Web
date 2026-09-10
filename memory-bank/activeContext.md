# Active Context: @yuli-ai/web

## Current Status
- Package version: `0.2.0` (RFC-0002 implementation complete)
- Standardized package manager: `pnpm` (configured in `GEMINI.md` and `techContext.md`)
- Deployment policy: Strict prohibition on publishing to npmjs without explicit prior user instruction.
- Subsystems implemented:
  - Zero-Copy Token Ring Buffer (`src/ringbuffer/`)
  - Grammar-Constrained Decoding (`src/grammar/`)
  - KV-Cache & Timeline State Snapshot Manager (`src/snapshot/`)
  - Continuous Hypercube 4D Vector Blending & Delta Token FSM (`src/vector/` & `src/parser/ccd.ts`)
  - OPFS snapshot save/load persistence (`src/storage/opfs.ts`)

## Active Integrations & Exports
- Package root exports: `dist/index` and `dist/worker` with dual ESM, CJS, and `.d.ts` declaration maps.
- Test suite: 14/14 tests passing across 4 suites via `pnpm test`.
- Demo app configured with Vite in `demo/`.
