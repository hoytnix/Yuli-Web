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
- `CCDStreamParser` implements an inline pushdown automaton (PDA) to isolate thought buffers, delta tokens (`<d:X+>`, `<d:X->`), and state transitions.
- Internal deliberation tokens NEVER bleed into client dialogue streams.

### 4. 4-Sides-of-the-Mind Hypercube Geometry ($F_2^4$) & Continuous $[-1, 1]^4$ Blending
- 16 state coordinates (`<s:00>` through `<s:0F>`) organized in 4 quadrants with Hamming distance 1 adjacency:
  - `0EE` -> `0x00`–`0x03`: Ego (ENFP / curiosity / foodie hype)
  - `1E6` -> `0x04`–`0x07`: Shadow (INFJ / critical correction / debt realism)
  - `2E7` -> `0x08`–`0x0B`: Subconscious (ISTJ / pragmatic execution / recipe ROI)
  - `3E1` -> `0x0C`–`0x0F`: Superego (ESTP / hard boundaries / austerity rules)
- Continuous coordinates $\mathbf{v} = (v_3, v_2, v_1, v_0) \in [-1, 1]^4$ with real-time EMA vector interpolation (`blendVectors`) and delta token streaming.

### 5. Zero-Copy Token Ring Buffer (SharedArrayBuffer)
- Lock-free circular ring buffer (`TokenRingBufferWriter` and `TokenRingBufferReader`) eliminates JSON postMessage serialization overhead during 70+ TPS bursts.
- Main thread consumes via non-blocking atomic polling, avoiding W3C `Atomics.wait` window thread restrictions.
- Automatic fallback to `postMessage` if `SharedArrayBuffer` is unsupported.

### 6. Grammar-Constrained Decoding (GBNF Sampling)
- Native GBNF grammar masks passed into WASM sampler via `createCompletion({ grammar: ... })`.
- 100% syntactic compliance for dialectical deliberation, hypercube vectors, and dialogue without regex fallback parsing.

### 7. KV-Cache & State Snapshot Checkpointing
- Binary serialization format (`YULI_SNAP_V1`) captures conversation history, discrete state vectors, and continuous 4D hypercube coordinates.
- Supports in-memory `ArrayBuffer` checkpoints and persistent OPFS snapshots (`saveSnapshotToOPFS`/`loadSnapshotFromOPFS`) for sub-5ms CYOA narrative timeline branching.

### 8. Hardware Fallback Cascade
- Automatic runtime initialization hierarchy:
  1. WebGPU Compute Shaders (70–110 TPS)
  2. Multi-Threaded WASM + 128-bit SIMD via SharedArrayBuffer (20–35 TPS)
  3. Single-Threaded WASM SIMD (graceful degraded fallback)
