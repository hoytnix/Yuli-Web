import { Wllama } from '@wllama/wllama';
import { OPFSStorageManager, extractModelFileName, DEFAULT_MODEL_FILENAME } from './storage/opfs';
import { CCDStreamParser, StateVector } from './parser/ccd';
import { TokenRingBufferWriter, RingBufferStatus } from './ringbuffer/ring-buffer';
import { YULI_STRICT_GBNF } from './grammar/gbnf';
import { Vector4D } from './vector/hypercube';
import { parseModelResponse } from './dialogue/pipeline';

let wllamaInstance: any = null;
let ringBufferWriter: TokenRingBufferWriter | null = null;

self.onmessage = async (e: MessageEvent) => {
  const data = e.data;

  if (data.type === 'INIT') {
    try {
      if (data.ringBuffer) {
        ringBufferWriter = new TokenRingBufferWriter(data.ringBuffer);
      }

      const modelFileName = data.modelFileName || (data.modelUrl ? extractModelFileName(data.modelUrl) : DEFAULT_MODEL_FILENAME);
      const storage = new OPFSStorageManager(modelFileName);

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

      const defaultWasm = 'https://cdn.jsdelivr.net/npm/@wllama/wllama@3.6.1/esm/wasm/wllama.wasm';
      const wasmPaths: any = data.wasmPaths || { default: defaultWasm };
      if (typeof wasmPaths === 'object' && wasmPaths !== null && !wasmPaths.default) {
        wasmPaths.default = wasmPaths['wllama.wasm'] ||
          wasmPaths['single-thread/wllama.wasm'] ||
          wasmPaths['multi-thread/wllama.wasm'] ||
          defaultWasm;
      }

      wllamaInstance = new Wllama(wasmPaths);

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
    let rawOutput = '';
    let tokenCount = 0;
    const startTime = performance.now();
    let firstTokenTime: number | null = null;
    let wllamaTimings: any = null;

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
        prompt: data.prompt,
        nPredict: data.maxTokens || 256,
        max_tokens: data.maxTokens || 256,
        temp: data.temperature ?? 0.7,
        temperature: data.temperature ?? 0.7,
        stop: ['<|im_end|>', '<|endoftext|>'],
        cache_prompt: true,
        stream: true,
        onData: (chunk: any) => {
          const piece = chunk?.choices?.[0]?.text ?? chunk?.choices?.[0]?.delta?.content;
          if (piece) {
            if (firstTokenTime === null) {
              firstTokenTime = performance.now();
            }
            tokenCount++;
            rawOutput += piece;
            parser.feed(piece);
          }
          if (chunk?.timings) {
            wllamaTimings = chunk.timings;
          }
        },
        onNewToken: (_token: number, _piece: Uint8Array, currentText: string) => {
          if (!rawOutput) {
            if (firstTokenTime === null) {
              firstTokenTime = performance.now();
            }
            tokenCount++;
            rawOutput += currentText;
            parser.feed(currentText);
          }
        }
      };

      if (grammar) {
        completionConfig.grammar = grammar;
      }

      if (wllamaInstance.createCompletion.length === 1) {
        await wllamaInstance.createCompletion(completionConfig);
      } else {
        await wllamaInstance.createCompletion(data.prompt, completionConfig);
      }

      parser.flush();

      if (ringBufferWriter) {
        ringBufferWriter.setStatus(RingBufferStatus.COMPLETE);
      }

      const endTime = performance.now();
      const totalTimeMs = Math.round(endTime - startTime);
      const ttftMs = firstTokenTime !== null ? Math.round(firstTokenTime - startTime) : totalTimeMs;
      const generationTimeMs = Math.max(1, totalTimeMs - ttftMs);
      const tokensPerSecond = tokenCount > 0
        ? Number((tokenCount / (generationTimeMs / 1000)).toFixed(1))
        : 0;

      const telemetry = {
        ttftMs,
        totalTimeMs,
        tokensGenerated: tokenCount,
        tokensPerSecond,
        promptTokens: wllamaTimings?.prompt_n ?? (data.prompt ? Math.round(data.prompt.length / 4) : undefined),
        promptPerSecond: wllamaTimings?.prompt_per_second ? Number(wllamaTimings.prompt_per_second.toFixed(1)) : undefined
      };

      const parsed = parseModelResponse(rawOutput);

      self.postMessage({
        type: 'COMPLETE',
        text: parsed.dialogue || accumulatedDialogue.trim(),
        rawText: rawOutput,
        state: resolvedState,
        vector: parser.getCurrentVector(),
        telemetry
      });
    } catch (err: any) {
      if (ringBufferWriter) {
        ringBufferWriter.setStatus(RingBufferStatus.ERROR);
      }
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
};
