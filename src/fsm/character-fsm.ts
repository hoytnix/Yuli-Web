import { YuliClient } from '../client';
import { StateVector, Quadrant } from '../parser/ccd';
import { Vector4D } from '../vector/hypercube';
import { compileActionGrammar, parseActionTag, ParsedAction } from './action-grammar';

export type FSMState =
  | 'IDLE'
  | 'DELIBERATING'
  | 'THINKING'
  | 'VECTOR_UPDATE'
  | 'STREAMING_DIALOGUE'
  | 'IDLE_COOLDOWN'
  | 'ERROR';

export interface GameTelemetryProvider {
  getMetrics(): Record<string, string | number | boolean>;
}

export interface YuliCharacterConfig<TCustomIntents extends string = string> {
  id: string;
  name: string;
  baselineQuadrant?: Quadrant;
  systemPrompt: string;
  allowedIntents?: TCustomIntents[];
  telemetryProvider?: GameTelemetryProvider;
  autoRollbackOnError?: boolean;
  maxQueueSize?: number;
  cooldownMs?: number;
}

export interface YuliGamePayload<TCustomIntents extends string = string> {
  dialogue: string;
  thoughtTrace: string;
  state: StateVector;
  vector4D: Vector4D;
  action?: ParsedAction<TCustomIntents>;
  metrics: {
    tokensGenerated: number;
    inferenceTimeMs: number;
    tokensPerSecond: number;
  };
}

export class YuliCharacterFSM<TCustomIntents extends string = string> {
  private client: YuliClient;
  private config: YuliCharacterConfig<TCustomIntents>;
  private currentState: FSMState = 'IDLE';
  private listeners: Map<string, Function[]> = new Map();
  private cooldownTimer: any = null;
  private maxQueueSize: number;
  private inputQueue: Array<{
    playerInput: string;
    resolve: (value: YuliGamePayload<TCustomIntents>) => void;
    reject: (reason: any) => void;
  }> = [];

  constructor(client: YuliClient, config: YuliCharacterConfig<TCustomIntents>) {
    this.client = client;
    this.config = config;
    this.maxQueueSize = config.maxQueueSize ?? 2;
  }

  public getState(): FSMState {
    return this.currentState;
  }

  public getConfig(): YuliCharacterConfig<TCustomIntents> {
    return { ...this.config };
  }

  private transition(newState: FSMState) {
    const previousState = this.currentState;
    this.currentState = newState;
    this.emit('stateTransition', newState, previousState);
  }

  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      this.listeners.set(
        event,
        cbs.filter((cb) => cb !== callback)
      );
    }
  }

  private emit(event: string, ...args: any[]): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        cb(...args);
      }
    }
  }

  public async evaluateInput(playerInput: string): Promise<YuliGamePayload<TCustomIntents>> {
    if (this.currentState !== 'IDLE') {
      if (this.maxQueueSize > 0 && this.inputQueue.length < this.maxQueueSize) {
        return new Promise<YuliGamePayload<TCustomIntents>>((resolve, reject) => {
          this.inputQueue.push({ playerInput, resolve, reject });
        });
      }
      throw new Error(`Cannot evaluate input while character is in state '${this.currentState}'.`);
    }

    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }

    this.transition('DELIBERATING');

    let telemetryContext = '';
    if (this.config.telemetryProvider) {
      try {
        const metrics = this.config.telemetryProvider.getMetrics();
        telemetryContext = `\n[Live Game Telemetry: ${JSON.stringify(metrics)}]`;
      } catch (err) {
        // Non-fatal telemetry ingestion failure
        this.emit('telemetryError', err);
      }
    }

    const enhancedInput = `${playerInput}${telemetryContext}`;
    const actionGrammar = compileActionGrammar(this.config.allowedIntents);

    // Save checkpoint prior to inference for automatic rollback on error
    let checkpointBuffer: ArrayBuffer | null = null;
    try {
      checkpointBuffer = this.client.exportKVCacheState();
    } catch {
      checkpointBuffer = null;
    }

    this.transition('THINKING');

    const startTime = performance.now();
    let tokenCount = 0;
    let accumulatedThought = '';
    let accumulatedDialogue = '';

    try {
      const result = await this.client.prompt(
        enhancedInput,
        {
          onThought: (thought: string) => {
            accumulatedThought += thought;
            this.emit('thought', thought);
          },
          onState: (state: StateVector) => {
            this.transition('VECTOR_UPDATE');
            this.emit('stateChange', state);
          },
          onVectorUpdate: (vector: Vector4D) => {
            this.emit('vectorUpdate', vector);
          },
          onToken: (token: string) => {
            tokenCount++;
            if (this.currentState !== 'STREAMING_DIALOGUE') {
              this.transition('STREAMING_DIALOGUE');
            }
            accumulatedDialogue += token;
            this.emit('token', token);

            // Intercept punctuation marks for audio/animation triggers
            const trimmed = token.trim();
            if (trimmed.length > 0 && ['.', '!', '?', ','].includes(trimmed.slice(-1))) {
              this.emit('punctuation', trimmed.slice(-1));
            }
          }
        },
        {
          grammar: actionGrammar,
          useGrammar: true
        }
      );

      const endTime = performance.now();
      const inferenceTimeMs = Math.max(1, endTime - startTime);
      const tokensPerSecond = parseFloat(((tokenCount / inferenceTimeMs) * 1000).toFixed(2));

      // Parse custom game actions if generated
      const parsedAction =
        parseActionTag<TCustomIntents>(accumulatedThought) ||
        parseActionTag<TCustomIntents>(result.text);

      if (parsedAction) {
        this.emit('action', parsedAction);
      }

      const payload: YuliGamePayload<TCustomIntents> = {
        dialogue: result.text,
        thoughtTrace: accumulatedThought,
        state: result.state,
        vector4D: result.vector,
        action: parsedAction ?? undefined,
        metrics: {
          tokensGenerated: tokenCount,
          inferenceTimeMs,
          tokensPerSecond
        }
      };

      this.transition('IDLE_COOLDOWN');
      this.emit('payload', payload);
      this.emit('complete', payload);

      const cooldown = this.config.cooldownMs ?? 200;
      this.cooldownTimer = setTimeout(() => {
        if (this.currentState === 'IDLE_COOLDOWN') {
          this.transition('IDLE');
          this.processQueue();
        }
      }, cooldown);

      return payload;
    } catch (err: any) {
      this.transition('ERROR');

      // Auto-rollback KV-cache to pre-turn checkpoint
      if (this.config.autoRollbackOnError !== false && checkpointBuffer) {
        try {
          this.client.importKVCacheState(checkpointBuffer);
          this.emit('rollback', { reason: err.message });
        } catch (rollbackErr) {
          this.emit('rollbackError', rollbackErr);
        }
      }

      this.emit('error', err);
      throw err;
    }
  }

  public resetToIdle(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.transition('IDLE');
    this.processQueue();
  }

  private processQueue(): void {
    if (this.currentState !== 'IDLE' || this.inputQueue.length === 0) {
      return;
    }
    const nextItem = this.inputQueue.shift();
    if (nextItem) {
      this.evaluateInput(nextItem.playerInput)
        .then(nextItem.resolve)
        .catch(nextItem.reject);
    }
  }

  public getQueueLength(): number {
    return this.inputQueue.length;
  }

  public canAcceptInput(): boolean {
    return this.currentState === 'IDLE' || this.inputQueue.length < this.maxQueueSize;
  }

  public clearQueue(): void {
    while (this.inputQueue.length > 0) {
      const item = this.inputQueue.shift();
      if (item) {
        item.reject(new Error('Input queue cleared.'));
      }
    }
  }
}
