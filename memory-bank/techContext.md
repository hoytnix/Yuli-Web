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
- Commercial License for entities grossing >=$30,000 USD: $1,500 per year per Title.
- Enterprise support with a Service Level Agreement (SLA) available upon request.
- Automatically transitions to Apache 2.0 on September 1st, 2030.
