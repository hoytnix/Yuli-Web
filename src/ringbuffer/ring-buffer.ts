/**
 * Zero-Copy Token Ring Buffer implemented over SharedArrayBuffer.
 * Provides lock-free circular streaming between Worker and Main Thread.
 */

export const RING_BUFFER_HEADER_BYTES = 32;
export const DEFAULT_RING_BUFFER_CAPACITY = 256 * 1024; // 256 KB circular payload

export enum RingBufferStatus {
  IDLE = 0,
  STREAMING = 1,
  COMPLETE = 2,
  ERROR = 3
}

// Header Int32 indices (32 bytes = 8 x Int32)
const IDX_READ = 0;
const IDX_WRITE = 1;
const IDX_CAPACITY = 2;
const IDX_STATUS = 3;
const IDX_SEQUENCE = 4;
const IDX_STATE_HEX = 5;
const IDX_ERROR_CODE = 6;
const IDX_RESERVED = 7;

export function isSharedArrayBufferSupported(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

export function createSharedRingBuffer(capacity: number = DEFAULT_RING_BUFFER_CAPACITY): SharedArrayBuffer {
  if (!isSharedArrayBufferSupported()) {
    throw new Error('SharedArrayBuffer is not supported in this browser environment. Ensure COOP/COEP headers are set.');
  }
  const totalBytes = RING_BUFFER_HEADER_BYTES + capacity;
  const sab = new SharedArrayBuffer(totalBytes);
  const header = new Int32Array(sab, 0, 8);
  header[IDX_READ] = 0;
  header[IDX_WRITE] = 0;
  header[IDX_CAPACITY] = capacity;
  header[IDX_STATUS] = RingBufferStatus.IDLE;
  header[IDX_SEQUENCE] = 0;
  header[IDX_STATE_HEX] = 0;
  header[IDX_ERROR_CODE] = 0;
  header[IDX_RESERVED] = 0;
  return sab;
}

export class TokenRingBufferWriter {
  private header: Int32Array;
  private data: Uint8Array;
  private capacity: number;
  private encoder: TextEncoder;

  constructor(sab: SharedArrayBuffer) {
    this.header = new Int32Array(sab, 0, 8);
    this.capacity = this.header[IDX_CAPACITY];
    this.data = new Uint8Array(sab, RING_BUFFER_HEADER_BYTES, this.capacity);
    this.encoder = new TextEncoder();
  }

  public reset(): void {
    Atomics.store(this.header, IDX_READ, 0);
    Atomics.store(this.header, IDX_WRITE, 0);
    Atomics.store(this.header, IDX_STATUS, RingBufferStatus.IDLE);
    Atomics.store(this.header, IDX_SEQUENCE, 0);
    Atomics.store(this.header, IDX_STATE_HEX, 0);
    Atomics.store(this.header, IDX_ERROR_CODE, 0);
  }

  public setStatus(status: RingBufferStatus): void {
    Atomics.store(this.header, IDX_STATUS, status);
    Atomics.notify(this.header, IDX_STATUS);
  }

  public setStateHex(hex: string): void {
    const val = parseInt(hex.trim(), 16) || 0;
    Atomics.store(this.header, IDX_STATE_HEX, val);
  }

  public write(token: string): boolean {
    const bytes = this.encoder.encode(token);
    if (bytes.length === 0) return true;

    const readPos = Atomics.load(this.header, IDX_READ);
    const writePos = Atomics.load(this.header, IDX_WRITE);

    // Compute available space
    const available = writePos >= readPos
      ? this.capacity - (writePos - readPos) - 1
      : (readPos - writePos) - 1;

    if (bytes.length > available) {
      // Ring buffer overflow, cannot fit chunk without overwriting unread data
      return false;
    }

    // Write bytes into circular buffer
    const firstPart = Math.min(bytes.length, this.capacity - writePos);
    this.data.set(bytes.subarray(0, firstPart), writePos);

    if (bytes.length > firstPart) {
      const secondPart = bytes.length - firstPart;
      this.data.set(bytes.subarray(firstPart, bytes.length), 0);
    }

    const nextWritePos = (writePos + bytes.length) % this.capacity;
    Atomics.store(this.header, IDX_WRITE, nextWritePos);
    Atomics.add(this.header, IDX_SEQUENCE, 1);
    Atomics.notify(this.header, IDX_WRITE);

    return true;
  }
}

export class TokenRingBufferReader {
  private header: Int32Array;
  private data: Uint8Array;
  private capacity: number;
  private decoder: TextDecoder;

  constructor(sab: SharedArrayBuffer) {
    this.header = new Int32Array(sab, 0, 8);
    this.capacity = this.header[IDX_CAPACITY];
    this.data = new Uint8Array(sab, RING_BUFFER_HEADER_BYTES, this.capacity);
    this.decoder = new TextDecoder('utf-8');
  }

  public getStatus(): RingBufferStatus {
    return Atomics.load(this.header, IDX_STATUS);
  }

  public getStateHex(): string {
    const raw = Atomics.load(this.header, IDX_STATE_HEX);
    return raw.toString(16).toUpperCase().padStart(2, '0');
  }

  public readAvailable(): string {
    const readPos = Atomics.load(this.header, IDX_READ);
    const writePos = Atomics.load(this.header, IDX_WRITE);

    if (readPos === writePos) return '';

    let bytes: Uint8Array;
    if (writePos > readPos) {
      const len = writePos - readPos;
      bytes = this.data.slice(readPos, writePos);
      Atomics.store(this.header, IDX_READ, writePos);
    } else {
      // Wraps around buffer end
      const firstLen = this.capacity - readPos;
      const totalLen = firstLen + writePos;
      bytes = new Uint8Array(totalLen);
      bytes.set(this.data.subarray(readPos, this.capacity), 0);
      bytes.set(this.data.subarray(0, writePos), firstLen);
      Atomics.store(this.header, IDX_READ, writePos);
    }

    return this.decoder.decode(bytes, { stream: true });
  }

  public flush(): string {
    const text = this.readAvailable();
    return text + this.decoder.decode();
  }

  public reset(): void {
    Atomics.store(this.header, IDX_READ, 0);
    Atomics.store(this.header, IDX_WRITE, 0);
    Atomics.store(this.header, IDX_STATUS, RingBufferStatus.IDLE);
  }
}
