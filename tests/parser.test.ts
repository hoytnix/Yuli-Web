import { describe, it, expect } from 'vitest';
import { CCDStreamParser, parseCoordinate } from '../src/parser/ccd';
import { Vector4D } from '../src/vector/hypercube';
import { parseModelResponse } from '../src/dialogue/pipeline';

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

  it('safely handles closing tag </thought> split across chunk boundaries', () => {
    const tokensReceived: string[] = [];
    let capturedThought: string = '';
    let capturedState: any = null;

    const parser = new CCDStreamParser({
      onToken: (t) => tokensReceived.push(t),
      onState: (s) => { capturedState = s; },
      onThought: (th) => { capturedThought += th; }
    });

    // Chunk splits </thought> across boundary: "</thou" and "ght>"
    parser.feed('<thought>Deep cognitive reasoning </thou');
    parser.feed('ght><state_vector><s:03></state_vector>Fresh ramen noodles.');
    parser.flush();

    expect(capturedThought.trim()).toBe('Deep cognitive reasoning');
    expect(capturedState?.hex).toBe('03');
    expect(tokensReceived.join('')).toBe('Fresh ramen noodles.');
  });

  it('strips orphan closing tags and prevents tag bleeding into dialogue', () => {
    const tokensReceived: string[] = [];
    let capturedState: any = null;

    const parser = new CCDStreamParser({
      onToken: (t) => tokensReceived.push(t),
      onState: (s) => { capturedState = s; },
      onThought: () => {}
    });

    // Model starts directly with orphan closing tags
    parser.feed('</thought><state_vector><s:01></state_vector>Clean dialogue without raw XML.');
    parser.flush();

    expect(capturedState?.hex).toBe('01');
    const dialogue = tokensReceived.join('');
    expect(dialogue).not.toContain('</thought>');
    expect(dialogue).not.toContain('<state_vector>');
    expect(dialogue).not.toContain('</state_vector>');
    expect(dialogue).toBe('Clean dialogue without raw XML.');
  });
});

describe('parseModelResponse Helper', () => {
  it('extracts thought, state vector, and completely strips all tags from dialogue', () => {
    const rawOutput = '<thought>Let me check the budget.</thought><state_vector><s:08></state_vector>We should invest in chashu pork.';
    const result = parseModelResponse(rawOutput);

    expect(result.thought).toBe('Let me check the budget.');
    expect(result.state).toBe('<s:08>');
    expect(result.dialogue).toBe('We should invest in chashu pork.');
  });

  it('handles standard thought and state vector without bleeding tags into dialogue', () => {
    const rawOutput = '<thought>Thinking hard</thought><state_vector><s:02></state_vector>Stick to the broth! <s:02>';
    const result = parseModelResponse(rawOutput);

    expect(result.thought).toBe('Thinking hard');
    expect(result.state).toBe('<s:02>');
    expect(result.dialogue).not.toContain('</thought>');
    expect(result.dialogue).not.toContain('<state_vector>');
    expect(result.dialogue).not.toContain('</state_vector>');
    expect(result.dialogue).not.toContain('<s:02>');
    expect(result.dialogue).toBe('Stick to the broth!');
  });

  it('handles tension tags and purges XML from dialogue', () => {
    const rawOutput = '<state_vector><s:0C></state_vector>Hold the line.<tension level="0.8"></tension>';
    const result = parseModelResponse(rawOutput);

    expect(result.state).toBe('<s:0C>');
    expect(result.dialogue).not.toContain('<tension');
    expect(result.dialogue).toBe('Hold the line.');
  });

  it('handles empty raw output safely', () => {
    const result = parseModelResponse('');
    expect(result).toEqual({ thought: '', state: '<s:00>', dialogue: '' });
  });

  it('handles thought-only outputs', () => {
    const rawOutput = '<thought>Only thought generated</thought>';
    const result = parseModelResponse(rawOutput);

    expect(result.thought).toBe('Only thought generated');
  });

  it('heuristically extracts untagged thought leaks at the top of output', () => {
    const rawOutput = 'Evaluating the pairing of spicy miso and rich pork broth...\nYou should definitely order an extra egg.';
    const result = parseModelResponse(rawOutput);

    expect(result.thought).toBe('Evaluating the pairing of spicy miso and rich pork broth...');
    expect(result.state).toBe('<s:00>');
    expect(result.dialogue).toBe('You should definitely order an extra egg.');
  });

  it('handles malformed tag order where thought follows state vector before stray </thought>', () => {
    const rawOutput = '<thought></thought><state_vector><s:04></state_vector>\nCritical inspection of current noodle inventory debt.\n</thought>\nCut portion sizes by 15% immediately.';
    const result = parseModelResponse(rawOutput);

    expect(result.thought).toBe('Critical inspection of current noodle inventory debt.');
    expect(result.state).toBe('<s:04>');
    expect(result.dialogue).toBe('Cut portion sizes by 15% immediately.');
  });

  it('heuristically isolates using-indicator thoughts when on leading line', () => {
    const rawOutput = 'Using the recipe ROI formula to maximize broth margins.\nWe should invest in chashu pork.';
    const result = parseModelResponse(rawOutput);

    expect(result.thought).toBe('Using the recipe ROI formula to maximize broth margins.');
    expect(result.dialogue).toBe('We should invest in chashu pork.');
  });
});
