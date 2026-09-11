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
- [x] RFC-0003 implementation (`0.3.0`):
  - [x] Agnostic Character FSM (7 states, telemetry injection, auto-rollback on error).
  - [x] Dynamic Action GBNF compiler for custom generic intents (`TCustomIntents`).
  - [x] Real-time typewriter buffer with punctuation audio triggers and instant skip.
  - [x] Cohesive dialogue pipeline connecting parser, typewriter, and tag sanitizer.
- [x] Version `0.4.0` release:
  - [x] Model load & OPFS caching state detection API (`YuliClient.isModelCached`, `isLoaded`, `isReady`, `clearCachedModel`).
  - [x] Official Hugging Face repo configuration (`economyofdreams/Yuli-Qwen2.5-0.5B-Reddit-v0.1.0`).
  - [x] Demo loading interstitial overlay with dynamic OPFS download progress bar.
  - [x] Fix Wllama V3 pathConfig error (`"default"` asset path key required in `AssetsPathConfig` and modern `esm/wasm/wllama.wasm` CDN endpoint).
- [x] Build and test verification with `pnpm test` (38/38 tests passing across 9 suites) and `pnpm build`.
- [x] Fix GBNF grammar parser error by implementing `getYuliGrammar()` builder explicitly joining rules with newlines and supporting hyphenated non-terminals.
- [x] Fix deliberation tag bleeding bug: prevent partial `</thought>` chunk splitting, strip orphan tags in `CCDStreamParser`, and provide `parseModelResponse()` utility.
- [x] Tooling hygiene: Standardize strictly on `pnpm`.
- [x] Security & deployment hygiene: Enforce strict gate against publishing to npmjs without user confirmation.

## Known Constraints & Edge Cases
- Node 24 worker thread crash when `tsup` uses internal `dts: true` (mitigated by `tsc --emitDeclarationOnly`).
- Cross-origin isolation requirements for `SharedArrayBuffer` in multi-threaded WASM and zero-copy ring buffers (graceful fallback to `postMessage` implemented).
- OPFS support validation across browsers (Safari, Firefox, Chromium).
- Browser main window thread prohibition of `Atomics.wait` (mitigated by non-blocking atomic polling loop).
