/**
 * Action Grammar & Dynamic GBNF Compiler
 * Allows host game engines to bind type-safe game action intents into the WASM sampling logit mask.
 */

import { YULI_STRICT_GBNF } from '../grammar/gbnf';

export interface ParsedAction<TCustomIntents extends string = string> {
  intent: TCustomIntents;
  modifierValue?: number;
  payloadData?: Record<string, any>;
  raw?: string;
}

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
 */
export function parseActionTag<TCustomIntents extends string = string>(
  text: string
): ParsedAction<TCustomIntents> | null {
  const match = text.match(
    /<action><intent>([^<]+)<\/intent>(?:<value>([0-9]+)<\/value>)?(?:<payload>([^<]*)<\/payload>)?<\/action>/
  );
  if (!match) return null;

  const intent = match[1] as TCustomIntents;
  const modifierValue = match[2] !== undefined ? parseInt(match[2], 10) : undefined;
  let payloadData: Record<string, any> | undefined;

  if (match[3]) {
    try {
      payloadData = JSON.parse(match[3]);
    } catch {
      payloadData = { raw: match[3] };
    }
  }

  return {
    intent,
    modifierValue,
    payloadData,
    raw: match[0]
  };
}
