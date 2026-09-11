import { describe, it, expect, vi } from 'vitest';
import { DialoguePipeline } from '../src/dialogue/pipeline';

describe('DialoguePipeline Token Aggregation & Batching', () => {
  it('aggregates rapid tokens into batched deliveries without micro-task flooding', async () => {
    vi.useFakeTimers();

    const emittedTokens: string[] = [];
    let completedPayload: any = null;

    const pipeline = new DialoguePipeline({
      typewriter: {
        tickIntervalMs: 5,
        charactersPerTick: 2
      },
      onCharacter: (char) => {
        emittedTokens.push(char);
      },
      onComplete: (payload) => {
        completedPayload = payload;
      }
    });

    // Rapid 100 TPS burst feeding chunks without delay
    const streamChunks = [
      '<thought>Analyzing player query...</thought>',
      '<state_vector><s:05></state_vector>',
      '<action><intent>GREET</intent><value>10</value></action>',
      'Hello ',
      'there, ',
      'traveler! ',
      'Welcome to ',
      'our village.'
    ];

    for (const chunk of streamChunks) {
      pipeline.feed(chunk);
    }

    // Pending dialogue is buffered and full dialogue captures the total stream
    expect(pipeline.getFullDialogue()).toBe('Hello there, traveler! Welcome to our village.');
    expect(pipeline.getFullThought()).toBe('Analyzing player query...');
    expect(pipeline.getLatestState().hex).toBe('05');
    expect(pipeline.getParsedAction()?.intent).toBe('GREET');
    expect(pipeline.getParsedAction()?.value).toBe(10);

    // Run micro-tick batch flush
    await vi.advanceTimersByTimeAsync(1);

    // Advance typewriter ticks to finish rendering
    await vi.advanceTimersByTimeAsync(500);
    pipeline.complete();
    await vi.advanceTimersByTimeAsync(500);

    expect(completedPayload).not.toBeNull();
    expect(completedPayload.dialogue).toBe('Hello there, traveler! Welcome to our village.');
    expect(completedPayload.state.hex).toBe('05');
    expect(completedPayload.action.intent).toBe('GREET');

    vi.useRealTimers();
  });

  it('immediately flushes pending batch when complete() or skipTypewriter() is called', () => {
    let completedResult: any = null;

    const pipeline = new DialoguePipeline({
      onComplete: (res) => {
        completedResult = res;
      }
    });

    pipeline.feed('Instant text delivery');
    pipeline.complete();
    pipeline.skipTypewriter();

    expect(completedResult).not.toBeNull();
    expect(completedResult.dialogue).toBe('Instant text delivery');
  });

  it('resets buffer and cancels scheduled batch cleanly', () => {
    const pipeline = new DialoguePipeline();
    pipeline.feed('Unfinished stream that gets canceled');
    pipeline.reset();

    expect(pipeline.getFullDialogue()).toBe('');
    expect(pipeline.getFullThought()).toBe('');
  });
});
