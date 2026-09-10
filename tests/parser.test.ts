import { describe, it, expect } from 'vitest';
import { CCDStreamParser, parseCoordinate } from '../src/parser/ccd';
import { Vector4D } from '../src/vector/hypercube';

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

  it('tracks continuous 4D vector updates and delta tokens', () => {
    const vectorUpdates: Vector4D[] = [];

    const parser = new CCDStreamParser({
      onToken: () => {},
      onState: () => {},
      onThought: () => {},
      onVectorUpdate: (v) => vectorUpdates.push(v)
    });

    // Feed a thought containing delta token <d:2+>
    parser.feed('<thought><d:2+></thought>');
    // Delta applied to initial [-1, -1, -1, -1] on dimension 2 -> [-1, -1, -0.75, -1]
    expect(vectorUpdates.length).toBe(1);
    expect(vectorUpdates[0][2]).toBe(-0.75);

    // Feed explicit state vector <s:06> -> 0110_2 -> [-1, 1, 1, -1]
    parser.feed('<state_vector><s:06></state_vector>');
    expect(vectorUpdates.length).toBe(2);
    expect(vectorUpdates[1]).toEqual([-1, 1, 1, -1]);
  });
});
