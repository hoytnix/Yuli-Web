import { StateVector } from './parser/ccd';
import { DownloadProgress, OPFSStorageManager, extractModelFileName, DEFAULT_MODEL_FILENAME } from './storage/opfs';
import { Vector4D } from './vector/hypercube';
import {
  isSharedArrayBufferSupported,
  createSharedRingBuffer,
  TokenRingBufferReader,
  RingBufferStatus
} from './ringbuffer/ring-buffer';
import {
  YuliSnapshot,
  serializeStateSnapshot,
  deserializeStateSnapshot
} from './snapshot/state-snapshot';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  state?: StateVector;
  vector?: Vector4D;
}

export interface YuliOptions {
  modelUrl?: string;
  modelFileName?: string;
  workerUrl?: string;
  systemPrompt?: string;
  maxHistoryTurns?: number;
  enableZeroCopy?: boolean;
  onDownloadProgress?: (progress: DownloadProgress) => void;
  onStatusChange?: (status: string) => void;
  onVectorUpdate?: (vector: Vector4D) => void;
}

export interface PromptHandlers {
  onToken?: (t: string) => void;
  onState?: (s: StateVector) => void;
  onThought?: (thought: string) => void;
  onVectorUpdate?: (vector: Vector4D) => void;
}

export interface PromptOptions {
  useGrammar?: boolean;
  grammar?: string;
  temperature?: number;
  maxTokens?: number;
}

export class YuliClient {
  private worker: Worker | null = null;
  private isModelReady: boolean = false;
  private options: YuliOptions;
  private currentState: StateVector = { hex: '00', quadrant: 'EGO', rawBits: 0 };
  private currentVector: Vector4D = [-1, -1, -1, -1];
  private history: ChatMessage[] = [];
  private ringBuffer: SharedArrayBuffer | null = null;
  private ringBufferReader: TokenRingBufferReader | null = null;
  private storage: OPFSStorageManager;

  constructor(options: YuliOptions = {}) {
    const defaultModelUrl = 'https://huggingface.co/economyofdreams/Yuli-Qwen2.5-0.5B-Reddit-v0.1.0/resolve/main/Yuli-Qwen2.5-0.5B-Reddit-v0.1.0-Q4_K_M.gguf';
    this.options = {
      modelUrl: defaultModelUrl,
      systemPrompt: 'You are Yuli, an authentic, adaptive AI peer with a touch of wit and deep tactical intuition.',
      maxHistoryTurns: 6,
      enableZeroCopy: true,
      ...options
    };
    const modelFileName = this.options.modelFileName || (this.options.modelUrl ? extractModelFileName(this.options.modelUrl) : DEFAULT_MODEL_FILENAME);
    this.storage = new OPFSStorageManager(modelFileName);
    this.resetHistory();
  }

  public resetHistory(): void {
    this.history = [];
    if (this.options.systemPrompt) {
      this.history.push({ role: 'system', content: this.options.systemPrompt });
    }
  }

  public getHistory(): ChatMessage[] {
    return [...this.history];
  }

  public getCurrentState(): StateVector {
    return this.currentState;
  }

  public getCurrentVector(): Vector4D {
    return [...this.currentVector];
  }

  public isZeroCopyEnabled(): boolean {
    return this.ringBufferReader !== null;
  }

  /**
   * Check if the model runtime has loaded and is ready for inference.
   */
  public isLoaded(): boolean {
    return this.isModelReady;
  }

  /**
   * Alias for isLoaded().
   */
  public isReady(): boolean {
    return this.isModelReady;
  }

  /**
   * Check whether the model GGUF binary is already downloaded and cached in OPFS storage.
   * Returns true if cached (>100MB), false otherwise.
   */
  public async isModelCached(): Promise<boolean> {
    return this.storage.hasCachedModel();
  }

  /**
   * Alias for isModelCached().
   */
  public async hasCachedModel(): Promise<boolean> {
    return this.isModelCached();
  }

  /**
   * Static helper to check whether a model is cached in OPFS without instantiating YuliClient.
   */
  public static async isModelCached(modelUrlOrFileName?: string, directoryName?: string): Promise<boolean> {
    const fileName = modelUrlOrFileName ? extractModelFileName(modelUrlOrFileName) : undefined;
    return OPFSStorageManager.hasCachedModel(fileName, directoryName);
  }

  /**
   * Clear the cached model file from OPFS storage.
   */
  public async clearCachedModel(): Promise<boolean> {
    return this.storage.clearCachedModel();
  }

  public async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const defaultWorkerUrl = typeof import.meta !== 'undefined' && import.meta.url
        ? new URL('./worker.js', import.meta.url).href
        : './worker.js';

      this.worker = new Worker(this.options.workerUrl || defaultWorkerUrl, { type: 'module' });

      // Allocate SharedArrayBuffer if requested & supported
      if (this.options.enableZeroCopy && isSharedArrayBufferSupported()) {
        try {
          this.ringBuffer = createSharedRingBuffer();
          this.ringBufferReader = new TokenRingBufferReader(this.ringBuffer);
        } catch {
          this.ringBuffer = null;
          this.ringBufferReader = null;
        }
      }

      this.worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'STATUS' && this.options.onStatusChange) {
          this.options.onStatusChange(msg.status);
        } else if (msg.type === 'DOWNLOAD_PROGRESS' && this.options.onDownloadProgress) {
          this.options.onDownloadProgress(msg);
        } else if (msg.type === 'READY') {
          this.isModelReady = true;
          resolve();
        } else if (msg.type === 'ERROR') {
          reject(new Error(msg.error));
        }
      };

      const targetFileName = this.options.modelFileName || (this.options.modelUrl ? extractModelFileName(this.options.modelUrl) : DEFAULT_MODEL_FILENAME);

      this.worker.postMessage({
        type: 'INIT',
        modelUrl: this.options.modelUrl,
        modelFileName: targetFileName,
        ringBuffer: this.ringBuffer,
        wasmPaths: {
          'wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama/src/wllama.wasm'
        }
      });
    });
  }

  private buildChatMLPrompt(newUserMessage: string): string {
    this.history.push({ role: 'user', content: newUserMessage });
    const maxMessages = (this.options.maxHistoryTurns || 6) * 2;
    if (this.history.length > maxMessages + 1) {
      const systemMessage = this.history[0];
      const recentHistory = this.history.slice(-maxMessages);
      this.history = [systemMessage, ...recentHistory];
    }

    let prompt = '';
    for (const msg of this.history) {
      if (msg.role === 'system') {
        prompt += `<|im_start|>system\n${msg.content}<|im_end|>\n`;
      } else if (msg.role === 'user') {
        prompt += `<|im_start|>user\n${msg.content}<|im_end|>\n`;
      } else if (msg.role === 'assistant') {
        const stateTag = msg.state ? `<state_vector><s:${msg.state.hex}></state_vector>` : '';
        prompt += `<|im_start|>assistant\n${stateTag}${msg.content}<|im_end|>\n`;
      }
    }
    prompt += `<|im_start|>assistant\n`;
    return prompt;
  }

  public prompt(
    userInput: string,
    handlers?: PromptHandlers,
    options?: PromptOptions
  ): Promise<{ text: string; state: StateVector; vector: Vector4D }> {
    const worker = this.worker;
    if (!worker || !this.isModelReady) {
      throw new Error('YuliClient is not ready. Call await client.init() first.');
    }

    const formattedPrompt = this.buildChatMLPrompt(userInput);
    const reader = this.ringBufferReader;

    return new Promise((resolve, reject) => {
      let ringBufferDrainTimer: number | null = null;

      const stopDrain = () => {
        if (ringBufferDrainTimer !== null) {
          clearInterval(ringBufferDrainTimer);
          ringBufferDrainTimer = null;
        }
      };

      if (reader && handlers?.onToken) {
        reader.reset();
        ringBufferDrainTimer = (setInterval as Function)(() => {
          const chunk = reader.readAvailable();
          if (chunk.length > 0 && handlers.onToken) {
            handlers.onToken(chunk);
          }
          if (reader.getStatus() === RingBufferStatus.COMPLETE) {
            const finalChunk = reader.flush();
            if (finalChunk.length > 0 && handlers.onToken) {
              handlers.onToken(finalChunk);
            }
            stopDrain();
          }
        }, 16);
      }

      const listener = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'TOKEN') {
          // If reader is NOT active, dispatch token via postMessage fallback
          if (!reader && handlers?.onToken) {
            handlers.onToken(msg.token);
          }
        } else if (msg.type === 'STATE_CHANGE') {
          this.currentState = msg.state;
          if (handlers?.onState) handlers.onState(msg.state);
        } else if (msg.type === 'VECTOR_UPDATE') {
          this.currentVector = msg.vector;
          if (handlers?.onVectorUpdate) handlers.onVectorUpdate(msg.vector);
          if (this.options.onVectorUpdate) this.options.onVectorUpdate(msg.vector);
        } else if (msg.type === 'THOUGHT') {
          if (handlers?.onThought) handlers.onThought(msg.thought);
        } else if (msg.type === 'COMPLETE') {
          stopDrain();
          worker.removeEventListener('message', listener);

          if (msg.vector) {
            this.currentVector = msg.vector;
          }

          this.history.push({
            role: 'assistant',
            content: msg.text,
            state: msg.state,
            vector: this.currentVector
          });

          resolve({ text: msg.text, state: msg.state, vector: this.currentVector });
        } else if (msg.type === 'ERROR') {
          stopDrain();
          worker.removeEventListener('message', listener);
          reject(new Error(msg.error));
        }
      };

      worker.addEventListener('message', listener);
      worker.postMessage({
        type: 'PROMPT',
        prompt: formattedPrompt,
        useGrammar: options?.useGrammar,
        grammar: options?.grammar,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens
      });
    });
  }

  public exportKVCacheState(metadata?: Record<string, any>): ArrayBuffer {
    const snapshot: YuliSnapshot = {
      timestamp: Date.now(),
      state: this.currentState,
      vector4D: this.currentVector,
      history: this.getHistory(),
      metadata
    };
    return serializeStateSnapshot(snapshot);
  }

  public importKVCacheState(buffer: ArrayBuffer): YuliSnapshot {
    const snapshot = deserializeStateSnapshot(buffer);
    this.currentState = snapshot.state;
    this.currentVector = snapshot.vector4D;
    this.history = snapshot.history;
    return snapshot;
  }

  public async saveSnapshotToOPFS(name: string, metadata?: Record<string, any>): Promise<void> {
    const buffer = this.exportKVCacheState(metadata);
    await this.storage.saveSnapshot(name, buffer);
  }

  public async loadSnapshotFromOPFS(name: string): Promise<YuliSnapshot> {
    const buffer = await this.storage.loadSnapshot(name);
    return this.importKVCacheState(buffer);
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isModelReady = false;
      this.ringBuffer = null;
      this.ringBufferReader = null;
    }
  }
}
