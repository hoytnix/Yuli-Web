import { describe, it, expect } from 'vitest';
import { compileActionGrammar, parseActionTag } from '../src/fsm/action-grammar';

describe('Action Grammar & Dynamic GBNF Compiler', () => {
  it('compiles standard GBNF when no allowedIntents are provided', () => {
    const grammar = compileActionGrammar();
    expect(grammar).toContain('root ::= thought-block state-block dialogue-block');
    expect(grammar).not.toContain('action-block');
  });

  it('compiles dynamic action grammar with custom intents', () => {
    type GameIntents = 'ATTACK' | 'DEFEND' | 'BRIBE' | 'FLEE';
    const intents: GameIntents[] = ['ATTACK', 'DEFEND', 'BRIBE', 'FLEE'];
    const grammar = compileActionGrammar(intents);

    expect(grammar).toContain('root ::= thought-block state-block action-block dialogue-block');
    expect(grammar).toContain('"ATTACK" | "DEFEND" | "BRIBE" | "FLEE"');
    expect(grammar).toContain('opt-value');
    expect(grammar).toContain('opt-payload');
  });

  it('parses valid action tags with value and JSON payload', () => {
    const tag = '<action><intent>ATTACK</intent><value>45</value><payload>{"target":"goblin_boss"}</payload></action>';
    const parsed = parseActionTag(tag);

    expect(parsed).not.toBeNull();
    expect(parsed?.intent).toBe('ATTACK');
    expect(parsed?.modifierValue).toBe(45);
    expect(parsed?.payloadData).toEqual({ target: 'goblin_boss' });
  });

  it('parses action tags with only intent', () => {
    const tag = '<action><intent>DEFEND</intent></action>';
    const parsed = parseActionTag(tag);

    expect(parsed).not.toBeNull();
    expect(parsed?.intent).toBe('DEFEND');
    expect(parsed?.modifierValue).toBeUndefined();
    expect(parsed?.payloadData).toBeUndefined();
  });

  it('returns null for text without valid action tags', () => {
    expect(parseActionTag('Regular dialogue without action tag')).toBeNull();
    expect(parseActionTag('<action><incomplete>')).toBeNull();
  });
});
