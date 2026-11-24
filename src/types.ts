export interface BaseRecord {
  id: string
  createdAt: number
  updatedAt: number
}

/** 间隔重复状态 */
export interface SrsState {
  /** 0 需加强 / 1 模糊 / 2 基本掌握 / 3 熟练 / 4-5 长期记忆 */
  stage: number
  /** 下次到期时间戳，0 表示从未复习 */
  dueAt: number
  streak: number
  lapses: number
  reviews: number
  lastAt: number | null
}

export type Grade = 'forgot' | 'fuzzy' | 'ok' | 'mastered'
export type ItemKind = 'vocab' | 'grammar'
export type GrammarFacet = 'meaning' | 'connection' | 'zhJa' | 'freeWrite'
export type ReviewMode = 'vocab' | 'choice' | 'zhJa' | 'freeWrite'
export type ErrorType = 'meaning' | 'connection' | 'recall' | 'confusion' | 'expression'

export interface Lesson extends BaseRecord {
  title: string
  theme: string
  note: string
}

export interface Vocabulary extends BaseRecord {
  word: string
  kana: string
  meaning: string
  pos: string
  transitivity: string
  note: string
  srs: SrsState
}

export interface Grammar extends BaseRecord {
  name: string
  connection: string
  meaning: string
  usage: string
  category: string
  pitfalls: string
  note: string
  facets: Record<GrammarFacet, SrsState>
}

export interface Example {
  id: string
  ownerType: ItemKind
  ownerId: string
  ja: string
  zh: string
  order: number
  createdAt: number
}

export interface LessonVocabulary {
  id: string
  lessonId: string
  vocabularyId: string
}

export interface LessonGrammar {
  id: string
  lessonId: string
  grammarId: string
}

/** 课文配图（如听力二维码），数据以 data URL 形式保存在本地 IndexedDB */
export interface LessonImage {
  id: string
  lessonId: string
  dataUrl: string
  mimeType: string
  createdAt: number
  updatedAt: number
}

export interface ReviewRecord {
  id: string
  itemType: ItemKind
  itemId: string
  mode: ReviewMode
  facet?: GrammarFacet
  grade: Grade
  correct?: boolean
  durationMs?: number
  createdAt: number
}

export interface Mistake {
  id: string
  itemType: ItemKind
  itemId: string
  mode: ReviewMode
  errorType: ErrorType
  prompt: string
  userAnswer: string
  resolved: boolean
  createdAt: number
}

export interface ChoiceQuestion {
  kind: 'meaning' | 'connection'
  prompt: string
  options: string[]
  answer: string
  explanation: string
  grammarId: string
}

export interface ReviewTask {
  key: string
  mode: ReviewMode
  itemType: ItemKind
  itemId: string
  facet?: GrammarFacet
  question?: ChoiceQuestion
  prompt?: string
  answer?: string
}

export interface SessionResult {
  key: string
  grade: Grade
  correct?: boolean
}

export interface StudySession {
  id: string
  mode: ReviewMode | 'mixed'
  startedAt: number
  endedAt?: number
  updatedAt: number
  status: 'active' | 'done' | 'abandoned'
  plannedMinutes?: number
  tasks: ReviewTask[]
  index: number
  results: SessionResult[]
}

export interface Snapshot {
  lessons: Lesson[]
  vocabulary: Vocabulary[]
  grammar: Grammar[]
  examples: Example[]
  lessonVocabulary: LessonVocabulary[]
  lessonGrammar: LessonGrammar[]
  lessonImages: LessonImage[]
  records: ReviewRecord[]
  mistakes: Mistake[]
  sessions: StudySession[]
}
