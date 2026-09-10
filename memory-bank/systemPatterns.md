# System Patterns: @yuli-ai/web

## Architectural Patterns & Invariants

### 1. Web Worker Isolation (Zero Main-Thread UI Contention)
- Neural network inference and heavy computation reside strictly inside `src/worker.ts`.
- The main game thread interacts with the engine exclusively via message passing (`WorkerRPC`), ensuring steady 60/120 FPS rendering.

### 2. OPFS Model Storage (Persistent Zero-Heap Model Storage)
- Model weights (~380MB GGUF binaries) are streamed via HTTP chunking directly into Origin Private File System (`OPFSStorageManager`).
- Models mount directly from OPFS without deserializing large binary buffers into volatile JavaScript heap arrays.
- Cached cold boot takes under 250ms.

### 3. Deliberation Firewall & Pushdown Automaton FSM
- Raw model outputs contain internal reasoning tokens wrapped in `<thought>...</thought>` and state updates `<state_vector><s:XX></state_vector>`.
- `CCDStreamParser` implements an inline pushdown automaton (PDA) to isolate thought buffers and state transitions.
- Internal deliberation tokens NEVER bleed into client dialogue streams.

### 4. 4-Sides-of-the-Mind Hypercube Geometry ($F_2^4$)
- 16 state coordinates (`<s:00>` through `<s:0F>`) organized in 4 quadrants with Hamming distance 1 adjacency:
  - `0EE` -> `0x00`–`0x03`: Ego (ENFP / curiosity / foodie hype)
  - `1E6` -> `0x04`–`0x07`: Shadow (INFJ / critical correction / debt realism)
  - `2E7` -> `0x08`–`0x0B`: Subconscious (ISTJ / pragmatic execution / recipe ROI)
  - `3E1` -> `0x0C`–`0x0F`: Superego (ESTP / hard boundaries / austerity rules)

### 5. Hardware Fallback Cascade
- Automatic runtime initialization hierarchy:
  1. WebGPU Compute Shaders (70–110 TPS)
  2. Multi-Threaded WASM + 128-bit SIMD via SharedArrayBuffer (20–35 TPS)
  3. Single-Threaded WASM SIMD (graceful degraded fallback)
