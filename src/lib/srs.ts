import type {
  ErrorType,
  Grade,
  GrammarFacet,
  ReviewMode,
  SrsState,
} from '../types'

export const MINUTE = 60_000
export const DAY = 86_400_000

export const FACETS: GrammarFacet[] = ['meaning', 'connection', 'zhJa', 'freeWrite']

const STAGE_DAYS = [0, 1, 3, 7, 14, 30]

export function emptySrs(): SrsState {
  return { stage: 0, dueAt: 0, streak: 0, lapses: 0, reviews: 0, lastAt: null }
}

/** 根据自评结果计算下一次复习时间 */
export function applyGrade(prev: SrsState | undefined, grade: Grade, now = Date.now()): SrsState {
  const base = prev ?? emptySrs()
  const reviews = base.reviews + 1

  switch (grade) {
    case 'forgot':
      return { ...base, stage: 0, streak: 0, reviews, lapses: base.lapses + 1, lastAt: now, dueAt: now + 30 * MINUTE }
    case 'fuzzy':
      return { ...base, stage: 1, streak: 0, reviews, lastAt: now, dueAt: now + STAGE_DAYS[1] * DAY }
    case 'ok':
      return { ...base, stage: 2, streak: 0, reviews, lastAt: now, dueAt: now + STAGE_DAYS[2] * DAY }
    case 'mastered': {
      const stage = Math.min(5, Math.max(3, base.stage + 1))
      return { ...base, stage, streak: base.streak + 1, reviews, lastAt: now, dueAt: now + STAGE_DAYS[stage] * DAY }
    }
  }
}

export function endOfToday(now = Date.now()): number {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export function isDue(s: SrsState, now = Date.now()): boolean {
  return s.dueAt <= endOfToday(now)
}

export function isNew(s: SrsState): boolean {
  return s.reviews === 0
}

/** 距离到期还有几天（0 = 今天或已到期） */
export function dueDays(s: SrsState, now = Date.now()): number {
  if (isDue(s, now)) return 0
  return Math.ceil((s.dueAt - endOfToday(now)) / DAY)
}

export type MasteryBucket = 'new' | 'weak' | 'fuzzy' | 'ok' | 'strong'

export function masteryBucket(s: SrsState): MasteryBucket {
  if (s.reviews === 0) return 'new'
  if (s.stage <= 0) return 'weak'
  if (s.stage === 1) return 'fuzzy'
  if (s.stage === 2) return 'ok'
  return 'strong'
}

export const MASTERY_LABEL: Record<MasteryBucket, string> = {
  new: '未学习',
  weak: '需加强',
  fuzzy: '模糊',
  ok: '基本掌握',
  strong: '熟练',
}

export const MASTERY_CLASS: Record<MasteryBucket, string> = {
  new: 'bg-line/60 text-sub',
  weak: 'bg-clay-soft text-clay',
  fuzzy: 'bg-[#F4EDDC] text-[#93733A]',
  ok: 'bg-sky-soft text-sky',
  strong: 'bg-pine-soft text-pine',
}

export const GRADE_LABEL: Record<Grade, string> = {
  forgot: '完全忘记',
  fuzzy: '模糊',
  ok: '基本掌握',
  mastered: '熟练',
}

export const GRADE_HINT: Record<Grade, string> = {
  forgot: '稍后再看一次',
  fuzzy: '明天再来',
  ok: '3 天后',
  mastered: '7 天起',
}

export const FACET_LABEL: Record<GrammarFacet, string> = {
  meaning: '意思理解',
  connection: '接续掌握',
  zhJa: '中译日',
  freeWrite: '自由造句',
}

export const ERROR_LABEL: Record<ErrorType, string> = {
  meaning: '忘记语法意思',
  connection: '忘记接续',
  recall: '不会主动调用语法',
  confusion: '相似语法混淆',
  expression: '句子表达错误',
}

export const MODE_LABEL: Record<ReviewMode, string> = {
  vocab: '词汇复习',
  choice: '语法选择题',
  zhJa: '中译日',
  freeWrite: '自由造句',
}

/** 语法的整体掌握程度：取已练习面向中最弱的一个 */
export function grammarMastery(facets: Record<GrammarFacet, SrsState>): SrsState {
  const reviewed = FACETS.map((f) => facets[f]).filter((s) => s.reviews > 0)
  if (!reviewed.length) return emptySrs()
  return reviewed.reduce((weakest, s) => (s.stage < weakest.stage ? s : weakest))
}
