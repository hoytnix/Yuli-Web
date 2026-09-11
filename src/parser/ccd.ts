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
  onAction?: (actionText: string) => void;
}

export class CCDStreamParser {
  private buffer: string = '';
  private inThought: boolean = false;
  private inStateVector: boolean = false;
  private inAction: boolean = false;
  private currentVector: Vector4D = [-1, -1, -1, -1]; // Default Ego <s:00>

  private onTokenCb: (token: string) => void;
  private onStateCb: (state: StateVector) => void;
  private onThoughtCb: (thought: string) => void;
  private onVectorUpdateCb?: (vector: Vector4D) => void;
  private onActionCb?: (actionText: string) => void;

  constructor(handlers: CCDHandlers) {
    this.onTokenCb = handlers.onToken;
    this.onStateCb = handlers.onState;
    this.onThoughtCb = handlers.onThought;
    this.onVectorUpdateCb = handlers.onVectorUpdate;
    this.onActionCb = handlers.onAction;
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

  private emitToken(token: string) {
    const cleaned = token
      .replace(/<\/?(?:thought|state_vector|dna|tension|action|intent|value|payload|data)[^>]*>/gi, '')
      .replace(/<s:[0-9A-Fa-f]{2}>/gi, '');
    if (cleaned.length > 0) {
      this.onTokenCb(cleaned);
    }
  }

  private processBuffer() {
    let changed = true;
    while (changed) {
      changed = false;

      // Strip orphan closing tags or state markers at buffer head
      if (!this.inThought && !this.inStateVector && !this.inAction) {
        const orphanTagMatch = this.buffer.match(/^(?:<\/(?:thought|state_vector|dna|tension|action)>|<(?:dna|tension)[^>]*>|<\/dna>|<s:[0-9A-Fa-f]{2}>)/i);
        if (orphanTagMatch) {
          this.buffer = this.buffer.slice(orphanTagMatch[0].length);
          changed = true;
          continue;
        }
      }

      // Handle unclosed or malformed thought blocks terminated by </thought>
      if (!this.inThought && !this.inStateVector && !this.inAction) {
        const thoughtOpenIdx = this.buffer.indexOf('<thought>');
        const thoughtCloseIdx = this.buffer.indexOf('</thought>');
        const stateOpenIdx = this.buffer.indexOf('<state_vector>');
        const hasEarlierStateVector = stateOpenIdx !== -1 && stateOpenIdx < thoughtCloseIdx;

        if (thoughtCloseIdx !== -1 && (thoughtOpenIdx === -1 || thoughtCloseIdx < thoughtOpenIdx) && !hasEarlierStateVector) {
          const thoughtContent = this.buffer.slice(0, thoughtCloseIdx);
          const cleanThought = thoughtContent
            .replace(/<[^>]+>/g, '')
            .replace(/<s:[0-9A-Fa-f]{2}>/gi, '')
            .trim();
          if (cleanThought.length > 0) {
            this.scanForDeltas(cleanThought);
            this.onThoughtCb(cleanThought);
          }
          this.buffer = this.buffer.slice(thoughtCloseIdx + '</thought>'.length);
          changed = true;
          continue;
        }
      }

      // Thought block start
      if (!this.inThought && this.buffer.includes('<thought>')) {
        const idx = this.buffer.indexOf('<thought>');
        if (idx > 0) {
          this.emitToken(this.buffer.slice(0, idx));
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
        // Prevent partial closing tag (e.g. "</thou") from being eagerly emitted to thoughtText
        const partialLen = getPartialClosingTagLength(this.buffer, '</thought>');
        if (partialLen > 0) {
          const safe = this.buffer.slice(0, -partialLen);
          if (safe.length > 0) {
            this.scanForDeltas(safe);
            this.onThoughtCb(safe);
            this.buffer = this.buffer.slice(-partialLen);
          }
        } else {
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
          this.emitToken(this.buffer.slice(0, idx));
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

      // Action block start
      if (!this.inAction && this.buffer.includes('<action>')) {
        const idx = this.buffer.indexOf('<action>');
        if (idx > 0) {
          this.emitToken(this.buffer.slice(0, idx));
        }
        this.buffer = this.buffer.slice(idx + '<action>'.length);
        this.inAction = true;
        changed = true;
        continue;
      }

      // Action block termination
      if (this.inAction && this.buffer.includes('</action>')) {
        const idx = this.buffer.indexOf('</action>');
        const actionContent = '<action>' + this.buffer.slice(0, idx) + '</action>';
        if (this.onActionCb) {
          this.onActionCb(actionContent);
        }
        this.buffer = this.buffer.slice(idx + '</action>'.length);
        this.inAction = false;
        changed = true;
        continue;
      }

      if (this.inAction) {
        break;
      }

      // Stream out clean text if no tag delimiters are actively buffered
      const tagOpenIndex = this.buffer.indexOf('<');
      if (tagOpenIndex === -1) {
        this.emitToken(this.buffer);
        this.buffer = '';
      } else if (tagOpenIndex > 0) {
        this.emitToken(this.buffer.slice(0, tagOpenIndex));
        this.buffer = this.buffer.slice(tagOpenIndex);
      } else {
        const couldBeTag = /^<\/?(?:a(?:c(?:t(?:i(?:o(?:n)?)?)?)?)?|t(?:h(?:o(?:u(?:g(?:h(?:t)?)?)?)?)?)?|t(?:e(?:n(?:s(?:i(?:o(?:n)?)?)?)?)?)?|s(?:t(?:a(?:t(?:e(?:_(?:v(?:e(?:c(?:t(?:o(?:r)?)?)?)?)?)?)?)?)?)?)?|d(?:n(?:a)?)?|s(?::[0-9A-Fa-f]{0,2})?)?>?/i.test(this.buffer);
        if (couldBeTag && this.buffer.length < 20) {
          break;
        }
        this.emitToken(this.buffer[0]);
        this.buffer = this.buffer.slice(1);
        changed = true;
      }
    }
  }

  public flush() {
    if (this.inThought) {
      const cleanThought = this.buffer
        .replace(/<\/?(?:thought|state_vector|dna|tension)[^>]*>/gi, '')
        .replace(/<s:[0-9A-Fa-f]{2}>/gi, '');
      if (cleanThought.length > 0) {
        this.scanForDeltas(cleanThought);
        this.onThoughtCb(cleanThought);
      }
      this.buffer = '';
      this.inThought = false;
    }
    if (this.inStateVector) {
      const match = this.buffer.match(/<s:([0-9A-Fa-f]{2})>/);
      if (match && match[1]) {
        const state = parseCoordinate(match[1]);
        this.onStateCb(state);
      }
      this.buffer = '';
      this.inStateVector = false;
    }
    if (this.inAction) {
      const actionContent = '<action>' + this.buffer;
      if (this.onActionCb) {
        this.onActionCb(actionContent);
      }
      this.buffer = '';
      this.inAction = false;
    }
    if (this.buffer.length > 0) {
      this.emitToken(this.buffer);
      this.buffer = '';
    }
  }
}

function getPartialClosingTagLength(text: string, tag: string): number {
  const maxLen = Math.min(text.length, tag.length - 1);
  for (let len = maxLen; len > 0; len--) {
    if (text.endsWith(tag.slice(0, len))) {
      return len;
    }
  }
  return 0;
}
