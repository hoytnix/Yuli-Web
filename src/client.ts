import { StateVector } from './parser/ccd';
import { DownloadProgress } from './storage/opfs';

export interface YuliOptions {
  modelUrl?: string;
  workerUrl?: string;
  onDownloadProgress?: (progress: DownloadProgress) => void;
  onStatusChange?: (status: string) => void;
}

export class YuliClient {
  private worker: Worker | null = null;
  private isModelReady: boolean = false;
  private options: YuliOptions;
  private currentState: StateVector = { hex: '00', quadrant: 'EGO', rawBits: 0 };

  constructor(options: YuliOptions = {}) {
    this.options = {
      modelUrl: 'https://huggingface.co/mshoyt/Yuli-Qwen2.5-0.5B-GGUF/resolve/main/yuli-qwen2.5-0.5b-q4_k_m.gguf',
      ...options
    };
  }

  public async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const defaultWorkerUrl = typeof import.meta !== 'undefined' && import.meta.url
        ? new URL('./worker.js', import.meta.url).href
        : './worker.js';

      this.worker = new Worker(this.options.workerUrl || defaultWorkerUrl, { type: 'module' });

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

      this.worker.postMessage({
        type: 'INIT',
        modelUrl: this.options.modelUrl,
        wasmPaths: {
          'wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama/src/wllama.wasm'
        }
      });
    });
  }

  public prompt(
    userInput: string,
    handlers?: {
      onToken?: (t: string) => void;
      onState?: (s: StateVector) => void;
      onThought?: (thought: string) => void;
    }
  ): Promise<{ text: string; state: StateVector }> {
    const worker = this.worker;
    if (!worker || !this.isModelReady) {
      throw new Error('YuliClient is not ready. Call await client.init() first.');
    }

    const formattedPrompt = `<|im_start|>user\n${userInput}<|im_end|>\n<|im_start|>assistant\n`;

    return new Promise((resolve, reject) => {
      const listener = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'TOKEN' && handlers?.onToken) {
          handlers.onToken(msg.token);
        } else if (msg.type === 'STATE_CHANGE') {
          this.currentState = msg.state;
          if (handlers?.onState) handlers.onState(msg.state);
        } else if (msg.type === 'THOUGHT' && handlers?.onThought) {
          handlers.onThought(msg.thought);
        } else if (msg.type === 'COMPLETE') {
          worker.removeEventListener('message', listener);
          resolve({ text: msg.text, state: msg.state });
        } else if (msg.type === 'ERROR') {
          worker.removeEventListener('message', listener);
          reject(new Error(msg.error));
        }
      };

      worker.addEventListener('message', listener);
      worker.postMessage({
        type: 'PROMPT',
        prompt: formattedPrompt
      });
    });
  }

  public getCurrentState(): StateVector {
    return this.currentState;
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isModelReady = false;
    }
  }
}
