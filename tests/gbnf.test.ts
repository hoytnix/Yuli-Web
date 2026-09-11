import { describe, it, expect } from 'vitest';
import {
  getYuliGrammar,
  YULI_STRICT_GBNF,
  YULI_STATE_ONLY_GBNF,
  YULI_JSON_ACTION_GBNF,
} from '../src/grammar/gbnf';

describe('GBNF Grammar Definitions', () => {
  it('ensures getYuliGrammar() rules are explicitly joined by newlines without carriage returns', () => {
    const grammar = getYuliGrammar();
    expect(grammar).toBe(YULI_STRICT_GBNF);
    expect(grammar).not.toContain('\r');
    const lines = grammar.split('\n');
    expect(lines.length).toBe(5);
    expect(lines[0]).toBe('root ::= thought-block state-block dialogue-block');
    expect(lines[1]).toBe('thought-block ::= "<thought>" [^<]* "</thought>"');
    expect(lines[2]).toBe('state-block ::= "<state_vector><s:" hex-pair "></state_vector>"');
    expect(lines[3]).toBe('hex-pair ::= [0-9A-Fa-f] [0-9A-Fa-f]');
    expect(lines[4]).toBe('dialogue-block ::= [^\\x00]+');
  });

  it('supports legacy snake_case rule names via getYuliGrammar(false)', () => {
    const grammar = getYuliGrammar(false);
    expect(grammar).toContain('root ::= thought_block state_block dialogue_block');
    expect(grammar).toContain('thought_block ::= "<thought>" [^<]* "</thought>"');
  });

  it('ensures YULI_STATE_ONLY_GBNF rules are explicitly joined by newlines without carriage returns', () => {
    expect(YULI_STATE_ONLY_GBNF).not.toContain('\r');
    const lines = YULI_STATE_ONLY_GBNF.split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe('root ::= "<state_vector><s:" hex-pair "></state_vector>"');
    expect(lines[1]).toBe('hex-pair ::= [0-9A-Fa-f] [0-9A-Fa-f]');
  });

  it('ensures YULI_JSON_ACTION_GBNF rules are explicitly joined by newlines without carriage returns', () => {
    expect(YULI_JSON_ACTION_GBNF).not.toContain('\r');
    const lines = YULI_JSON_ACTION_GBNF.split('\n');
    expect(lines.length).toBe(4);
    expect(lines[0]).toBe('root ::= "{" ws "\\"action\\"" ws ":" ws string ws "," ws "\\"state\\"" ws ":" ws "\\"" hex-pair "\\"" ws "}"');
    expect(lines[1]).toBe('hex-pair ::= [0-9A-Fa-f] [0-9A-Fa-f]');
    expect(lines[2]).toBe('string ::= "\\"" [^"\\\\]* "\\""');
    expect(lines[3]).toBe('ws ::= [ \\t\\n\\r]*');
  });
});
