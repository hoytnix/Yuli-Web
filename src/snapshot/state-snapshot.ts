import { StateVector, Quadrant, parseCoordinate } from '../parser/ccd';
import { Vector4D } from '../vector/hypercube';
import { ChatMessage } from '../client';

export interface YuliSnapshot {
  timestamp: number;
  state: StateVector;
  vector4D: Vector4D;
  history: ChatMessage[];
  metadata?: Record<string, any>;
}

const MAGIC = 0x59554c49; // 'YULI' in ASCII hex
const VERSION = 1;

const QUADRANTS: Quadrant[] = ['EGO', 'SHADOW', 'SUBCONSCIOUS', 'SUPEREGO'];

/**
 * Serializes conversation history, cognitive hypercube state, and 4D vectors
 * into a compact binary ArrayBuffer checkpoint.
 */
export function serializeStateSnapshot(snapshot: YuliSnapshot): ArrayBuffer {
  const encoder = new TextEncoder();
  const jsonPayload = JSON.stringify({
    history: snapshot.history,
    metadata: snapshot.metadata || {}
  });
  const payloadBytes = encoder.encode(jsonPayload);

  // Layout:
  // 4 bytes: Magic 'YULI'
  // 2 bytes: Version (Uint16)
  // 8 bytes: Timestamp (Float64)
  // 1 byte:  rawBits (Uint8)
  // 1 byte:  quadrantIndex (Uint8)
  // 16 bytes: 4x Float32 for Vector4D
  // 4 bytes: payload length (Uint32)
  // N bytes: UTF-8 JSON payload
  const headerSize = 4 + 2 + 8 + 1 + 1 + 16 + 4; // 36 bytes
  const buffer = new ArrayBuffer(headerSize + payloadBytes.length);
  const view = new DataView(buffer);

  let offset = 0;
  view.setUint32(offset, MAGIC, false); // Big-endian
  offset += 4;

  view.setUint16(offset, VERSION, false);
  offset += 2;

  view.setFloat64(offset, snapshot.timestamp, false);
  offset += 8;

  view.setUint8(offset, snapshot.state.rawBits);
  offset += 1;

  const qIdx = Math.max(0, QUADRANTS.indexOf(snapshot.state.quadrant));
  view.setUint8(offset, qIdx);
  offset += 1;

  for (let i = 0; i < 4; i++) {
    view.setFloat32(offset, snapshot.vector4D[i], false);
    offset += 4;
  }

  view.setUint32(offset, payloadBytes.length, false);
  offset += 4;

  new Uint8Array(buffer, offset).set(payloadBytes);

  return buffer;
}

/**
 * Deserializes an ArrayBuffer into a complete YuliSnapshot.
 */
export function deserializeStateSnapshot(buffer: ArrayBuffer): YuliSnapshot {
  if (buffer.byteLength < 36) {
    throw new Error('Invalid snapshot buffer: buffer too small');
  }

  const view = new DataView(buffer);
  let offset = 0;

  const magic = view.getUint32(offset, false);
  offset += 4;
  if (magic !== MAGIC) {
    throw new Error('Invalid snapshot buffer: magic mismatch (expected YULI)');
  }

  const version = view.getUint16(offset, false);
  offset += 2;
  if (version !== VERSION) {
    throw new Error(`Unsupported snapshot version: ${version}`);
  }

  const timestamp = view.getFloat64(offset, false);
  offset += 8;

  const rawBits = view.getUint8(offset);
  offset += 1;

  const qIdx = view.getUint8(offset);
  offset += 1;
  const quadrant = QUADRANTS[qIdx] || 'EGO';

  const vector4D: Vector4D = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    vector4D[i] = view.getFloat32(offset, false);
    offset += 4;
  }

  const payloadLength = view.getUint32(offset, false);
  offset += 4;

  if (buffer.byteLength < offset + payloadLength) {
    throw new Error('Truncated snapshot payload');
  }

  const payloadBytes = new Uint8Array(buffer, offset, payloadLength);
  const decoder = new TextDecoder();
  const parsed = JSON.parse(decoder.decode(payloadBytes));

  const hex = rawBits.toString(16).toUpperCase().padStart(2, '0');
  const state: StateVector = {
    hex,
    quadrant,
    rawBits
  };

  return {
    timestamp,
    state,
    vector4D,
    history: parsed.history || [],
    metadata: parsed.metadata
  };
}
