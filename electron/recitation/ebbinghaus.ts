/**
 * 艾宾浩斯遗忘曲线算法 —— 与原始 Python 实现完全一致
 */

export interface ReviewResult {
  newStage: number
  newWeight: number
  newLastReview: string
  newNextReview: string
}

export class EbbinghausAlgorithm {
  /** 9 个复习阶段的时间间隔（毫秒） */
  static readonly STAGE_INTERVALS_MS = [
    5 * 60 * 1000,
    30 * 60 * 1000,
    12 * 60 * 60 * 1000,
    24 * 60 * 60 * 1000,
    2 * 24 * 60 * 60 * 1000,
    4 * 24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
    15 * 24 * 60 * 60 * 1000,
    30 * 24 * 60 * 60 * 1000,
  ]

  static readonly MAX_STAGE = EbbinghausAlgorithm.STAGE_INTERVALS_MS.length - 1

  calculateInitialState(): { stage: number; weight: number; lastReview: string; nextReview: string } {
    const now = new Date()
    const stage = 0
    const weight = 1.0
    const nextReview = new Date(now.getTime() + EbbinghausAlgorithm.STAGE_INTERVALS_MS[0])
    return {
      stage,
      weight,
      lastReview: now.toISOString(),
      nextReview: nextReview.toISOString(),
    }
  }

  calculateReviewResult(
    stage: number,
    weight: number,
    lastReview: string,
    isCorrect: boolean,
  ): ReviewResult {
    const now = new Date()
    const newLastReview = now.toISOString()

    const newStage = isCorrect
      ? Math.min(stage + 1, EbbinghausAlgorithm.MAX_STAGE)
      : Math.max(stage - 1, 0)

    const interval = EbbinghausAlgorithm.STAGE_INTERVALS_MS[newStage]
    const newNextReview = new Date(now.getTime() + interval)
    const newWeight = this._calculateWeight(newStage, now, newNextReview)

    return {
      newStage,
      newWeight,
      newLastReview,
      newNextReview: newNextReview.toISOString(),
    }
  }

  private _calculateWeight(stage: number, now: Date, nextReview: Date): number {
    const timeUntilReview = nextReview.getTime() - now.getTime()
    const totalInterval = EbbinghausAlgorithm.STAGE_INTERVALS_MS[stage]

    if (totalInterval <= 0) return 1.0

    let progress = 1.0 - timeUntilReview / totalInterval
    progress = Math.max(0.0, Math.min(1.0, progress))

    const weight = 1.0 + (1.0 - stage / (EbbinghausAlgorithm.MAX_STAGE + 1)) * Math.exp(progress * 3)
    return weight
  }

  updateWeightCurrent(stage: number, lastReview: string, nextReview: string): number {
    const now = new Date()
    return this._calculateWeight(stage, now, new Date(nextReview))
  }
}
