export type { Classification } from './classify.js';
export { classifyProperty, normaliseProperty } from './classify.js';
export { isColorValue, normaliseColor } from './colors.js';
export type { ConfidenceInput } from './confidence.js';
export { CONFIDENCE_SATURATION, CONFIDENCE_WEIGHTS, scoreConfidence } from './confidence.js';
export type { TokenInferenceOptions } from './token-engine.js';
export { MAX_RECORDED_LOCATIONS, TokenInferenceEngine } from './token-engine.js';
export type { TokenValue } from './token-values.js';
export { extractTokenValues, splitValueParts } from './token-values.js';
