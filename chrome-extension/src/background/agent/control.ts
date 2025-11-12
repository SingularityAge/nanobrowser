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
const WEIGHT_TO = 0.2;
const WEIGHT_LOOP = 0.25;
const SNAP_RESET = true;

const clamp = (v: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, v));

export function stepControl(prev: ControlState, t: Telemetry): ControlState {
  // Snap back on success
  if (t.lastOutcomeSuccess && SNAP_RESET) {
    return {
      emaSuccess: 1.0,
      emaTimeouts: Math.max(0, prev.emaTimeouts * 0.5),
      emaLoop: Math.max(0, prev.emaLoop * 0.5),
      e: 0.0,
      g: 0.0,
    };
  }

  // Update EMAs
  const sNow = t.lastOutcomeSuccess ? 1 : 0;
  const emaSuccess = ALPHA_SUCCESS * sNow + (1 - ALPHA_SUCCESS) * (prev.emaSuccess ?? 1);
  const emaTimeouts = ALPHA_TIMEOUT * (t.timeoutHappened ? 1 : 0) + (1 - ALPHA_TIMEOUT) * (prev.emaTimeouts ?? 0);
  const emaLoop = ALPHA_LOOP * (t.loopScore ?? 0) + (1 - ALPHA_LOOP) * (prev.emaLoop ?? 0);

  // Frustration signal (higher when success EMA is low)
  const failSignal = 1 - emaSuccess;

  // Continuous exploration intensity
  let e = WEIGHT_FAIL * failSignal + WEIGHT_TO * emaTimeouts + WEIGHT_LOOP * emaLoop;

  // Soft clip and ease (S-curve) for nicer dynamics
  e = clamp(0.5 * Math.tanh(2.2 * e) + 0.5, 0, 1);

  // Goal glide kicks in only at higher e
  const g = smoothstep(e, 0.55, 0.9);

  return { emaSuccess, emaTimeouts, emaLoop, e, g };
}

function smoothstep(x: number, a: number, b: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

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
  return stepControl(state, telemetry);
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

