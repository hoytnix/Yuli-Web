/**
 * @yuli/web - Edge Cognitive Engine
 * 
 * Licensed under the Business Source License 1.1 (BSL 1.1).
 * Free for individuals and studios earning under $30,000 USD gross annual revenue.
 * For commercial operations >= $30,000 USD, a commercial license ($500 flat) is required.
 */

export { YuliClient } from './client';
export { CCDStreamParser, parseCoordinate } from './parser/ccd';
export type { StateVector, Quadrant } from './parser/ccd';
export { OPFSStorageManager } from './storage/opfs';
export type { DownloadProgress } from './storage/opfs';

export const YULI_LICENSE = {
  type: 'BSL 1.1',
  freeRevenueTierCapUSD: 30000,
  commercialLicenseFeeUSD: 500,
  conversionLicense: 'Apache-2.0',
  changeDateYears: 4
} as const;
