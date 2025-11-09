import { PerformanceLogger } from '../services/performanceLogger';
import { Actors } from '../event/types';

export type NavigatorMode = 'dom' | 'vision';

export interface DirectorProposal<T = unknown> {
  mode: NavigatorMode;
  score: number;
  modelOutput: T;
  actions: Record<string, unknown>[];
  rationale: string;
}

export interface DirectorDecision<T = unknown> {
  proposal: DirectorProposal<T>;
  rationale: string;
  scores: Record<NavigatorMode, number>;
}

export interface DirectorCtlOptions {
  /**
   * Additional bonus applied to vision score before comparing against DOM.
   */
  visionScoreOffset: number;
  /**
   * Minimum score delta required before switching away from the previously chosen mode.
   */
  hysteresisMargin: number;
  /**
   * Prefer DOM when scores are tied or extremely close.
   */
  preferDomOnTie: boolean;
}

const DEFAULT_CTL: DirectorCtlOptions = {
  visionScoreOffset: 0.05,
  hysteresisMargin: 0.08,
  preferDomOnTie: true,
};

export interface DirectorContextMeta {
  taskId: string;
  step: number;
}

export class DirectorService {
  private readonly performanceLogger = new PerformanceLogger();
  private lastMode: NavigatorMode | null = null;

  async choose<T>(
    proposals: DirectorProposal<T>[],
    meta: DirectorContextMeta,
    ctlOptions?: Partial<DirectorCtlOptions>,
  ): Promise<DirectorDecision<T>> {
    if (!proposals.length) {
      throw new Error('DirectorService received no proposals to arbitrate');
    }

    const ctl: DirectorCtlOptions = { ...DEFAULT_CTL, ...ctlOptions };
    const scores: Record<NavigatorMode, number> = { dom: 0, vision: 0 };
    proposals.forEach(proposal => {
      const normalizedScore = proposal.mode === 'vision' ? proposal.score + ctl.visionScoreOffset : proposal.score;
      scores[proposal.mode] = normalizedScore;
    });

    let sorted = proposals
      .map(proposal => ({
        ...proposal,
        score: proposal.mode === 'vision' ? proposal.score + ctl.visionScoreOffset : proposal.score,
      }))
      .sort((a, b) => b.score - a.score);

    let top = sorted[0];
    let rationale = top.rationale;

    if (sorted.length > 1) {
      const second = sorted[1];
      const diff = top.score - second.score;

      if (this.lastMode && this.lastMode !== top.mode && diff < ctl.hysteresisMargin) {
        const previous = sorted.find(candidate => candidate.mode === this.lastMode);
        if (previous) {
          top = previous;
          rationale = `Maintained ${previous.mode.toUpperCase()} navigator due to hysteresis (${diff.toFixed(2)} delta).`;
        }
      } else if (diff < 0.01 && ctl.preferDomOnTie) {
        const domCandidate = sorted.find(candidate => candidate.mode === 'dom');
        if (domCandidate) {
          top = domCandidate;
          rationale = `Scores nearly tied; defaulting to DOM navigator to reduce vision churn (Δ ${diff.toFixed(2)}).`;
        }
      } else if (diff >= ctl.hysteresisMargin) {
        rationale = `Selected ${top.mode.toUpperCase()} navigator (score ${top.score.toFixed(
          2,
        )} vs ${second.score.toFixed(2)}).`;
      }
    } else {
      rationale = `Only ${top.mode.toUpperCase()} navigator proposal available.`;
    }

    this.lastMode = top.mode;

    await this.performanceLogger.addEvent({
      timestamp: Date.now(),
      taskId: meta.taskId,
      step: meta.step,
      actor: Actors.NAVIGATOR,
      modality: top.mode,
      action: 'navigator.proposal-select',
      origin: 'director',
      outcome: 'success',
      sessionId: meta.taskId,
      note: rationale,
    });

    return {
      proposal: top,
      rationale,
      scores,
    };
  }
}
