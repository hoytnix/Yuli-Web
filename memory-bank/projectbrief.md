# Project Brief: @yuli-ai/web

## Core Goals
- Ultra-low-latency, edge-optimized cognitive persona runtime for browser PWAs, WebGL titles, and Telegram Mini Apps.
- Zero marginal server cost: 100% client-side inference via WebGPU compute shaders and multi-threaded WASM SIMD.
- Sub-1GB edge budget: Run lightweight instruction-tuned models (e.g., Qwen2.5-0.5B-Instruct in Q4_K_M ~380MB or Q4_K_S ~350MB).
- Target Performance: 70–110 TPS on mobile/desktop WebGPU targets, 20–35 TPS on multi-threaded WASM SIMD.

## Target Audience & Platforms
- Browser PWAs, WebGL games (Three.js, Babylon.js, PixiJS, Unity WebGL), and Telegram Mini Apps.
- In-game dynamic NPC dialogue and procedural CYOA (Choose Your Own Adventure) branching.
