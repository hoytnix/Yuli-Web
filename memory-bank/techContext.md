# Tech Context: @yuli-ai/web

## Technologies & Dependencies
- **Runtime / Language**: TypeScript (v5/7), Node 22/24+
- **Wasm ML Engine**: `@wllama/wllama`
- **Target Model**: `economyofdreams/Yuli-Qwen2.5-0.5B-Reddit-v0.1.0` (GGUF `Yuli-Qwen2.5-0.5B-Reddit-v0.1.0-Q4_K_M.gguf` ~380MB)
- **Hugging Face Repo**: `https://huggingface.co/economyofdreams/Yuli-Qwen2.5-0.5B-Reddit-v0.1.0`
- **Package Manager**: `pnpm`
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
