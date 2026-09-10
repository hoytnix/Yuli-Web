import { Wllama } from '@wllama/wllama';
import { OPFSStorageManager } from './storage/opfs';
import { CCDStreamParser, StateVector } from './parser/ccd';
import { TokenRingBufferWriter, RingBufferStatus } from './ringbuffer/ring-buffer';
import { YULI_STRICT_GBNF } from './grammar/gbnf';
import { Vector4D } from './vector/hypercube';

let wllamaInstance: any = null;
const storage = new OPFSStorageManager();
let ringBufferWriter: TokenRingBufferWriter | null = null;

self.onmessage = async (e: MessageEvent) => {
  const data = e.data;

  if (data.type === 'INIT') {
    try {
      if (data.ringBuffer) {
        ringBufferWriter = new TokenRingBufferWriter(data.ringBuffer);
      }

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
        n_threads: Math.max(1, (navigator.hardwareConcurrency || 4) - 1),
        cache_type_k: 'f16',
        cache_type_v: 'f16'
      };

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

    if (ringBufferWriter) {
      ringBufferWriter.reset();
      ringBufferWriter.setStatus(RingBufferStatus.STREAMING);
    }

    let resolvedState: StateVector = { hex: '00', quadrant: 'EGO', rawBits: 0 };
    let accumulatedDialogue = '';

    const parser = new CCDStreamParser({
      onToken: (token: string) => {
        accumulatedDialogue += token;
        if (ringBufferWriter) {
          ringBufferWriter.write(token);
        }
        self.postMessage({ type: 'TOKEN', token });
      },
      onState: (state: StateVector) => {
        resolvedState = state;
        if (ringBufferWriter) {
          ringBufferWriter.setStateHex(state.hex);
        }
        self.postMessage({ type: 'STATE_CHANGE', state });
      },
      onThought: (thought: string) => {
        self.postMessage({ type: 'THOUGHT', thought });
      },
      onVectorUpdate: (vector: Vector4D) => {
        self.postMessage({ type: 'VECTOR_UPDATE', vector });
      }
    });

    try {
      const grammar = data.grammar !== undefined
        ? data.grammar
        : (data.useGrammar !== false ? YULI_STRICT_GBNF : undefined);

      const completionConfig: any = {
        nPredict: data.maxTokens || 256,
        temp: data.temperature ?? 0.7,
        stop: ['<|im_end|>', '<|endoftext|>'],
        cache_prompt: true,
        onNewToken: (_token: number, _piece: Uint8Array, currentText: string) => {
          parser.feed(currentText);
        }
      };

      if (grammar) {
        completionConfig.grammar = grammar;
      }

      if (wllamaInstance.createCompletion.length === 1) {
        await wllamaInstance.createCompletion({ prompt: data.prompt, ...completionConfig });
      } else {
        await wllamaInstance.createCompletion(data.prompt, completionConfig);
      }

      parser.flush();

      if (ringBufferWriter) {
        ringBufferWriter.setStatus(RingBufferStatus.COMPLETE);
      }

      self.postMessage({
        type: 'COMPLETE',
        text: accumulatedDialogue.trim(),
        state: resolvedState,
        vector: parser.getCurrentVector()
      });
    } catch (err: any) {
      if (ringBufferWriter) {
        ringBufferWriter.setStatus(RingBufferStatus.ERROR);
      }
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
};
