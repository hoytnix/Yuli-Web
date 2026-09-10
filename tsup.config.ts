import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    worker: 'src/worker.ts'
  },
  format: ['esm', 'cjs'],
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'es2022'
});
