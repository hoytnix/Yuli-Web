import { describe, it, expect, vi } from 'vitest';
import { TypewriterBuffer } from '../src/dialogue/typewriter';

describe('Real-Time Typewriter Buffer', () => {
  it('renders characters smoothly via ticks', async () => {
    const charsReceived: string[] = [];
    let completedText: string = '';

    const typewriter = new TypewriterBuffer({
      tickIntervalMs: 5,
      punctuationDelays: {},
      onCharacter: (char) => charsReceived.push(char),
      onComplete: (text) => { completedText = text; }
    });

    typewriter.feed('Hello');
    typewriter.markStreamComplete();

    // Await processing
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(charsReceived.join('')).toBe('Hello');
    expect(completedText).toBe('Hello');
    expect(typewriter.isRendering()).toBe(false);
  });

  it('triggers punctuation callbacks', async () => {
    const punctuations: string[] = [];

    const typewriter = new TypewriterBuffer({
      tickIntervalMs: 5,
      punctuationDelays: { '!': 10 },
      onPunctuation: (p) => punctuations.push(p)
    });

    typewriter.feed('Ready!');
    typewriter.markStreamComplete();

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(punctuations).toContain('!');
    expect(typewriter.getRenderedText()).toBe('Ready!');
  });

  it('flushes immediately on skip()', () => {
    let completed = false;

    const typewriter = new TypewriterBuffer({
      tickIntervalMs: 100,
      onComplete: () => { completed = true; }
    });

    typewriter.feed('Long dialogue sentence queued up.');
    expect(typewriter.isRendering()).toBe(true);

    typewriter.skip();

    expect(typewriter.getRenderedText()).toBe('Long dialogue sentence queued up.');
    expect(typewriter.isRendering()).toBe(false);
    expect(completed).toBe(true);
  });
});
