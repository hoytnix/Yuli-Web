# Progress Tracking: @yuli-ai/web

## Current Progress
- [x] Initial package structure and manifest configured (`0.1.0`).
- [x] Memory Bank initialized per architectural mandate.
- [x] Repository hygiene: create sane `.gitignore`.
- [x] RFC-0002 implementation (`0.2.0`):
  - [x] Zero-Copy Token Ring Buffer (`SharedArrayBuffer` lock-free circular buffer).
  - [x] Native GBNF grammar constraints for WASM sampler (`YULI_STRICT_GBNF`).
  - [x] KV-Cache & timeline state snapshots (`YULI_SNAP_V1`, OPFS persistence).
  - [x] Continuous 4D hypercube vector blending & delta token FSM (`[-1, 1]^4`).
- [x] Build and test verification with `pnpm test` (14/14 tests passing) and `pnpm build`.
- [x] Tooling hygiene: Standardize strictly on `pnpm`.

## Known Constraints & Edge Cases
- Node 24 worker thread crash when `tsup` uses internal `dts: true` (mitigated by `tsc --emitDeclarationOnly`).
- Cross-origin isolation requirements for `SharedArrayBuffer` in multi-threaded WASM and zero-copy ring buffers (graceful fallback to `postMessage` implemented).
- OPFS support validation across browsers (Safari, Firefox, Chromium).
- Browser main window thread prohibition of `Atomics.wait` (mitigated by non-blocking atomic polling loop).
