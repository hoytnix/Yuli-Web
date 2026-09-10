/**
 * Action Grammar & Dynamic GBNF Compiler
 * Allows host game engines to bind type-safe game action intents into the WASM sampling logit mask.
 */

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
    return `root ::= thought_block state_block dialogue_block
thought_block ::= "<thought>" [^<]* "</thought>"
state_block ::= "<state_vector><s:" hex_pair "></state_vector>"
hex_pair ::= [0-9A-Fa-f] [0-9A-Fa-f]
dialogue_block ::= [^\\x00]+`;
  }

  const intentChoices = allowedIntents
    .map((intent) => `"${intent.replace(/"/g, '\\"')}"`)
    .join(' | ');

  return `root ::= thought_block state_block action_block dialogue_block
thought_block ::= "<thought>" [^<]* "</thought>"
state_block ::= "<state_vector><s:" hex_pair "></state_vector>"
action_block ::= "<action><intent>" intent_choice "</intent>" opt_value opt_payload "</action>"
intent_choice ::= (${intentChoices})
opt_value ::= ("<value>" [0-9]+ "</value>")?
opt_payload ::= ("<payload>" [^<]* "</payload>")?
hex_pair ::= [0-9A-Fa-f] [0-9A-Fa-f]
dialogue_block ::= [^\\x00]+`;
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
