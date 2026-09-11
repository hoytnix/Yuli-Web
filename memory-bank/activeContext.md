# Active Context: @yuli-ai/web

## Current Status
- Package version: `0.4.0` (Loading Interstitial & Cache Detection API)
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
  - OPFS snapshot persistence & model caching manager (`src/storage/opfs.ts`)
  - Model load/cache detection API for games (`isModelCached`, `hasCachedModel`, `isLoaded`, `isReady` on `YuliClient`)
  - Demo setup interstitial overlay with live download progress tracking
  - Wllama V3 pathConfig invariant resolution (`default` asset path pointing to `esm/wasm/wllama.wasm`, fallback defense in worker, and dual stream/onData token handling)
  - Inference Telemetry & Raw Output Debug Log (`TelemetryStats`, `InferenceTelemetry`, TPS, TTFT, latency, token count, clipboard copy, and raw stream inspector in `demo/` and `YuliClient`)

## Active Integrations & Exports
- Package root exports: `dist/index` and `dist/worker` with dual ESM, CJS, and `.d.ts` declaration maps (including `TelemetryStats` & `InferenceTelemetry`).
- Official Hugging Face repo: `https://huggingface.co/economyofdreams/Yuli-Qwen2.5-0.5B-Reddit-v0.1.0` (GGUF `Yuli-Qwen2.5-0.5B-Reddit-v0.1.0-Q4_K_M.gguf`).
- Test suite: 44/44 tests passing across 9 suites via `pnpm test`.
- Deliberation Tag Firewall invariant: `CCDStreamParser` buffers partial closing tags (`</thought>`) across token chunk boundaries, strips orphan closing tags at stream head, and intercepts unclosed thought blocks terminated by stray `</thought>` delimiters while preserving earlier `<state_vector>` coordinates. Updated `parseModelResponse` in `src/dialogue/pipeline.ts` with robust last-delimiter partitioning (`lastIndexOf('</thought>')`) and generic XML stripping, ensuring real-world model anomalies (e.g. empty leading `<thought>\n</thought>`, rogue tags like `<toss>`, and unclosed deliberation traces) are cleanly isolated into the deliberation drawer while leaving the dialogue bubble pristine.
- GBNF grammar parser invariant: All rules in `src/grammar/gbnf.ts` and `src/fsm/action-grammar.ts` are explicitly joined by newlines (`.join('\n')`) via `getYuliGrammar()` and use kebab-case hyphenated non-terminals (`thought-block`, `state-block`, `hex-pair`, etc.) because llama.cpp's `parse_name` rejects underscores (`_`) in rule identifiers. Legacy snake_case is accessible via `getYuliGrammar(false)`.
- Demo app configured with Vite in `demo/` with live telemetry stats, post-completion raw response sanitization, and clipboard copy buttons for each prompt.
