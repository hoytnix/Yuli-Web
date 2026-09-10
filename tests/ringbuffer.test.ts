import { describe, it, expect } from 'vitest';
import {
  createSharedRingBuffer,
  TokenRingBufferWriter,
  TokenRingBufferReader,
  RingBufferStatus
} from '../src/ringbuffer/ring-buffer';

describe('Zero-Copy Token Ring Buffer', () => {
  it('writes and reads tokens sequentially', () => {
    const sab = createSharedRingBuffer(1024);
    const writer = new TokenRingBufferWriter(sab);
    const reader = new TokenRingBufferReader(sab);

    expect(reader.getStatus()).toBe(RingBufferStatus.IDLE);

    writer.setStatus(RingBufferStatus.STREAMING);
    expect(reader.getStatus()).toBe(RingBufferStatus.STREAMING);

    writer.write('Hello ');
    writer.write('world!');

    const received = reader.readAvailable();
    expect(received).toBe('Hello world!');

    // Further reads return empty string if no new data
    expect(reader.readAvailable()).toBe('');

    writer.setStatus(RingBufferStatus.COMPLETE);
    expect(reader.getStatus()).toBe(RingBufferStatus.COMPLETE);
  });

  it('handles circular buffer wrapping seamlessly', () => {
    // Small buffer capacity of 32 bytes to force wrap-around quickly
    const capacity = 32;
    const sab = createSharedRingBuffer(capacity);
    const writer = new TokenRingBufferWriter(sab);
    const reader = new TokenRingBufferReader(sab);

    // Write 20 bytes
    const chunk1 = '01234567890123456789'; // 20 bytes
    expect(writer.write(chunk1)).toBe(true);
    expect(reader.readAvailable()).toBe(chunk1);

    // Now write another 20 bytes (this will wrap past capacity 32)
    const chunk2 = 'abcdefghijklmnopqrst'; // 20 bytes
    expect(writer.write(chunk2)).toBe(true);
    expect(reader.readAvailable()).toBe(chunk2);

    // Flush should return empty string since already drained
    expect(reader.flush()).toBe('');
  });

  it('tracks state hex coordinates across threads', () => {
    const sab = createSharedRingBuffer(256);
    const writer = new TokenRingBufferWriter(sab);
    const reader = new TokenRingBufferReader(sab);

    writer.setStateHex('06');
    expect(reader.getStateHex()).toBe('06');

    writer.setStateHex('0F');
    expect(reader.getStateHex()).toBe('0F');
  });
});
