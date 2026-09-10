/**
 * Real-Time Typewriter Buffer
 * Decouples bursty on-device LLM generation rates (20-110 TPS) into smooth,
 * human-readable UI character streams with punctuation-synchronized audio triggers.
 */

export interface TypewriterOptions {
  charactersPerTick?: number;
  tickIntervalMs?: number;
  punctuationDelays?: Record<string, number>;
  onCharacter?: (char: string, totalText: string) => void;
  onPunctuation?: (punctuation: string) => void;
  onComplete?: (finalText: string) => void;
}

export class TypewriterBuffer {
  private queue: string[] = [];
  private renderedText: string = '';
  private isProcessing: boolean = false;
  private isCompletedStream: boolean = false;
  private timer: any = null;

  private charactersPerTick: number;
  private tickIntervalMs: number;
  private punctuationDelays: Record<string, number>;

  private onCharacterCb?: (char: string, totalText: string) => void;
  private onPunctuationCb?: (punctuation: string) => void;
  private onCompleteCb?: (finalText: string) => void;

  constructor(options: TypewriterOptions = {}) {
    this.charactersPerTick = options.charactersPerTick ?? 1;
    this.tickIntervalMs = options.tickIntervalMs ?? 25;
    this.punctuationDelays = options.punctuationDelays ?? {
      '.': 120,
      '!': 120,
      '?': 120,
      ',': 60,
      ';': 60,
      ':': 60
    };

    this.onCharacterCb = options.onCharacter;
    this.onPunctuationCb = options.onPunctuation;
    this.onCompleteCb = options.onComplete;
  }

  public setCadence(tickIntervalMs: number, charactersPerTick: number = 1): void {
    this.tickIntervalMs = Math.max(5, tickIntervalMs);
    this.charactersPerTick = Math.max(1, charactersPerTick);
  }

  public feed(chunk: string): void {
    if (!chunk) return;
    const chars = Array.from(chunk);
    this.queue.push(...chars);

    if (!this.isProcessing) {
      this.isProcessing = true;
      this.tick();
    }
  }

  public markStreamComplete(): void {
    this.isCompletedStream = true;
    if (this.queue.length === 0 && !this.isProcessing) {
      if (this.onCompleteCb) {
        this.onCompleteCb(this.renderedText);
      }
    }
  }

  public isRendering(): boolean {
    return this.queue.length > 0 || this.isProcessing;
  }

  public getRenderedText(): string {
    return this.renderedText;
  }

  public skip(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    while (this.queue.length > 0) {
      const char = this.queue.shift()!;
      this.renderedText += char;
      if (this.onCharacterCb) {
        this.onCharacterCb(char, this.renderedText);
      }
      if (this.punctuationDelays[char] && this.onPunctuationCb) {
        this.onPunctuationCb(char);
      }
    }

    this.isProcessing = false;
    if (this.onCompleteCb) {
      this.onCompleteCb(this.renderedText);
    }
  }

  public reset(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.queue = [];
    this.renderedText = '';
    this.isProcessing = false;
    this.isCompletedStream = false;
  }

  private tick(): void {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      if (this.isCompletedStream && this.onCompleteCb) {
        this.onCompleteCb(this.renderedText);
      }
      return;
    }

    let delay = this.tickIntervalMs;
    const charsToTake = Math.min(this.charactersPerTick, this.queue.length);

    for (let i = 0; i < charsToTake; i++) {
      const char = this.queue.shift()!;
      this.renderedText += char;

      if (this.onCharacterCb) {
        this.onCharacterCb(char, this.renderedText);
      }

      if (this.punctuationDelays[char]) {
        delay = Math.max(delay, this.punctuationDelays[char]);
        if (this.onPunctuationCb) {
          this.onPunctuationCb(char);
        }
      }
    }

    this.timer = setTimeout(() => this.tick(), delay);
  }
}
