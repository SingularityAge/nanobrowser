export type Role = 'planner' | 'navigator';

export interface LLMSettings {
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  top_k?: number;
  max_tokens: number;
}

export interface Defaults {
  planner: LLMSettings;
  navigator: LLMSettings;
}

export interface Telemetry {
  lastOutcomeSuccess: boolean;
  timeoutHappened: boolean;
  loopScore: number;
  inputTokens: number;
  contextWindow: number;
}

export interface ControlState {
  emaSuccess: number;
  emaTimeouts: number;
  emaLoop: number;
  e: number;
  g: number;
}

export interface DirectorContext {
  tokenBufferRatio?: number;
}

export interface ConstraintTuning {
  allowCrossDomainExploration: boolean;
  plannerRelaxation: number;
  navigatorBoldness: number;
}

const ALPHA_SUCCESS = 0.35;
const ALPHA_TIMEOUT = 0.25;
const ALPHA_LOOP = 0.2;
const WEIGHT_FAIL = 0.7;
const WEIGHT_TIMEOUT = 0.2;
const WEIGHT_LOOP = 0.25;
const SNAP_RESET = true;

const MIN_SUCCESS_EMA = 0.05;
const MAX_EMA = 0.999;

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const ema = (prev: number, sample: number, alpha: number): number => {
  const boundedSample = clamp(sample, 0, 1);
  const boundedPrev = clamp(prev, 0, 1);
  return alpha * boundedSample + (1 - alpha) * boundedPrev;
};

const smoothstep = (value: number, edge0: number, edge1: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const frictionBudget = (failurePressure: number, timeoutPressure: number, loopPressure: number): number => {
  const numerator = WEIGHT_FAIL * failurePressure + WEIGHT_TIMEOUT * timeoutPressure + WEIGHT_LOOP * loopPressure;
  const denominator = WEIGHT_FAIL + WEIGHT_TIMEOUT + WEIGHT_LOOP;
  return clamp(numerator / denominator, 0, 1);
};

const explorationRamp = (value: number): number => {
  // Soften the curve so that the early portion of the ramp stays calm.
  return Math.pow(clamp(value, 0, 1), 0.85);
};

export const DEFAULT_CONTROL_STATE: ControlState = {
  emaSuccess: 1,
  emaTimeouts: 0,
  emaLoop: 0,
  e: 0,
  g: 0,
};

export const computeController = (state: ControlState, telemetry: Telemetry): ControlState => {
  const successSample = telemetry.lastOutcomeSuccess ? 1 : 0;
  const timeoutSample = telemetry.timeoutHappened ? 1 : 0;
  const loopSample = clamp(telemetry.loopScore, 0, 1);

  const emaSuccess = telemetry.lastOutcomeSuccess && SNAP_RESET ? 1 : ema(state.emaSuccess, successSample, ALPHA_SUCCESS);
  const emaTimeouts = ema(state.emaTimeouts, timeoutSample, ALPHA_TIMEOUT);
  const emaLoop = ema(state.emaLoop, loopSample, ALPHA_LOOP);

  const failurePressure = 1 - clamp(emaSuccess, MIN_SUCCESS_EMA, MAX_EMA);
  const timeoutPressure = emaTimeouts;
  const loopPressure = emaLoop;

  let exploration = frictionBudget(failurePressure, timeoutPressure, loopPressure);

  if (telemetry.contextWindow > 0 && telemetry.inputTokens >= 0) {
    const usageRatio = clamp(telemetry.inputTokens / telemetry.contextWindow, 0, 1);
    exploration = clamp(exploration + 0.1 * usageRatio, 0, 1);
  }

  const e = telemetry.lastOutcomeSuccess && SNAP_RESET ? 0 : explorationRamp(exploration);
  const g = telemetry.lastOutcomeSuccess && SNAP_RESET ? 0 : smoothstep(e, 0.55, 0.9);

  return {
    emaSuccess,
    emaTimeouts,
    emaLoop,
    e,
    g,
  };
};

const adjustTemperature = (base: number, exploration: number, role: Role): number => {
  const maxBoost = role === 'planner' ? 0.65 : 0.45;
  return clamp(base + maxBoost * exploration, 0, 2);
};

const adjustTopP = (base: number, exploration: number, role: Role): number => {
  const maxBoost = role === 'planner' ? 0.25 : 0.18;
  return clamp(base + maxBoost * exploration, 0, 1);
};

const adjustPenalties = (base: number, glide: number): number => {
  const relief = 0.35 * glide;
  return clamp(base - relief, -2, 2);
};

const adjustTopK = (topK: number | undefined, exploration: number): number | undefined => {
  if (typeof topK !== 'number') {
    return topK;
  }
  const delta = Math.round(topK * (0.3 * exploration));
  return clamp(topK + delta, 1, 2000);
};

const adjustMaxTokens = (
  base: number,
  exploration: number,
  glide: number,
  ctx: DirectorContext,
): number => {
  const explorationBonus = Math.round(base * (0.15 * exploration + 0.1 * glide));
  const tokenBufferRatio = clamp(ctx.tokenBufferRatio ?? 0, 0, 1);
  const bufferBonus = Math.round(base * 0.1 * tokenBufferRatio);
  return clamp(base + explorationBonus + bufferBonus, 128, 320000);
};

export const directorMap = (
  role: Role,
  exploration: number,
  glide: number,
  defaults: Defaults,
  ctx: DirectorContext = {},
): LLMSettings => {
  const baseline = defaults[role];
  const tunedExploration = explorationRamp(exploration);

  const temperature = adjustTemperature(baseline.temperature, tunedExploration, role);
  const topP = adjustTopP(baseline.top_p, tunedExploration, role);
  const frequencyPenalty = adjustPenalties(baseline.frequency_penalty, glide);
  const presencePenalty = adjustPenalties(baseline.presence_penalty, glide * 0.75);
  const topK = adjustTopK(baseline.top_k, tunedExploration);
  const maxTokens = adjustMaxTokens(baseline.max_tokens, tunedExploration, glide, ctx);

  return {
    temperature,
    top_p: topP,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
    ...(typeof topK === 'number' ? { top_k: topK } : {}),
    max_tokens: maxTokens,
  };
};

export const constraintTuner = (glide: number): ConstraintTuning => {
  const glideClamped = clamp(glide, 0, 1);
  return {
    allowCrossDomainExploration: glideClamped > 0.4,
    plannerRelaxation: glideClamped,
    navigatorBoldness: Math.sqrt(glideClamped),
  };
};

