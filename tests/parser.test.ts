import { describe, it, expect } from 'vitest';
import { CCDStreamParser, parseCoordinate } from '../src/parser/ccd';

describe('Cognitive Coordinate Mapping', () => {
  it('correctly maps hypercube states to 4-Sides-of-the-Mind quadrants', () => {
    expect(parseCoordinate('00').quadrant).toBe('EGO');
    expect(parseCoordinate('02').quadrant).toBe('EGO');
    expect(parseCoordinate('06').quadrant).toBe('SHADOW');
    expect(parseCoordinate('07').quadrant).toBe('SHADOW');
    expect(parseCoordinate('09').quadrant).toBe('SUBCONSCIOUS');
    expect(parseCoordinate('0F').quadrant).toBe('SUPEREGO');
  });
});

describe('CCDStreamParser', () => {
  it('strips <thought> traces and extracts <state_vector> cleanly', () => {
    const tokensReceived: string[] = [];
    let capturedState: any = null;
    let capturedThought: string = '';

    const parser = new CCDStreamParser({
      onToken: (t) => tokensReceived.push(t),
      onState: (s) => { capturedState = s; },
      onThought: (th) => { capturedThought += th; }
    });

    const streamChunks = [
      '<thought>',
      '<dna><s:00><d:2+><s:02></dna>',
      'Analyzing food budget constraints and ramen recipe ingredients.',
      '</thought>',
      '<state_vector><s:06></state_vector>',
      'You are ',
      'spending too much on ',
      'instant broth packets.'
    ];

    for (const chunk of streamChunks) {
      parser.feed(chunk);
    }
    parser.flush();

    expect(capturedThought).toContain('Analyzing food budget constraints');
    expect(capturedState).not.toBeNull();
    expect(capturedState.hex).toBe('06');
    expect(capturedState.quadrant).toBe('SHADOW');
    expect(tokensReceived.join('')).toBe('You are spending too much on instant broth packets.');
  });
});
