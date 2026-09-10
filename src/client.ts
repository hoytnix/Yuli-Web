import { StateVector } from './parser/ccd';
import { DownloadProgress } from './storage/opfs';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  state?: StateVector;
}

export interface YuliOptions {
  modelUrl?: string;
  workerUrl?: string;
  systemPrompt?: string;
  maxHistoryTurns?: number;
  onDownloadProgress?: (progress: DownloadProgress) => void;
  onStatusChange?: (status: string) => void;
}

export class YuliClient {
  private worker: Worker | null = null;
  private isModelReady: boolean = false;
  private options: YuliOptions;
  private currentState: StateVector = { hex: '00', quadrant: 'EGO', rawBits: 0 };
  private history: ChatMessage[] = [];

  constructor(options: YuliOptions = {}) {
    this.options = {
      modelUrl: 'https://huggingface.co/mshoyt/Yuli-Qwen2.5-0.5B-GGUF/resolve/main/yuli-qwen2.5-0.5b-q4_k_m.gguf',
      systemPrompt: 'You are Yuli, an authentic, adaptive AI peer with a touch of wit and deep tactical intuition.',
      maxHistoryTurns: 6,
      ...options
    };
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

    const formattedPrompt = this.buildChatMLPrompt(userInput);

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
          this.history.push({
            role: 'assistant',
            content: msg.text,
            state: msg.state
          });
          resolve({ text: msg.text, state: msg.state });
        } else if (msg.type === 'ERROR') {
          worker.removeEventListener('message', listener);
          reject(new Error(msg.error));
        }
      };

      worker.addEventListener('message', listener);
      worker.postMessage({ type: 'PROMPT', prompt: formattedPrompt });
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
