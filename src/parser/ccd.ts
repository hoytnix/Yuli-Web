import { Vector4D, coordinateToVector, applyVectorDelta } from '../vector/hypercube';

export type Quadrant = 'EGO' | 'SHADOW' | 'SUBCONSCIOUS' | 'SUPEREGO';

export interface StateVector {
  hex: string;
  quadrant: Quadrant;
  rawBits: number;
}

export function parseCoordinate(hex: string): StateVector {
  const cleanHex = hex.trim().toUpperCase().padStart(2, '0');
  const val = parseInt(cleanHex, 16);
  
  let quadrant: Quadrant = 'EGO';
  if (val >= 0x00 && val <= 0x03) quadrant = 'EGO';
  else if (val >= 0x04 && val <= 0x07) quadrant = 'SHADOW';
  else if (val >= 0x08 && val <= 0x0B) quadrant = 'SUBCONSCIOUS';
  else quadrant = 'SUPEREGO';

  return { hex: cleanHex, quadrant, rawBits: val };
}

export interface CCDHandlers {
  onToken: (token: string) => void;
  onState: (state: StateVector) => void;
  onThought: (thought: string) => void;
  onVectorUpdate?: (vector: Vector4D) => void;
}

export class CCDStreamParser {
  private buffer: string = '';
  private inThought: boolean = false;
  private inStateVector: boolean = false;
  private currentVector: Vector4D = [-1, -1, -1, -1]; // Default Ego <s:00>

  private onTokenCb: (token: string) => void;
  private onStateCb: (state: StateVector) => void;
  private onThoughtCb: (thought: string) => void;
  private onVectorUpdateCb?: (vector: Vector4D) => void;

  constructor(handlers: CCDHandlers) {
    this.onTokenCb = handlers.onToken;
    this.onStateCb = handlers.onState;
    this.onThoughtCb = handlers.onThought;
    this.onVectorUpdateCb = handlers.onVectorUpdate;
  }

  public getCurrentVector(): Vector4D {
    return [...this.currentVector];
  }

  public feed(chunk: string) {
    this.buffer += chunk;
    this.processBuffer();
  }

  private scanForDeltas(text: string) {
    const deltaRegex = /<d:([0-3])([+-])>/g;
    let match: RegExpExecArray | null;
    while ((match = deltaRegex.exec(text)) !== null) {
      const dim = parseInt(match[1], 10);
      const sign = match[2] === '+' ? 0.25 : -0.25;
      this.currentVector = applyVectorDelta(this.currentVector, dim, sign);
      if (this.onVectorUpdateCb) {
        this.onVectorUpdateCb([...this.currentVector]);
      }
    }
  }

  private processBuffer() {
    let changed = true;
    while (changed) {
      changed = false;

      // Thought block start
      if (!this.inThought && this.buffer.includes('<thought>')) {
        const idx = this.buffer.indexOf('<thought>');
        if (idx > 0) {
          this.onTokenCb(this.buffer.slice(0, idx));
        }
        this.buffer = this.buffer.slice(idx + '<thought>'.length);
        this.inThought = true;
        changed = true;
        continue;
      }

      // Thought block termination
      if (this.inThought && this.buffer.includes('</thought>')) {
        const idx = this.buffer.indexOf('</thought>');
        const thoughtContent = this.buffer.slice(0, idx);
        this.scanForDeltas(thoughtContent);
        this.onThoughtCb(thoughtContent);
        this.buffer = this.buffer.slice(idx + '</thought>'.length);
        this.inThought = false;
        changed = true;
        continue;
      }

      if (this.inThought) {
        if (!this.buffer.includes('</thought>')) {
          this.scanForDeltas(this.buffer);
          this.onThoughtCb(this.buffer);
          this.buffer = '';
        }
        break;
      }

      // State vector block start
      if (!this.inStateVector && this.buffer.includes('<state_vector>')) {
        const idx = this.buffer.indexOf('<state_vector>');
        if (idx > 0) {
          this.onTokenCb(this.buffer.slice(0, idx));
        }
        this.buffer = this.buffer.slice(idx + '<state_vector>'.length);
        this.inStateVector = true;
        changed = true;
        continue;
      }

      // State vector block termination & parsing
      if (this.inStateVector && this.buffer.includes('</state_vector>')) {
        const idx = this.buffer.indexOf('</state_vector>');
        const vectorContent = this.buffer.slice(0, idx);
        
        const match = vectorContent.match(/<s:([0-9A-Fa-f]{2})>/);
        if (match && match[1]) {
          const state = parseCoordinate(match[1]);
          this.onStateCb(state);
          this.currentVector = coordinateToVector(state.rawBits);
          if (this.onVectorUpdateCb) {
            this.onVectorUpdateCb([...this.currentVector]);
          }
        }

        this.buffer = this.buffer.slice(idx + '</state_vector>'.length);
        this.inStateVector = false;
        changed = true;
        continue;
      }

      if (this.inStateVector) {
        break;
      }

      // Stream out clean text if no tag delimiters are actively buffered
      const tagOpenIndex = this.buffer.indexOf('<');
      if (tagOpenIndex === -1) {
        this.onTokenCb(this.buffer);
        this.buffer = '';
      } else if (tagOpenIndex > 0) {
        this.onTokenCb(this.buffer.slice(0, tagOpenIndex));
        this.buffer = this.buffer.slice(tagOpenIndex);
      } else {
        if (this.buffer.length > 20) {
          this.onTokenCb(this.buffer[0]);
          this.buffer = this.buffer.slice(1);
          changed = true;
        }
        break;
      }
    }
  }

  public flush() {
    if (this.buffer.length > 0 && !this.inThought && !this.inStateVector) {
      this.onTokenCb(this.buffer);
      this.buffer = '';
    }
  }
}
