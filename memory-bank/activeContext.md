# Active Context: @yuli-ai/web

## Current Status
- Package version: `0.5.1`
- Standardized package manager: `pnpm` (configured in `GEMINI.md` and `techContext.md`)
- Deployment policy: Strict prohibition on publishing to npmjs without explicit prior user instruction.
- License configuration: BSL 1.1 converting to Apache 2.0 on September 1st, 2030. $1,500/yr per Title commercial license for entities grossing >=$30,000 USD. Enterprise support with SLA available upon request.
- Documentation: Comprehensive README.md overhaul matching Return architectural standard with interactive mermaid flowchart, architectural invariants, and quick start guides; typography polished (standard Unicode arrows `→` replacing LaTeX artifacts); Mermaid flowchart hardened for GitHub rendering by quoting labels with special characters and escaping `<`/`>` with HTML entities (`&lt;`/`&gt;`).
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
- Test suite: 51/51 tests passing across 10 suites via `pnpm test`.
- Deliberation Tag Firewall invariant: `CCDStreamParser` buffers partial closing tags (`</thought>`) across token chunk boundaries, strips orphan closing tags at stream head, and intercepts unclosed thought blocks terminated by stray `</thought>` delimiters while preserving earlier `<state_vector>` coordinates. Updated `parseModelResponse` in `src/dialogue/pipeline.ts` with robust last-delimiter partitioning (`lastIndexOf('</thought>')`) and generic XML stripping, ensuring real-world model anomalies (e.g. empty leading `<thought>\n</thought>`, rogue tags like `<toss>`, and unclosed deliberation traces) are cleanly isolated into the deliberation drawer while leaving the dialogue bubble pristine.
- GBNF grammar parser invariant: All rules in `src/grammar/gbnf.ts` and `src/fsm/action-grammar.ts` are explicitly joined by newlines (`.join('\n')`) via `getYuliGrammar()` and use kebab-case hyphenated non-terminals (`thought-block`, `state-block`, `hex-pair`, etc.) because llama.cpp's `parse_name` rejects underscores (`_`) in rule identifiers. Legacy snake_case is accessible via `getYuliGrammar(false)`.
- Architectural Audit Remediation (RFC-0003 hardened to 1000/1000):
  - Action Tag Resilient Parsing (`src/fsm/action-grammar.ts`): Replaced rigid regex with resilient XML block matching tolerant of whitespace, multiline variations, XML tag attributes, decimal numbers, and `<data>` or `<payload>` JSON bodies. Exported `ActionPayload` interface with `value` alongside backwards-compatible `modifierValue` alias.
  - Main-Thread Stutter Mitigation (`src/dialogue/pipeline.ts` & `src/parser/ccd.ts`): Integrated `requestAnimationFrame` and micro-tick (`setTimeout`) dialogue token buffering in `DialoguePipeline` prior to pumping `TypewriterBuffer`, preventing micro-task flooding during 90+ TPS bursts while ensuring immediate flushing on `complete()`, `skipTypewriter()`, and `reset()`. Augmented `CCDStreamParser` automaton to isolate `<action>` blocks and emit `onAction` events without dialogue pollution.
  - FSM Re-entrancy & Clicker Queue (`src/fsm/character-fsm.ts`): Added bounded input queue (default capacity: 2, configurable via `maxQueueSize`) to `YuliCharacterFSM`. Rapid inputs during `IDLE_COOLDOWN` (or active generation) buffer cleanly and automatically dequeue upon returning to `IDLE`.
- Demo app configured with Vite in `demo/` with live telemetry stats, post-completion raw response sanitization, and clipboard copy buttons for each prompt.
