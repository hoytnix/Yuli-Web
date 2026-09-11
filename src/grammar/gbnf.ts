/**
 * GBNF (GGML Backus-Naur Form) grammar definitions for grammar-constrained decoding.
 * Enforces strict XML structural compliance at the WASM sampler level.
 */

export const YULI_STRICT_GBNF = [
  'root ::= thought_block state_block dialogue_block',
  'thought_block ::= "<thought>" [^<]* "</thought>"',
  'state_block ::= "<state_vector><s:" hex_pair "></state_vector>"',
  'hex_pair ::= [0-9A-Fa-f] [0-9A-Fa-f]',
  'dialogue_block ::= [^\\x00]+',
].join('\n');

export const YULI_STATE_ONLY_GBNF = [
  'root ::= "<state_vector><s:" hex_pair "></state_vector>"',
  'hex_pair ::= [0-9A-Fa-f] [0-9A-Fa-f]',
].join('\n');

export const YULI_JSON_ACTION_GBNF = [
  'root ::= "{" ws "\\"action\\"" ws ":" ws string ws "," ws "\\"state\\"" ws ":" ws "\\"" hex_pair "\\"" ws "}"',
  'hex_pair ::= [0-9A-Fa-f] [0-9A-Fa-f]',
  'string ::= "\\"" [^"\\\\]* "\\""',
  'ws ::= [ \\t\\n\\r]*',
].join('\n');
