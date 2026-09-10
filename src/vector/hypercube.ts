import { Quadrant } from '../parser/ccd';

/**
 * 4D Hypercube Vector representing continuous emotional/cognitive coordinate in [-1, 1]^4
 * [v3, v2, v1, v0] where:
 * - v3: Subconscious/Superego axis (+1) vs Ego/Shadow axis (-1)
 * - v2: Shadow/Superego axis (+1) vs Ego/Subconscious axis (-1)
 * - v1, v0: Intra-quadrant dialectical dimensions
 */
export type Vector4D = [number, number, number, number];

/**
 * Maps a discrete 4-bit hypercube coordinate (0x00 - 0x0F) into continuous [-1, 1]^4 vector space.
 */
export function coordinateToVector(rawBits: number): Vector4D {
  const clamped = Math.max(0, Math.min(15, rawBits & 0x0f));
  const b3 = (clamped >> 3) & 1;
  const b2 = (clamped >> 2) & 1;
  const b1 = (clamped >> 1) & 1;
  const b0 = clamped & 1;

  return [
    b3 * 2 - 1,
    b2 * 2 - 1,
    b1 * 2 - 1,
    b0 * 2 - 1
  ];
}

/**
 * Converts continuous Vector4D to the nearest discrete 4-bit coordinate.
 */
export function vectorToCoordinate(v: Vector4D): { hex: string; rawBits: number; quadrant: Quadrant } {
  const b3 = v[0] >= 0 ? 1 : 0;
  const b2 = v[1] >= 0 ? 1 : 0;
  const b1 = v[2] >= 0 ? 1 : 0;
  const b0 = v[3] >= 0 ? 1 : 0;

  const rawBits = (b3 << 3) | (b2 << 2) | (b1 << 1) | b0;
  const hex = rawBits.toString(16).toUpperCase().padStart(2, '0');

  let quadrant: Quadrant = 'EGO';
  if (rawBits >= 0x00 && rawBits <= 0x03) quadrant = 'EGO';
  else if (rawBits >= 0x04 && rawBits <= 0x07) quadrant = 'SHADOW';
  else if (rawBits >= 0x08 && rawBits <= 0x0b) quadrant = 'SUBCONSCIOUS';
  else quadrant = 'SUPEREGO';

  return { hex, rawBits, quadrant };
}

/**
 * Applies a delta token update (dimension index 0..3 with delta value) to an existing Vector4D,
 * clamping components strictly to [-1, 1].
 */
export function applyVectorDelta(v: Vector4D, dimension: number, delta: number): Vector4D {
  if (dimension < 0 || dimension > 3) return [...v] as Vector4D;
  const next: Vector4D = [...v] as Vector4D;
  next[dimension] = Math.max(-1, Math.min(1, next[dimension] + delta));
  return next;
}

/**
 * Smooth exponential moving average (EMA) interpolation between current and target vector.
 * @param current Current vector
 * @param target Target vector
 * @param alpha Smoothing factor in [0, 1]. 1 = snap instantly, 0 = no change.
 */
export function blendVectors(current: Vector4D, target: Vector4D, alpha: number = 0.15): Vector4D {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return [
    current[0] * (1 - clampedAlpha) + target[0] * clampedAlpha,
    current[1] * (1 - clampedAlpha) + target[1] * clampedAlpha,
    current[2] * (1 - clampedAlpha) + target[2] * clampedAlpha,
    current[3] * (1 - clampedAlpha) + target[3] * clampedAlpha
  ];
}

/**
 * Computes the Euclidean distance between two 4D hypercube vectors.
 */
export function vectorDistance(a: Vector4D, b: Vector4D): number {
  const d0 = a[0] - b[0];
  const d1 = a[1] - b[1];
  const d2 = a[2] - b[2];
  const d3 = a[3] - b[3];
  return Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3);
}
