import { describe, it, expect } from 'vitest';
import {
  serializeStateSnapshot,
  deserializeStateSnapshot,
  YuliSnapshot
} from '../src/snapshot/state-snapshot';

describe('KV-Cache & State Snapshot Serialization', () => {
  it('serializes and deserializes snapshot round-trip faithfully', () => {
    const original: YuliSnapshot = {
      timestamp: 1726000000000,
      state: { hex: '06', quadrant: 'SHADOW', rawBits: 6 },
      vector4D: [-1, 1, 1, -1],
      history: [
        { role: 'system', content: 'You are Yuli.' },
        { role: 'user', content: 'What is the recipe budget?' },
        { role: 'assistant', content: 'Too expensive!', state: { hex: '06', quadrant: 'SHADOW', rawBits: 6 } }
      ],
      metadata: { saveSlot: 1, chapter: 'Intro' }
    };

    const buffer = serializeStateSnapshot(original);
    expect(buffer.byteLength).toBeGreaterThan(36);

    const restored = deserializeStateSnapshot(buffer);
    expect(restored.timestamp).toBe(original.timestamp);
    expect(restored.state.hex).toBe('06');
    expect(restored.state.quadrant).toBe('SHADOW');
    expect(restored.state.rawBits).toBe(6);
    expect(restored.vector4D).toEqual([-1, 1, 1, -1]);
    expect(restored.history).toEqual(original.history);
    expect(restored.metadata).toEqual(original.metadata);
  });

  it('rejects buffers with invalid magic header', () => {
    const buffer = new ArrayBuffer(50);
    const view = new DataView(buffer);
    view.setUint32(0, 0x12345678, false); // Wrong magic
    expect(() => deserializeStateSnapshot(buffer)).toThrow('magic mismatch');
  });

  it('rejects buffers that are too small', () => {
    const buffer = new ArrayBuffer(20);
    expect(() => deserializeStateSnapshot(buffer)).toThrow('buffer too small');
  });
});
