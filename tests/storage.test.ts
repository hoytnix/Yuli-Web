import { describe, it, expect } from 'vitest';
import {
  OPFSStorageManager,
  extractModelFileName,
  DEFAULT_MODEL_FILENAME,
  YuliClient,
  DEFAULT_WASM_PATH
} from '../src/index';

describe('OPFS Storage & Model Caching Verification', () => {
  it('extracts model file name from various URLs and paths', () => {
    const defaultUrl = 'https://huggingface.co/economyofdreams/Yuli-Qwen2.5-0.5B-Reddit-v0.1.0/resolve/main/Yuli-Qwen2.5-0.5B-Reddit-v0.1.0-Q4_K_M.gguf';
    expect(extractModelFileName(defaultUrl)).toBe('Yuli-Qwen2.5-0.5B-Reddit-v0.1.0-Q4_K_M.gguf');

    const withQuery = 'https://example.com/models/custom-model.gguf?download=true';
    expect(extractModelFileName(withQuery)).toBe('custom-model.gguf');

    const simplePath = 'local/path/to/my-model-q4_k_s.gguf';
    expect(extractModelFileName(simplePath)).toBe('my-model-q4_k_s.gguf');

    const emptyPath = '';
    expect(extractModelFileName(emptyPath)).toBe(DEFAULT_MODEL_FILENAME);
  });

  it('safely reports false when OPFS is unsupported in non-browser test environment', async () => {
    const storage = new OPFSStorageManager();
    const cached = await storage.hasCachedModel();
    expect(cached).toBe(false);

    const staticCached = await OPFSStorageManager.hasCachedModel();
    expect(staticCached).toBe(false);
  });

  it('YuliClient reports loaded/ready status correctly', () => {
    const client = new YuliClient();
    expect(client.isLoaded()).toBe(false);
    expect(client.isReady()).toBe(false);
  });

  it('YuliClient detects model caching via instance and static methods', async () => {
    const client = new YuliClient();
    const cachedInstance = await client.isModelCached();
    const hasCached = await client.hasCachedModel();
    expect(cachedInstance).toBe(false);
    expect(hasCached).toBe(false);

    const cachedStatic = await YuliClient.isModelCached();
    expect(cachedStatic).toBe(false);
  });

  it('provides valid DEFAULT_WASM_PATH targeting Wllama V3 pathConfig invariant', () => {
    expect(DEFAULT_WASM_PATH).toBeDefined();
    expect(DEFAULT_WASM_PATH).toContain('esm/wasm/wllama.wasm');
    expect(DEFAULT_WASM_PATH.startsWith('https://')).toBe(true);

    const client = new YuliClient({
      wasmPaths: {
        default: '/custom/wllama.wasm'
      }
    });
    expect(client).toBeDefined();
  });
});
