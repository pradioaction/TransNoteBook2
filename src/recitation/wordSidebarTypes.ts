/** 复习单词批次颜色映射 */
export type ReviewBatchColor = 'green' | 'blue' | 'orange' | 'purple' | 'red'

/** 复习单词批次：根据 stage 自动分配颜色 */
export interface ReviewWordBatch {
  stage: number          // 艾宾浩斯阶段 0-8
  color: ReviewBatchColor
  words: WordDisplay[]
}

/** 用于侧边栏展示的单词条目 */
export interface WordDisplay {
  id: number
  word: string
  definition: string           // 中文释义, 检测模式下隐藏
  phonetic?: string
  stage?: number               // 复习单词才有, 决定批次颜色
  isSelected: boolean          // 用户是否勾选
  isCorrect?: boolean          // 检测模式下: 答题正确/错误
  isAnswered?: boolean         // 检测模式下: 是否已答完两道题
}

/** WordSidebar 的完整数据协议 */
export interface WordSidebarData {
  newWords: WordDisplay[]               // 新学单词列表
  reviewWordBatches: ReviewWordBatch[]  // 复习单词按批次分组
  studiedCount: number                  // 已学单词总数
  pendingReviewCount: number            // 待复习单词总数
}

/** WordSidebar 的操作回调 */
export interface WordSidebarActions {
  /** 勾选/取消勾选单词 */
  onToggleWord: (wordId: number, isNewWord: boolean) => void
  /** 全选 */
  onSelectAll: (type: 'new' | 'review') => void
  /** 取消全选 */
  onDeselectAll: (type: 'new' | 'review') => void
  /** 反选 */
  onInvertSelection: (type: 'new' | 'review') => void
}

/** WordSidebar 的显示模式 */
export type WordSidebarMode = 'full' | 'quiz' | 'review'
