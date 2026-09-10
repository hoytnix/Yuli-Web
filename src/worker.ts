import { Wllama } from '@wllama/wllama';
import { OPFSStorageManager } from './storage/opfs';
import { CCDStreamParser, StateVector } from './parser/ccd';

let wllamaInstance: any = null;
const storage = new OPFSStorageManager();

self.onmessage = async (e: MessageEvent) => {
  const data = e.data;

  if (data.type === 'INIT') {
    try {
      let modelBlob: Blob;
      const cached = await storage.hasCachedModel();

      if (cached) {
        self.postMessage({ type: 'STATUS', status: 'Loading model from OPFS cache...' });
        modelBlob = await storage.getModelBlob();
      } else {
        self.postMessage({ type: 'STATUS', status: 'Downloading model weights (~380MB)...' });
        modelBlob = await storage.downloadAndCache(data.modelUrl, (progress) => {
          self.postMessage({ type: 'DOWNLOAD_PROGRESS', ...progress });
        });
      }

      wllamaInstance = new Wllama(data.wasmPaths);

      const loadConfig = {
        n_ctx: 2048,
        n_threads: Math.max(1, (navigator.hardwareConcurrency || 4) - 1)
      };

      // Support loadModel([blob]) or loadModelFromUrl(blobUrl)
      if (typeof wllamaInstance.loadModel === 'function') {
        await wllamaInstance.loadModel([modelBlob], loadConfig);
      } else {
        const blobUrl = URL.createObjectURL(modelBlob);
        try {
          await wllamaInstance.loadModelFromUrl(blobUrl, loadConfig);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      }

      self.postMessage({ type: 'READY' });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }

  if (data.type === 'PROMPT') {
    if (!wllamaInstance) {
      self.postMessage({ type: 'ERROR', error: 'Model runtime not initialized' });
      return;
    }

    let resolvedState: StateVector = { hex: '00', quadrant: 'EGO', rawBits: 0 };
    let accumulatedDialogue = '';

    const parser = new CCDStreamParser({
      onToken: (token: string) => {
        accumulatedDialogue += token;
        self.postMessage({ type: 'TOKEN', token });
      },
      onState: (state: StateVector) => {
        resolvedState = state;
        self.postMessage({ type: 'STATE_CHANGE', state });
      },
      onThought: (thought: string) => {
        self.postMessage({ type: 'THOUGHT', thought });
      }
    });

    try {
      const completionConfig = {
        nPredict: data.maxTokens || 256,
        temp: data.temperature ?? 0.7,
        stop: ['<|im_end|>', '<|endoftext|>'],
        onNewToken: (_token: number, _piece: Uint8Array, currentText: string) => {
          parser.feed(currentText);
        }
      };

      if (wllamaInstance.createCompletion.length === 1) {
        await wllamaInstance.createCompletion({ prompt: data.prompt, ...completionConfig });
      } else {
        await wllamaInstance.createCompletion(data.prompt, completionConfig);
      }

      parser.flush();
      self.postMessage({
        type: 'COMPLETE',
        text: accumulatedDialogue.trim(),
        state: resolvedState
      });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
};
