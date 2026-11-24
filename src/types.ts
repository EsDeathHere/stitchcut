export interface SilenceConfig {
  silenceThresholdDb: number;
  minSilenceDurationSec: number;
  preRollMs: number;
  postRollMs: number;
  targetBudgetSec: number;
}

export interface AudioSegment {
  start: number;
  end: number;
  energy: number;
}

export interface CutPlan {
  segments: AudioSegment[];
  originalDuration: number;
  forgedDuration: number;
  strippedDuration: number;
  withinBudget: boolean;
}

export interface ForgeProgress {
  stage: 'idle' | 'loading' | 'analyzing' | 'forging' | 'done' | 'error';
  percent: number;
  message: string;
}
