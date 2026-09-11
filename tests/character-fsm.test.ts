import { describe, it, expect, vi } from 'vitest';
import { YuliCharacterFSM, FSMState } from '../src/fsm/character-fsm';
import { YuliClient } from '../src/client';
import { StateVector } from '../src/parser/ccd';
import { Vector4D } from '../src/vector/hypercube';

describe('YuliCharacterFSM Lifecycle & State Transitions', () => {
  it('executes the complete 7-state lifecycle on valid input', async () => {
    const stateTransitions: FSMState[] = [];

    const mockClient = {
      exportKVCacheState: vi.fn(() => new ArrayBuffer(64)),
      importKVCacheState: vi.fn(),
      prompt: vi.fn(async (_input, handlers) => {
        handlers?.onThought?.('Calculating best course of action...');
        handlers?.onState?.({ hex: '06', quadrant: 'SHADOW', rawBits: 6 } as StateVector);
        handlers?.onVectorUpdate?.([-1, 1, 1, -1] as Vector4D);
        handlers?.onToken?.('I ');
        handlers?.onToken?.('will ');
        handlers?.onToken?.('defend ');
        handlers?.onToken?.('you.');
        return {
          text: 'I will defend you.',
          state: { hex: '06', quadrant: 'SHADOW', rawBits: 6 } as StateVector,
          vector: [-1, 1, 1, -1] as Vector4D
        };
      })
    } as unknown as YuliClient;

    const character = new YuliCharacterFSM(mockClient, {
      id: 'companion-1',
      name: 'Yuli',
      systemPrompt: 'You are an authentic battle peer.',
      allowedIntents: ['ATTACK', 'DEFEND', 'TRADE']
    });

    character.on('stateTransition', (state: FSMState) => {
      stateTransitions.push(state);
    });

    expect(character.getState()).toBe('IDLE');

    const payload = await character.evaluateInput('Protect the carriage!');

    expect(payload.dialogue).toBe('I will defend you.');
    expect(payload.state.quadrant).toBe('SHADOW');
    expect(payload.vector4D).toEqual([-1, 1, 1, -1]);
    expect(payload.metrics.tokensGenerated).toBe(4);

    // Verify progression
    expect(stateTransitions).toContain('DELIBERATING');
    expect(stateTransitions).toContain('THINKING');
    expect(stateTransitions).toContain('VECTOR_UPDATE');
    expect(stateTransitions).toContain('STREAMING_DIALOGUE');
    expect(stateTransitions).toContain('IDLE_COOLDOWN');
  });

  it('injects live game telemetry into deliberation context', async () => {
    let capturedPrompt = '';

    const mockClient = {
      exportKVCacheState: vi.fn(() => new ArrayBuffer(64)),
      prompt: vi.fn(async (input) => {
        capturedPrompt = input;
        return {
          text: 'Acknowledged.',
          state: { hex: '00', quadrant: 'EGO', rawBits: 0 },
          vector: [-1, -1, -1, -1]
        };
      })
    } as unknown as YuliClient;

    const character = new YuliCharacterFSM(mockClient, {
      id: 'companion-1',
      name: 'Yuli',
      systemPrompt: 'Tactical peer.',
      telemetryProvider: {
        getMetrics: () => ({ partyHealthPct: 35, inCombat: true, gold: 120 })
      }
    });

    await character.evaluateInput('What should we do?');

    expect(capturedPrompt).toContain('What should we do?');
    expect(capturedPrompt).toContain('Live Game Telemetry');
    expect(capturedPrompt).toContain('"partyHealthPct":35');
    expect(capturedPrompt).toContain('"inCombat":true');
  });

  it('triggers automatic KV-cache snapshot rollback on inference error', async () => {
    const dummySnapshot = new ArrayBuffer(64);
    const mockImport = vi.fn();

    const mockClient = {
      exportKVCacheState: vi.fn(() => dummySnapshot),
      importKVCacheState: mockImport,
      prompt: vi.fn(async () => {
        throw new Error('Out of WASM Memory during generation');
      })
    } as unknown as YuliClient;

    const character = new YuliCharacterFSM(mockClient, {
      id: 'companion-1',
      name: 'Yuli',
      systemPrompt: 'Peer.',
      autoRollbackOnError: true
    });

    let caughtError: any = null;
    try {
      await character.evaluateInput('Trigger error');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    expect(character.getState()).toBe('ERROR');
    expect(mockImport).toHaveBeenCalledWith(dummySnapshot);
  });

  it('queues rapid inputs during IDLE_COOLDOWN and executes them automatically upon IDLE', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const mockClient = {
      exportKVCacheState: vi.fn(() => new ArrayBuffer(64)),
      prompt: vi.fn(async (input: string) => {
        callCount++;
        return {
          text: `Response to: ${input}`,
          state: { hex: '00', quadrant: 'EGO', rawBits: 0 },
          vector: [-1, -1, -1, -1]
        };
      })
    } as unknown as YuliClient;

    const character = new YuliCharacterFSM(mockClient, {
      id: 'clicker-npc',
      name: 'Yuli Clicker',
      systemPrompt: 'Fast click responder.',
      cooldownMs: 200,
      maxQueueSize: 2
    });

    // 1st input executes immediately
    const p1 = character.evaluateInput('Tap 1');
    expect(['DELIBERATING', 'THINKING']).toContain(character.getState());

    const res1 = await p1;
    expect(res1.dialogue).toBe('Response to: Tap 1');
    expect(character.getState()).toBe('IDLE_COOLDOWN');

    // Tap 2 arrives during 200ms IDLE_COOLDOWN window
    expect(character.canAcceptInput()).toBe(true);
    const p2 = character.evaluateInput('Tap 2');
    expect(character.getQueueLength()).toBe(1);

    // Tap 3 arrives during cooldown window
    const p3 = character.evaluateInput('Tap 3');
    expect(character.getQueueLength()).toBe(2);

    // Tap 4 arrives when bounded queue is full (size 2) -> throws immediately
    expect(character.canAcceptInput()).toBe(false);
    await expect(character.evaluateInput('Tap 4')).rejects.toThrow(/Cannot evaluate input while character is in state/);

    // Advance timers by 200ms to complete cooldown
    await vi.advanceTimersByTimeAsync(200);

    // p2 executes and completes, enters cooldown again
    const res2 = await p2;
    expect(res2.dialogue).toBe('Response to: Tap 2');
    expect(character.getQueueLength()).toBe(1);

    // Advance timers by another 200ms for Tap 3 to execute
    await vi.advanceTimersByTimeAsync(200);
    const res3 = await p3;
    expect(res3.dialogue).toBe('Response to: Tap 3');
    expect(character.getQueueLength()).toBe(0);

    // Advance timers to return to final IDLE
    await vi.advanceTimersByTimeAsync(200);
    expect(character.getState()).toBe('IDLE');
    expect(callCount).toBe(3);

    vi.useRealTimers();
  });
});
