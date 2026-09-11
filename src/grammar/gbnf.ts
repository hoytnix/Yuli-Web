/**
 * GBNF (GGML Backus-Naur Form) grammar definitions for grammar-constrained decoding.
 * Enforces strict XML structural compliance at the WASM sampler level.
 */

export const YULI_STRICT_GBNF = [
  'root ::= thought-block state-block dialogue-block',
  'thought-block ::= "<thought>" [^<]* "</thought>"',
  'state-block ::= "<state_vector><s:" hex-pair "></state_vector>"',
  'hex-pair ::= [0-9A-Fa-f] [0-9A-Fa-f]',
  'dialogue-block ::= [^\\x00]+',
].join('\n');

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
