/**
 * @yuli-ai/web - Edge Cognitive Engine & Character SDK
 * 
 * Licensed under the Business Source License 1.1 (BSL 1.1).
 * Free for individuals and studios earning under $30,000 USD gross annual revenue.
 * For commercial operations >= $30,000 USD, a commercial license ($1,500/yr per Title) is required.
 * Enterprise support with a Service Level Agreement (SLA) is available upon request.
 * Automatically converts to Apache 2.0 on September 1st, 2030.
 */

export { YuliClient, DEFAULT_WASM_PATH } from './client';
export type { ChatMessage, YuliOptions, PromptHandlers, PromptOptions, WasmPathsConfig, TelemetryStats, InferenceTelemetry } from './client';

export { CCDStreamParser, parseCoordinate } from './parser/ccd';
export type { StateVector, Quadrant, CCDHandlers } from './parser/ccd';

export { OPFSStorageManager, extractModelFileName, DEFAULT_MODEL_FILENAME } from './storage/opfs';
export type { DownloadProgress } from './storage/opfs';

export {
  coordinateToVector,
  vectorToCoordinate,
  applyVectorDelta,
  blendVectors,
  vectorDistance
} from './vector/hypercube';
export type { Vector4D } from './vector/hypercube';

export {
  isSharedArrayBufferSupported,
  createSharedRingBuffer,
  TokenRingBufferWriter,
  TokenRingBufferReader,
  RingBufferStatus,
  RING_BUFFER_HEADER_BYTES,
  DEFAULT_RING_BUFFER_CAPACITY
} from './ringbuffer/ring-buffer';

export {
  getYuliGrammar,
  YULI_STRICT_GBNF,
  YULI_STATE_ONLY_GBNF,
  YULI_JSON_ACTION_GBNF
} from './grammar/gbnf';

export {
  serializeStateSnapshot,
  deserializeStateSnapshot
} from './snapshot/state-snapshot';
export type { YuliSnapshot } from './snapshot/state-snapshot';

export {
  YuliCharacterFSM
} from './fsm/character-fsm';
export type {
  FSMState,
  GameTelemetryProvider,
  YuliCharacterConfig,
  YuliGamePayload
} from './fsm/character-fsm';

export {
  compileActionGrammar,
  parseActionTag
} from './fsm/action-grammar';
export type { ParsedAction, ActionPayload } from './fsm/action-grammar';

export { TypewriterBuffer } from './dialogue/typewriter';
export type { TypewriterOptions } from './dialogue/typewriter';

export { DialoguePipeline, parseModelResponse } from './dialogue/pipeline';
export type { DialoguePipelineOptions, ParsedResponse, ParsedModelResponse } from './dialogue/pipeline';

export const YULI_LICENSE = {
  type: 'BSL 1.1',
  freeRevenueTierCapUSD: 30000,
  commercialLicenseFeeUSD: 1500,
  commercialLicensePeriod: 'annual',
  commercialLicenseScope: 'per-title',
  enterpriseSupportAvailable: true,
  conversionLicense: 'Apache-2.0',
  changeDate: '2030-09-01',
  changeDateYears: 4
} as const;
