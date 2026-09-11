/**
 * GBNF (GGML Backus-Naur Form) grammar definitions for grammar-constrained decoding.
 * Enforces strict XML structural compliance at the WASM sampler level.
 */

/**
 * Generates the strict GBNF grammar for Yuli dialectical deliberation,
 * hypercube coordinate vectors, and human-facing dialogue tokens.
 *
 * Rules are explicitly joined by newlines (\n) to prevent GBNF parser crashes.
 * Rule identifiers default to kebab-case (hyphens) because llama.cpp / wllama
 * rejects underscores (_) in non-terminal rule names.
 */
export const getYuliGrammar = (useHyphens = true): string => {
  const rules = useHyphens
    ? [
        'root ::= thought-block state-block dialogue-block',
        'thought-block ::= "<thought>" [^<]* "</thought>"',
        'state-block ::= "<state_vector><s:" hex-pair "></state_vector>"',
        'hex-pair ::= [0-9A-Fa-f] [0-9A-Fa-f]',
        'dialogue-block ::= [^\\x00]+',
      ]
    : [
        'root ::= thought_block state_block dialogue_block',
        'thought_block ::= "<thought>" [^<]* "</thought>"',
        'state_block ::= "<state_vector><s:" hex_pair "></state_vector>"',
        'hex_pair ::= [0-9A-Fa-f] [0-9A-Fa-f]',
        'dialogue_block ::= [^\\x00]+',
      ];
  return rules.join('\n');
};

export const YULI_STRICT_GBNF = getYuliGrammar(true);

export const YULI_STATE_ONLY_GBNF = [
  'root ::= "<state_vector><s:" hex-pair "></state_vector>"',
  'hex-pair ::= [0-9A-Fa-f] [0-9A-Fa-f]',
].join('\n');

export const YULI_JSON_ACTION_GBNF = [
  'root ::= "{" ws "\\"action\\"" ws ":" ws string ws "," ws "\\"state\\"" ws ":" ws "\\"" hex-pair "\\"" ws "}"',
  'hex-pair ::= [0-9A-Fa-f] [0-9A-Fa-f]',
  'string ::= "\\"" [^"\\\\]* "\\""',
  'ws ::= [ \\t\\n\\r]*',
].join('\n');
