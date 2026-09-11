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

export function parseModelResponse(rawOutput: string): ParsedResponse {
  if (!rawOutput) {
    return { thought: '', state: '<s:00>', dialogue: '' };
  }

  let activeState = '<s:00>';
  const stateMatch = rawOutput.match(/<state_vector>\s*(<s:[0-9A-F]{2}>)\s*<\/state_vector>/i) ||
                     rawOutput.match(/(<s:[0-9A-F]{2}>)/i);
  if (stateMatch) {
    activeState = stateMatch[1].trim();
  }

  let thought = '';
  let dialogue = rawOutput;

  // Split strictly on the LAST </thought> delimiter if present
  const lastThoughtIdx = rawOutput.toLowerCase().lastIndexOf('</thought>');
  if (lastThoughtIdx !== -1) {
    const preThought = rawOutput.slice(0, lastThoughtIdx);
    dialogue = rawOutput.slice(lastThoughtIdx + '</thought>'.length);

    // Extract thought text by stripping leading state vector blocks and XML tags
    thought = preThought
      .replace(/<state_vector>[\s\S]*?<\/state_vector>/gi, '')
      .replace(/<thought>([\s\S]*?)<\/thought>/gi, '$1\n')
      .replace(/<[^>]+>/g, '')
      .replace(/<s:[0-9A-F]{2}>/gi, '')
      .trim();
  } else {
    // Leading-line heuristic fallback if no </thought> exists
    const lines = rawOutput.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1 && /^(using|evaluating|assessing|shifting|analyzing|tension|observing|calibrating|recognizing|resolving)/i.test(lines[0])) {
      thought = lines[0];
      dialogue = lines.slice(1).join('\n');
    }
  }

  // Purge remaining XML/custom tags and raw coordinates
  dialogue = dialogue
    .replace(/<[^>]+>/g, '')
    .replace(/<s:[0-9A-F]{2}>/gi, '')
    .trim();

  thought = thought
    .replace(/<[^>]+>/g, '')
    .replace(/<s:[0-9A-F]{2}>/gi, '')
    .trim();

  return {
    thought: thought || 'Context calibrated.',
    state: activeState,
    dialogue: dialogue || rawOutput
  };
}
