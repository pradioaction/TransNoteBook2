/**
 * 艾宾浩斯遗忘曲线算法 —— 与原始 Python 实现完全一致
 *
 * 计算复习权重和下次复习时间
 */

export interface ReviewResult {
  newStage: number
  newWeight: number
  newLastReview: string // ISO datetime string
  newNextReview: string // ISO datetime string
}

export class EbbinghausAlgorithm {
  /** 9 个复习阶段的时间间隔（与原始 Python 完全一致） */
  static readonly STAGE_INTERVALS_MS = [
    5 * 60 * 1000,           // 5 分钟
    30 * 60 * 1000,          // 30 分钟
    12 * 60 * 60 * 1000,     // 12 小时
    24 * 60 * 60 * 1000,     // 1 天
    2 * 24 * 60 * 60 * 1000, // 2 天
    4 * 24 * 60 * 60 * 1000, // 4 天
    7 * 24 * 60 * 60 * 1000, // 7 天
    15 * 24 * 60 * 60 * 1000,// 15 天
    30 * 24 * 60 * 60 * 1000,// 30 天
  ]

  static readonly MAX_STAGE = EbbinghausAlgorithm.STAGE_INTERVALS_MS.length - 1

  /**
   * 计算初始学习状态
   * @returns (stage, weight, lastReview, nextReview)
   */
  calculateInitialState(): { stage: number; weight: number; lastReview: string; nextReview: string } {
    const now = new Date()
    const stage = 0
    const weight = 1.0
    const nextReview = new Date(now.getTime() + EbbinghausAlgorithm.STAGE_INTERVALS[0])
    return {
      stage,
      weight,
      lastReview: now.toISOString(),
      nextReview: nextReview.toISOString(),
    }
  }

  /**
   * 计算复习后的状态
   * @param stage 当前阶段
   * @param weight 当前权重
   * @param lastReview 上次复习时间
   * @param isCorrect 复习是否正确
   * @returns 新的学习状态
   */
  calculateReviewResult(
    stage: number,
    weight: number,
    lastReview: string,
    isCorrect: boolean,
  ): ReviewResult {
    const now = new Date()
    const newLastReview = now.toISOString()

    let newStage: number
    if (isCorrect) {
      newStage = Math.min(stage + 1, EbbinghausAlgorithm.MAX_STAGE)
    } else {
      newStage = Math.max(stage - 1, 0)
    }

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

  /**
   * 计算复习权重（使用指数衰减算法）
   *
   * 权重随时间递减，接近下次复习时间时权重增加
   */
  private _calculateWeight(stage: number, now: Date, nextReview: Date): number {
    const timeUntilReview = nextReview.getTime() - now.getTime()
    const totalInterval = EbbinghausAlgorithm.STAGE_INTERVALS_MS[stage]

    if (totalInterval <= 0) {
      return 1.0
    }

    let progress = 1.0 - timeUntilReview / totalInterval
    progress = Math.max(0.0, Math.min(1.0, progress))

    const weight = 1.0 + (1.0 - stage / (EbbinghausAlgorithm.MAX_STAGE + 1)) * Math.exp(progress * 3)

    return weight
  }

  /**
   * 更新当前时间点的权重
   */
  updateWeightCurrent(stage: number, lastReview: string, nextReview: string): number {
    const now = new Date()
    return this._calculateWeight(stage, now, new Date(nextReview))
  }
}

// 向下兼容的静态访问
export namespace EbbinghausAlgorithm {
  export const STAGE_INTERVALS = EbbinghausAlgorithm.STAGE_INTERVALS_MS
}
