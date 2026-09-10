import { describe, it, expect } from 'vitest';
import {
  coordinateToVector,
  vectorToCoordinate,
  applyVectorDelta,
  blendVectors,
  vectorDistance,
  Vector4D
} from '../src/vector/hypercube';

describe('Hypercube 4D Vector Mapping', () => {
  it('maps discrete 4-bit states to [-1, 1]^4 correctly', () => {
    // 0x00 = 0000_2 -> [-1, -1, -1, -1]
    expect(coordinateToVector(0x00)).toEqual([-1, -1, -1, -1]);

    // 0x03 = 0011_2 -> [-1, -1, 1, 1]
    expect(coordinateToVector(0x03)).toEqual([-1, -1, 1, 1]);

    // 0x06 = 0110_2 -> [-1, 1, 1, -1] (Shadow)
    expect(coordinateToVector(0x06)).toEqual([-1, 1, 1, -1]);

    // 0x09 = 1001_2 -> [1, -1, -1, 1] (Subconscious)
    expect(coordinateToVector(0x09)).toEqual([1, -1, -1, 1]);

    // 0x0F = 1111_2 -> [1, 1, 1, 1] (Superego)
    expect(coordinateToVector(0x0F)).toEqual([1, 1, 1, 1]);
  });

  it('converts continuous vectors back to nearest discrete coordinates', () => {
    expect(vectorToCoordinate([-1, -1, -1, -1]).hex).toBe('00');
    expect(vectorToCoordinate([-0.8, -0.9, 0.2, 0.4]).hex).toBe('03');
    expect(vectorToCoordinate([-0.5, 0.8, 0.7, -0.9]).hex).toBe('06');
    expect(vectorToCoordinate([-0.5, 0.8, 0.7, -0.9]).quadrant).toBe('SHADOW');
    expect(vectorToCoordinate([0.9, 0.9, 0.9, 0.9]).hex).toBe('0F');
    expect(vectorToCoordinate([0.9, 0.9, 0.9, 0.9]).quadrant).toBe('SUPEREGO');
  });

  it('applies vector deltas with [-1, 1] clamping', () => {
    const initial: Vector4D = [0, 0, 0, 0];
    const updated = applyVectorDelta(initial, 2, 0.5);
    expect(updated).toEqual([0, 0, 0.5, 0]);

    // Test clamping at +1
    const clampedMax = applyVectorDelta([0, 0, 0.9, 0], 2, 0.5);
    expect(clampedMax[2]).toBe(1);

    // Test clamping at -1
    const clampedMin = applyVectorDelta([0, 0, -0.9, 0], 2, -0.5);
    expect(clampedMin[2]).toBe(-1);
  });

  it('interpolates vectors smoothly using EMA blending', () => {
    const current: Vector4D = [-1, -1, -1, -1];
    const target: Vector4D = [1, 1, 1, 1];

    // Alpha = 0.5 -> exact midpoint [0, 0, 0, 0]
    const blended = blendVectors(current, target, 0.5);
    expect(blended).toEqual([0, 0, 0, 0]);

    // Alpha = 1.0 -> snap to target
    const snapped = blendVectors(current, target, 1.0);
    expect(snapped).toEqual([1, 1, 1, 1]);

    // Alpha = 0.0 -> no change
    const untouched = blendVectors(current, target, 0.0);
    expect(untouched).toEqual([-1, -1, -1, -1]);
  });

  it('computes Euclidean distance in 4D', () => {
    const a: Vector4D = [0, 0, 0, 0];
    const b: Vector4D = [1, 1, 1, 1];
    expect(vectorDistance(a, b)).toBe(2); // sqrt(1+1+1+1) = 2
  });
});
