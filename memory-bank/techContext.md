# Tech Context: @yuli-ai/web

## Technologies & Dependencies
- **Runtime / Language**: TypeScript (v5/7), Node 22/24+
- **Wasm ML Engine**: `@wllama/wllama`
- **Target Model**: `Qwen/Qwen2.5-0.5B-Instruct` (GGUF `Q4_K_M` ~380MB / `Q4_K_S` ~350MB)
- **Build Pipeline**: `tsup` (bundling JS/Worker) + `tsc --emitDeclarationOnly` (type declarations)
- **Test Runner**: `vitest`
- **Styling / Demo**: Tailwind CSS v4, Vite

## Distribution & Export Rules
- Dual-format ESM (`dist/index.mjs`) and CJS (`dist/index.js`).
- `package.json` export maps MUST declare `"types"` before `"import"` and `"require"` conditions.
- Zero `tsup` internal `dts: true` (Node 24 compatibility).

## Licensing
- Business Source License 1.1 (BSL 1.1).
- Free for non-commercial use and commercial entities generating <$30,000 USD gross annual revenue.
- Automatically transitions to Apache 2.0 four years post-release.
