import { CCDStreamParser, StateVector } from '../parser/ccd';
import { Vector4D } from '../vector/hypercube';
import { TypewriterBuffer, TypewriterOptions } from './typewriter';
import { ParsedAction, parseActionTag } from '../fsm/action-grammar';

export interface DialoguePipelineOptions<TCustomIntents extends string = string> {
  typewriter?: TypewriterOptions;
  stripMarkdown?: boolean;
  onCharacter?: (char: string, totalText: string) => void;
  onPunctuation?: (punctuation: string) => void;
  onState?: (state: StateVector) => void;
  onVectorUpdate?: (vector: Vector4D) => void;
  onThought?: (thought: string) => void;
  onAction?: (action: ParsedAction<TCustomIntents>) => void;
  onComplete?: (result: {
    dialogue: string;
    thought: string;
    state: StateVector;
    vector4D: Vector4D;
    action?: ParsedAction<TCustomIntents>;
  }) => void;
}

export class DialoguePipeline<TCustomIntents extends string = string> {
  private parser: CCDStreamParser;
  private typewriter: TypewriterBuffer;
  private fullThought: string = '';
  private fullDialogue: string = '';
  private latestState: StateVector = { hex: '00', quadrant: 'EGO', rawBits: 0 };
  private latestVector: Vector4D = [-1, -1, -1, -1];
  private parsedAction: ParsedAction<TCustomIntents> | null = null;
  private options: DialoguePipelineOptions<TCustomIntents>;

  constructor(options: DialoguePipelineOptions<TCustomIntents> = {}) {
    this.options = options;

    this.typewriter = new TypewriterBuffer({
      ...options.typewriter,
      onCharacter: options.onCharacter,
      onPunctuation: options.onPunctuation,
      onComplete: (renderedText) => {
        if (this.options.onComplete) {
          this.options.onComplete({
            dialogue: renderedText,
            thought: this.fullThought,
            state: this.latestState,
            vector4D: this.latestVector,
            action: this.parsedAction ?? undefined
          });
        }
      }
    });

    this.parser = new CCDStreamParser({
      onToken: (token: string) => {
        // Intercept action tags if embedded in stream
        if (token.includes('<action>')) {
          const action = parseActionTag<TCustomIntents>(token);
          if (action) {
            this.parsedAction = action;
            if (this.options.onAction) {
              this.options.onAction(action);
            }
          }
        }

        const sanitized = this.options.stripMarkdown
          ? token.replace(/[*_#`~]/g, '')
          : token;
        const cleanToken = sanitized
          .replace(/<\/?(?:thought|state_vector|dna|tension)[^>]*>/gi, '')
          .replace(/<s:[0-9A-Fa-f]{2}>/gi, '');

        if (cleanToken.length > 0) {
          this.fullDialogue += cleanToken;
          this.typewriter.feed(cleanToken);
        }
      },
      onState: (state: StateVector) => {
        this.latestState = state;
        if (this.options.onState) {
          this.options.onState(state);
        }
      },
      onThought: (thought: string) => {
        const cleanThought = thought.replace(/<\/?(?:thought|tension)[^>]*>/gi, '');
        if (cleanThought.length > 0) {
          this.fullThought += cleanThought;
          if (cleanThought.includes('<action>')) {
            const action = parseActionTag<TCustomIntents>(cleanThought);
            if (action) {
              this.parsedAction = action;
              if (this.options.onAction) {
                this.options.onAction(action);
              }
            }
          }
          if (this.options.onThought) {
            this.options.onThought(cleanThought);
          }
        }
      },
      onVectorUpdate: (vector: Vector4D) => {
        this.latestVector = vector;
        if (this.options.onVectorUpdate) {
          this.options.onVectorUpdate(vector);
        }
      }
    });
  }

  public feed(chunk: string): void {
    this.parser.feed(chunk);
  }

  public complete(): void {
    this.parser.flush();
    this.typewriter.markStreamComplete();
  }

  public skipTypewriter(): void {
    this.typewriter.skip();
  }

  public reset(): void {
    this.fullThought = '';
    this.fullDialogue = '';
    this.latestState = { hex: '00', quadrant: 'EGO', rawBits: 0 };
    this.latestVector = [-1, -1, -1, -1];
    this.parsedAction = null;
    this.typewriter.reset();
  }
}

export interface ParsedResponse {
  thought: string;
  state: string;
  dialogue: string;
}

export type ParsedModelResponse = ParsedResponse;

/**
 * Robustly parses model output, stripping all internal cognitive traces,
 * tension markers, state vectors, and DNA strings from the public dialogue,
 * routing them correctly into the deliberation view.
 */
export function parseModelResponse(rawOutput: string): ParsedResponse {
  if (!rawOutput) {
    return { thought: '', state: '<s:00>', dialogue: '' };
  }

  let thoughtContent = '';
  let activeState = '<s:00>';

  // 1. Extract standard <thought>...</thought> blocks
  const thoughtMatch = rawOutput.match(/<thought>([\s\S]*?)<\/thought>/i);
  if (thoughtMatch) {
    thoughtContent = thoughtMatch[1].trim();
  }

  // 2. Fallback: Catch custom metadata tags like <tension ...> or unclosed thought headers if present
  const tensionMatch = rawOutput.match(/<(?:tension|thought|dna)[^>]*>([\s\S]*?)(?:<\/(?:tension|thought|dna)>|$)/i);
  if (!thoughtContent && tensionMatch) {
    thoughtContent = tensionMatch[1].trim();
  }

  // 3. Extract state vector or terminal DNA state token (<s:XX>)
  const stateMatch = rawOutput.match(/<state_vector>\s*(<s:[0-9A-F]{2}>)\s*<\/state_vector>/i) ||
                     rawOutput.match(/(<s:[0-9A-F]{2}>)/i);
  if (stateMatch) {
    activeState = stateMatch[1].trim();
  }

  // 4. Clean dialogue: Strip all internal tags, XML blocks, and leaked metadata lines
  let cleanDialogue = rawOutput
    // Remove standard XML thought/dna/state/tension blocks completely
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<dna>[\s\S]*?<\/dna>/gi, '')
    .replace(/<state_vector>[\s\S]*?<\/state_vector>/gi, '')
    .replace(/<tension[^>]*>[\s\S]*?<\/tension>/gi, '')
    // Remove standalone tags or stray headers like <tension 0.8> or </thought>
    .replace(/<\/?(?:thought|dna|state_vector|tension)[^>]*>/gi, '')
    // Remove raw hex state tokens from the dialogue body
    .replace(/<s:[0-9A-F]{2}>/gi, '')
    // Clean up excessive whitespace or leading artifacts left behind
    .replace(/^\s*[\r\n]/gm, '')
    .trim();

  // If the entire output was wrapped in thoughts and nothing was left for dialogue, 
  // ensure we don't display an empty bubble.
  if (!cleanDialogue && thoughtContent) {
    cleanDialogue = thoughtContent;
    thoughtContent = 'Parsed from direct output stream.';
  }

  return {
    thought: thoughtContent || 'Context calibrated and evaluated.',
    state: activeState,
    dialogue: cleanDialogue
  };
}
