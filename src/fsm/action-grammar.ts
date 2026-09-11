/**
 * Action Grammar & Dynamic GBNF Compiler
 * Allows host game engines to bind type-safe game action intents into the WASM sampling logit mask.
 */

import { YULI_STRICT_GBNF } from '../grammar/gbnf';

export interface ActionPayload<TCustomIntents extends string = string> {
  intent: TCustomIntents;
  value?: number;
  modifierValue?: number;
  payloadData?: Record<string, any>;
  raw?: string;
}

export type ParsedAction<TCustomIntents extends string = string> = ActionPayload<TCustomIntents>;

/**
 * Compiles a strict GBNF grammar from a list of allowed action intent strings.
 */
export function compileActionGrammar(allowedIntents?: string[]): string {
  if (!allowedIntents || allowedIntents.length === 0) {
    return YULI_STRICT_GBNF;
  }

  const intentChoices = allowedIntents
    .map((intent) => `"${intent.replace(/"/g, '\\"')}"`)
    .join(' | ');

  return [
    'root ::= thought-block state-block action-block dialogue-block',
    'thought-block ::= "<thought>" [^<]* "</thought>"',
    'state-block ::= "<state_vector><s:" hex-pair "></state_vector>"',
    'action-block ::= "<action><intent>" intent-choice "</intent>" opt-value opt-payload "</action>"',
    `intent-choice ::= (${intentChoices})`,
    'opt-value ::= ("<value>" [0-9]+ "</value>")?',
    'opt-payload ::= ("<payload>" [^<]* "</payload>")?',
    'hex-pair ::= [0-9A-Fa-f] [0-9A-Fa-f]',
    'dialogue-block ::= [^\\x00]+',
  ].join('\n');
}

/**
 * Extracts and parses an action payload from a raw text stream or thought trace.
 * Resilient to arbitrary whitespace, tag attributes, and structured JSON payloads.
 */
export function parseActionTag<T extends string = string>(
  text: string
): ActionPayload<T> | undefined {
  const actionBlockMatch = text.match(/<action(?:\s+[^>]*)?>([\s\S]*?)<\/action>/i);
  if (!actionBlockMatch) return undefined;

  const block = actionBlockMatch[1];
  const intentMatch = block.match(/<intent(?:\s+[^>]*)?>\s*([^<]+?)\s*<\/intent>/i);
  if (!intentMatch) return undefined;

  const intent = intentMatch[1].trim() as T;
  const valueMatch = block.match(/<value(?:\s+[^>]*)?>\s*([0-9.]+)\s*<\/value>/i);
  const value = valueMatch ? parseFloat(valueMatch[1]) : undefined;

  // Dynamic data / payload extraction
  const dataMatch = block.match(/<(?:data|payload)(?:\s+[^>]*)?>\s*([\s\S]*?)\s*<\/(?:data|payload)>/i);
  let payloadData: Record<string, any> | undefined;
  if (dataMatch) {
    try {
      payloadData = JSON.parse(dataMatch[1].trim());
    } catch {
      payloadData = { raw: dataMatch[1].trim() };
    }
  }

  return {
    intent,
    value,
    modifierValue: value,
    payloadData,
    raw: actionBlockMatch[0]
  };
}
