import {
  clearAllData,
  getAll,
  getOne,
  putMany,
  putOne,
  removeMany,
} from './idb'
import { applyGrade, emptySrs } from '../lib/srs'
import { uid } from '../lib/utils'
import type {
  Example,
  Grammar,
  GrammarFacet,
  Grade,
  ItemKind,
  Lesson,
  LessonGrammar,
  LessonVocabulary,
  Mistake,
  ReviewRecord,
  ReviewMode,
  Snapshot,
  StudySession,
  Vocabulary,
} from '../types'

export type VocabInput = Pick<Vocabulary, 'word' | 'kana' | 'meaning' | 'pos' | 'transitivity' | 'note'>
export type GrammarInput = Pick<Grammar, 'name' | 'connection' | 'meaning' | 'usage' | 'category' | 'pitfalls' | 'note'>
export type LessonInput = Pick<Lesson, 'title' | 'theme' | 'note'>

export interface ExampleInput {
  ja: string
  zh: string
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [lessons, vocabulary, grammar, examples, lessonVocabulary, lessonGrammar, records, mistakes, sessions] =
    await Promise.all([
      getAll<Lesson>('lessons'),
      getAll<Vocabulary>('vocabulary'),
      getAll<Grammar>('grammar'),
      getAll<Example>('examples'),
      getAll<LessonVocabulary>('lesson_vocabulary'),
      getAll<LessonGrammar>('lesson_grammar'),
      getAll<ReviewRecord>('review_records'),
      getAll<Mistake>('mistakes'),
      getAll<StudySession>('study_sessions'),
    ])
  return { lessons, vocabulary, grammar, examples, lessonVocabulary, lessonGrammar, records, mistakes, sessions }
}

/* ---------------- 词汇 ---------------- */

export async function saveVocabulary(input: VocabInput, existing?: Vocabulary): Promise<Vocabulary> {
  const now = Date.now()
  const record: Vocabulary = existing
    ? { ...existing, ...input, updatedAt: now }
    : { id: uid('v_'), ...input, srs: emptySrs(), createdAt: now, updatedAt: now }
  await putOne('vocabulary', record)
  return record
}

export async function gradeVocabulary(id: string, grade: Grade): Promise<void> {
  const item = await getOne<Vocabulary>('vocabulary', id)
  if (!item) return
  await putOne('vocabulary', { ...item, srs: applyGrade(item.srs, grade), updatedAt: Date.now() })
}

/* ---------------- 语法 ---------------- */

export async function saveGrammar(input: GrammarInput, existing?: Grammar): Promise<Grammar> {
  const now = Date.now()
  const record: Grammar = existing
    ? { ...existing, ...input, updatedAt: now }
    : {
        id: uid('g_'),
        ...input,
        facets: {
          meaning: emptySrs(),
          connection: emptySrs(),
          zhJa: emptySrs(),
          freeWrite: emptySrs(),
        },
        createdAt: now,
        updatedAt: now,
      }
  await putOne('grammar', record)
  return record
}

export async function gradeGrammarFacet(id: string, facet: GrammarFacet, grade: Grade): Promise<void> {
  const item = await getOne<Grammar>('grammar', id)
  if (!item) return
  const facets = { ...item.facets, [facet]: applyGrade(item.facets[facet], grade) }
  await putOne('grammar', { ...item, facets, updatedAt: Date.now() })
}

/* ---------------- 课文 ---------------- */

export async function saveLesson(input: LessonInput, existing?: Lesson): Promise<Lesson> {
  const now = Date.now()
  const record: Lesson = existing
    ? { ...existing, ...input, updatedAt: now }
    : { id: uid('l_'), ...input, createdAt: now, updatedAt: now }
  await putOne('lessons', record)
  return record
}

/* ---------------- 例句 ---------------- */

export async function replaceExamples(ownerType: ItemKind, ownerId: string, rows: ExampleInput[]): Promise<void> {
  const all = await getAll<Example>('examples')
  const old = all.filter((e) => e.ownerType === ownerType && e.ownerId === ownerId)
  await removeMany('examples', old.map((e) => e.id))
  const clean = rows.filter((r) => r.ja.trim() || r.zh.trim())
  const now = Date.now()
  await putMany<Example>(
    'examples',
    clean.map((r, i) => ({
      id: uid('e_'),
      ownerType,
      ownerId,
      ja: r.ja.trim(),
      zh: r.zh.trim(),
      order: i,
      createdAt: now,
    })),
  )
}

/* ---------------- 关联 ---------------- */

export async function setItemLessons(kind: ItemKind, itemId: string, lessonIds: string[]): Promise<void> {
  if (kind === 'vocab') {
    const all = await getAll<LessonVocabulary>('lesson_vocabulary')
    const old = all.filter((l) => l.vocabularyId === itemId)
    await removeMany('lesson_vocabulary', old.map((l) => l.id))
    await putMany<LessonVocabulary>(
      'lesson_vocabulary',
      Array.from(new Set(lessonIds)).map((lessonId) => ({
        id: `${lessonId}__${itemId}`,
        lessonId,
        vocabularyId: itemId,
      })),
    )
  } else {
    const all = await getAll<LessonGrammar>('lesson_grammar')
    const old = all.filter((l) => l.grammarId === itemId)
    await removeMany('lesson_grammar', old.map((l) => l.id))
    await putMany<LessonGrammar>(
      'lesson_grammar',
      Array.from(new Set(lessonIds)).map((lessonId) => ({
        id: `${lessonId}__${itemId}`,
        lessonId,
        grammarId: itemId,
      })),
    )
  }
}

export async function setLessonItems(kind: ItemKind, lessonId: string, itemIds: string[]): Promise<void> {
  const unique = Array.from(new Set(itemIds))
  if (kind === 'vocab') {
    const all = await getAll<LessonVocabulary>('lesson_vocabulary')
    const old = all.filter((l) => l.lessonId === lessonId)
    await removeMany('lesson_vocabulary', old.map((l) => l.id))
    await putMany<LessonVocabulary>(
      'lesson_vocabulary',
      unique.map((vocabularyId) => ({ id: `${lessonId}__${vocabularyId}`, lessonId, vocabularyId })),
    )
  } else {
    const all = await getAll<LessonGrammar>('lesson_grammar')
    const old = all.filter((l) => l.lessonId === lessonId)
    await removeMany('lesson_grammar', old.map((l) => l.id))
    await putMany<LessonGrammar>(
      'lesson_grammar',
      unique.map((grammarId) => ({ id: `${lessonId}__${grammarId}`, lessonId, grammarId })),
    )
  }
}

/* ---------------- 删除 ---------------- */

async function cascadeDelete(kind: ItemKind, itemId: string): Promise<void> {
  const [examples, records, mistakes, vocabLinks, grammarLinks] = await Promise.all([
    getAll<Example>('examples'),
    getAll<ReviewRecord>('review_records'),
    getAll<Mistake>('mistakes'),
    getAll<LessonVocabulary>('lesson_vocabulary'),
    getAll<LessonGrammar>('lesson_grammar'),
  ])
  await removeMany(
    'examples',
    examples.filter((e) => e.ownerType === kind && e.ownerId === itemId).map((e) => e.id),
  )
  await removeMany(
    'review_records',
    records.filter((r) => r.itemType === kind && r.itemId === itemId).map((r) => r.id),
  )
  await removeMany(
    'mistakes',
    mistakes.filter((m) => m.itemType === kind && m.itemId === itemId).map((m) => m.id),
  )
  if (kind === 'vocab') {
    await removeMany(
      'lesson_vocabulary',
      vocabLinks.filter((l) => l.vocabularyId === itemId).map((l) => l.id),
    )
  } else {
    await removeMany(
      'lesson_grammar',
      grammarLinks.filter((l) => l.grammarId === itemId).map((l) => l.id),
    )
  }
}

export async function deleteVocabulary(id: string): Promise<void> {
  await cascadeDelete('vocab', id)
  await removeMany('vocabulary', [id])
}

export async function deleteGrammar(id: string): Promise<void> {
  await cascadeDelete('grammar', id)
  await removeMany('grammar', [id])
}

export async function deleteLesson(id: string): Promise<void> {
  const [vocabLinks, grammarLinks] = await Promise.all([
    getAll<LessonVocabulary>('lesson_vocabulary'),
    getAll<LessonGrammar>('lesson_grammar'),
  ])
  await removeMany('lesson_vocabulary', vocabLinks.filter((l) => l.lessonId === id).map((l) => l.id))
  await removeMany('lesson_grammar', grammarLinks.filter((l) => l.lessonId === id).map((l) => l.id))
  await removeMany('lessons', [id])
}

/* ---------------- 复习记录 / 错题 / 练习 ---------------- */

export async function addReviewRecord(input: {
  itemType: ItemKind
  itemId: string
  mode: ReviewMode
  facet?: GrammarFacet
  grade: Grade
  correct?: boolean
  durationMs?: number
}): Promise<void> {
  const record: ReviewRecord = { id: uid('r_'), createdAt: Date.now(), ...input }
  await putOne('review_records', record)
}

export async function addMistake(input: {
  itemType: ItemKind
  itemId: string
  mode: ReviewMode
  errorType: Mistake['errorType']
  prompt: string
  userAnswer?: string
}): Promise<void> {
  const record: Mistake = {
    id: uid('m_'),
    itemType: input.itemType,
    itemId: input.itemId,
    mode: input.mode,
    errorType: input.errorType,
    prompt: input.prompt,
    userAnswer: input.userAnswer ?? '',
    resolved: false,
    createdAt: Date.now(),
  }
  await putOne('mistakes', record)
}

export async function setMistakeResolved(id: string, resolved: boolean): Promise<void> {
  const item = await getOne<Mistake>('mistakes', id)
  if (!item) return
  await putOne('mistakes', { ...item, resolved })
}

export async function deleteMistake(id: string): Promise<void> {
  await removeMany('mistakes', [id])
}

export async function saveSession(session: StudySession): Promise<void> {
  await putOne('study_sessions', session)
}

export async function deleteSession(id: string): Promise<void> {
  await removeMany('study_sessions', [id])
}

/* ---------------- 备份 ---------------- */

const APP_TAG = 'ravens-note'
export const FORMAT_VERSION = 1

export const BACKUP_KEYS = [
  'lessons',
  'vocabulary',
  'grammar',
  'examples',
  'lesson_vocabulary',
  'lesson_grammar',
  'review_records',
  'mistakes',
  'study_sessions',
] as const

export interface BackupFile {
  app: string
  formatVersion: number
  exportedAt: string
  counts: Record<string, number>
  data: Record<string, unknown[]>
}

export async function buildBackup(): Promise<BackupFile> {
  const snap = await loadSnapshot()
  const data: Record<string, unknown[]> = {
    lessons: snap.lessons,
    vocabulary: snap.vocabulary,
    grammar: snap.grammar,
    examples: snap.examples,
    lesson_vocabulary: snap.lessonVocabulary,
    lesson_grammar: snap.lessonGrammar,
    review_records: snap.records,
    mistakes: snap.mistakes,
    study_sessions: snap.sessions,
  }
  const counts: Record<string, number> = {}
  for (const key of BACKUP_KEYS) counts[key] = data[key].length
  return {
    app: APP_TAG,
    formatVersion: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    counts,
    data,
  }
}

export function parseBackup(text: string): { ok: true; file: BackupFile } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: '文件不是有效的 JSON，请确认选择的是导出的备份文件。' }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '文件内容格式不正确。' }
  }
  const obj = raw as Record<string, unknown>
  if (obj.app !== APP_TAG) {
    return { ok: false, error: "这不是 RAVEN'sノート 的备份文件。" }
  }
  if (typeof obj.formatVersion !== 'number' || obj.formatVersion > FORMAT_VERSION) {
    return { ok: false, error: '备份文件版本过新，当前版本无法导入。' }
  }
  if (!obj.data || typeof obj.data !== 'object' || Array.isArray(obj.data)) {
    return { ok: false, error: '备份文件缺少数据内容。' }
  }
  const dataRaw = obj.data as Record<string, unknown>
  const data: Record<string, unknown[]> = {}
  for (const key of BACKUP_KEYS) {
    const value = dataRaw[key]
    data[key] = Array.isArray(value) ? value : []
  }
  const counts: Record<string, number> = {}
  for (const key of BACKUP_KEYS) counts[key] = data[key].length
  return {
    ok: true,
    file: {
      app: APP_TAG,
      formatVersion: obj.formatVersion,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
      counts,
      data,
    },
  }
}

export interface ImportReport {
  added: Record<string, number>
  skipped: number
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Date.now())

function asArray(value: unknown): Record<string, any>[] {
  return Array.isArray(value) ? (value as Record<string, any>[]) : []
}

/** 合并导入：按 id 与自然键去重，不会清空现有数据 */
export async function importBackup(text: string): Promise<ImportReport> {
  const parsed = parseBackup(text)
  if (!parsed.ok) throw new Error(parsed.error)
  const incoming = parsed.file.data

  const [lessons, vocabulary, grammar, examples, existingLV, existingLG, records, mistakes, sessions] = await Promise.all([
    getAll<Lesson>('lessons'),
    getAll<Vocabulary>('vocabulary'),
    getAll<Grammar>('grammar'),
    getAll<Example>('examples'),
    getAll<LessonVocabulary>('lesson_vocabulary'),
    getAll<LessonGrammar>('lesson_grammar'),
    getAll<ReviewRecord>('review_records'),
    getAll<Mistake>('mistakes'),
    getAll<StudySession>('study_sessions'),
  ])

  const added: Record<string, number> = {
    lessons: 0,
    vocabulary: 0,
    grammar: 0,
    examples: 0,
    links: 0,
    review_records: 0,
    mistakes: 0,
    study_sessions: 0,
  }
  let skipped = 0

  const lessonMap = new Map<string, string>()
  const vocabMap = new Map<string, string>()
  const grammarMap = new Map<string, string>()

  /* 课文 */
  const newLessons: Lesson[] = []
  const lessonByTitle = new Map(lessons.map((l) => [l.title.trim(), l]))
  for (const raw of asArray(incoming.lessons)) {
    const id = str(raw.id)
    const title = str(raw.title).trim()
    if (!id || !title) {
      skipped++
      continue
    }
    const existing = lessonByTitle.get(title) ?? lessons.find((l) => l.id === id)
    if (existing) {
      lessonMap.set(id, existing.id)
      skipped++
      continue
    }
    const record: Lesson = {
      id,
      title,
      theme: str(raw.theme),
      note: str(raw.note),
      createdAt: num(raw.createdAt),
      updatedAt: num(raw.updatedAt),
    }
    newLessons.push(record)
    lessons.push(record)
    lessonByTitle.set(title, record)
    lessonMap.set(id, record.id)
    added.lessons++
  }

  /* 词汇 */
  const newVocab: Vocabulary[] = []
  const vocabByKey = new Map(vocabulary.map((v) => [`${v.word.trim()}|${v.kana.trim()}`, v]))
  for (const raw of asArray(incoming.vocabulary)) {
    const id = str(raw.id)
    const word = str(raw.word).trim()
    if (!id || !word) {
      skipped++
      continue
    }
    const kana = str(raw.kana).trim()
    const existing = vocabByKey.get(`${word}|${kana}`) ?? vocabulary.find((v) => v.id === id)
    if (existing) {
      vocabMap.set(id, existing.id)
      skipped++
      continue
    }
    const record: Vocabulary = {
      id,
      word,
      kana,
      meaning: str(raw.meaning),
      pos: str(raw.pos),
      transitivity: str(raw.transitivity),
      note: str(raw.note),
      srs: (raw.srs as Vocabulary['srs']) ?? emptySrs(),
      createdAt: num(raw.createdAt),
      updatedAt: num(raw.updatedAt),
    }
    newVocab.push(record)
    vocabulary.push(record)
    vocabByKey.set(`${word}|${kana}`, record)
    vocabMap.set(id, record.id)
    added.vocabulary++
  }

  /* 语法 */
  const newGrammar: Grammar[] = []
  const grammarByKey = new Map(grammar.map((g) => [`${g.name.trim()}|${g.connection.trim()}`, g]))
  for (const raw of asArray(incoming.grammar)) {
    const id = str(raw.id)
    const name = str(raw.name).trim()
    if (!id || !name) {
      skipped++
      continue
    }
    const connection = str(raw.connection).trim()
    const existing = grammarByKey.get(`${name}|${connection}`) ?? grammar.find((g) => g.id === id)
    if (existing) {
      grammarMap.set(id, existing.id)
      skipped++
      continue
    }
    const rawFacets = (raw.facets as Partial<Record<GrammarFacet, unknown>>) ?? {}
    const facet = (key: GrammarFacet) =>
      (rawFacets[key] as Vocabulary['srs']) ?? emptySrs()
    const record: Grammar = {
      id,
      name,
      connection,
      meaning: str(raw.meaning),
      usage: str(raw.usage),
      category: str(raw.category),
      pitfalls: str(raw.pitfalls),
      note: str(raw.note),
      facets: {
        meaning: facet('meaning'),
        connection: facet('connection'),
        zhJa: facet('zhJa'),
        freeWrite: facet('freeWrite'),
      },
      createdAt: num(raw.createdAt),
      updatedAt: num(raw.updatedAt),
    }
    newGrammar.push(record)
    grammar.push(record)
    grammarByKey.set(`${name}|${connection}`, record)
    grammarMap.set(id, record.id)
    added.grammar++
  }

  const vocabIds = new Set(vocabulary.map((v) => v.id))
  const grammarIds = new Set(grammar.map((g) => g.id))
  const lessonIds = new Set(lessons.map((l) => l.id))

  /* 例句 */
  const exampleKeys = new Set(examples.map((e) => `${e.ownerType}|${e.ownerId}|${e.ja}|${e.zh}`))
  const newExamples: Example[] = []
  for (const raw of asArray(incoming.examples)) {
    const ownerType = raw.ownerType === 'grammar' ? 'grammar' : 'vocab'
    const ownerId = (ownerType === 'vocab' ? vocabMap.get(str(raw.ownerId)) : grammarMap.get(str(raw.ownerId))) ?? str(raw.ownerId)
    const ja = str(raw.ja).trim()
    const zh = str(raw.zh).trim()
    if (!ja && !zh) {
      skipped++
      continue
    }
    const valid = ownerType === 'vocab' ? vocabIds.has(ownerId) : grammarIds.has(ownerId)
    if (!valid) {
      skipped++
      continue
    }
    const key = `${ownerType}|${ownerId}|${ja}|${zh}`
    if (exampleKeys.has(key)) {
      skipped++
      continue
    }
    exampleKeys.add(key)
    newExamples.push({
      id: str(raw.id) || uid('e_'),
      ownerType,
      ownerId,
      ja,
      zh,
      order: typeof raw.order === 'number' ? raw.order : 0,
      createdAt: num(raw.createdAt),
    })
    added.examples++
  }

  /* 关联表 */
  const lvKeys = new Set(existingLV.map((l) => `${l.lessonId}|${l.vocabularyId}`))
  const lgKeys = new Set(existingLG.map((l) => `${l.lessonId}|${l.grammarId}`))
  const newLV: LessonVocabulary[] = []
  const newLG: LessonGrammar[] = []
  for (const raw of asArray(incoming.lesson_vocabulary)) {
    const lessonId = lessonMap.get(str(raw.lessonId)) ?? str(raw.lessonId)
    const vocabularyId = vocabMap.get(str(raw.vocabularyId)) ?? str(raw.vocabularyId)
    const key = `${lessonId}|${vocabularyId}`
    if (!lessonIds.has(lessonId) || !vocabIds.has(vocabularyId) || lvKeys.has(key)) {
      skipped++
      continue
    }
    lvKeys.add(key)
    newLV.push({ id: `${lessonId}__${vocabularyId}`, lessonId, vocabularyId })
    added.links++
  }
  for (const raw of asArray(incoming.lesson_grammar)) {
    const lessonId = lessonMap.get(str(raw.lessonId)) ?? str(raw.lessonId)
    const grammarId = grammarMap.get(str(raw.grammarId)) ?? str(raw.grammarId)
    const key = `${lessonId}|${grammarId}`
    if (!lessonIds.has(lessonId) || !grammarIds.has(grammarId) || lgKeys.has(key)) {
      skipped++
      continue
    }
    lgKeys.add(key)
    newLG.push({ id: `${lessonId}__${grammarId}`, lessonId, grammarId })
    added.links++
  }

  /* 复习记录 */
  const recordIds = new Set(records.map((r) => r.id))
  const newRecords: ReviewRecord[] = []
  for (const raw of asArray(incoming.review_records)) {
    const id = str(raw.id)
    const itemType: ItemKind = raw.itemType === 'grammar' ? 'grammar' : 'vocab'
    const itemId = (itemType === 'vocab' ? vocabMap.get(str(raw.itemId)) : grammarMap.get(str(raw.itemId))) ?? str(raw.itemId)
    const valid = itemType === 'vocab' ? vocabIds.has(itemId) : grammarIds.has(itemId)
    if (!id || recordIds.has(id) || !valid) {
      skipped++
      continue
    }
    recordIds.add(id)
    newRecords.push({
      id,
      itemType,
      itemId,
      mode: (raw.mode as ReviewMode) ?? 'vocab',
      facet: raw.facet as GrammarFacet | undefined,
      grade: (raw.grade as Grade) ?? 'ok',
      correct: typeof raw.correct === 'boolean' ? raw.correct : undefined,
      durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : undefined,
      createdAt: num(raw.createdAt),
    })
    added.review_records++
  }

  /* 错题 */
  const mistakeIds = new Set(mistakes.map((m) => m.id))
  const newMistakes: Mistake[] = []
  for (const raw of asArray(incoming.mistakes)) {
    const id = str(raw.id)
    const itemType: ItemKind = raw.itemType === 'grammar' ? 'grammar' : 'vocab'
    const itemId = (itemType === 'vocab' ? vocabMap.get(str(raw.itemId)) : grammarMap.get(str(raw.itemId))) ?? str(raw.itemId)
    const valid = itemType === 'vocab' ? vocabIds.has(itemId) : grammarIds.has(itemId)
    if (!id || mistakeIds.has(id) || !valid) {
      skipped++
      continue
    }
    mistakeIds.add(id)
    newMistakes.push({
      id,
      itemType,
      itemId,
      mode: (raw.mode as ReviewMode) ?? 'vocab',
      errorType: (raw.errorType as Mistake['errorType']) ?? 'recall',
      prompt: str(raw.prompt),
      userAnswer: str(raw.userAnswer),
      resolved: Boolean(raw.resolved),
      createdAt: num(raw.createdAt),
    })
    added.mistakes++
  }

  /* 练习记录 */
  const sessionIds = new Set(sessions.map((s) => s.id))
  const newSessions: StudySession[] = []
  for (const raw of asArray(incoming.study_sessions)) {
    const id = str(raw.id)
    if (!id || sessionIds.has(id)) {
      skipped++
      continue
    }
    sessionIds.add(id)
    const tasks = asArray(raw.tasks).map((t) => {
      const itemType: ItemKind = t.itemType === 'grammar' ? 'grammar' : 'vocab'
      const mapped = itemType === 'vocab' ? vocabMap.get(str(t.itemId)) : grammarMap.get(str(t.itemId))
      return { ...t, itemId: mapped ?? str(t.itemId) } as StudySession['tasks'][number]
    })
    newSessions.push({
      id,
      mode: (raw.mode as StudySession['mode']) ?? 'mixed',
      startedAt: num(raw.startedAt),
      endedAt: typeof raw.endedAt === 'number' ? raw.endedAt : undefined,
      updatedAt: num(raw.updatedAt),
      status: raw.status === 'done' ? 'done' : raw.status === 'abandoned' ? 'abandoned' : 'active',
      plannedMinutes: typeof raw.plannedMinutes === 'number' ? raw.plannedMinutes : undefined,
      tasks,
      index: typeof raw.index === 'number' ? raw.index : 0,
      results: asArray(raw.results) as unknown as StudySession['results'],
    })
    added.study_sessions++
  }

  await putMany('lessons', newLessons)
  await putMany('vocabulary', newVocab)
  await putMany('grammar', newGrammar)
  await putMany('examples', newExamples)
  await putMany('lesson_vocabulary', newLV)
  await putMany('lesson_grammar', newLG)
  await putMany('review_records', newRecords)
  await putMany('mistakes', newMistakes)
  await putMany('study_sessions', newSessions)

  return { added, skipped }
}

export async function clearEverything(): Promise<void> {
  await clearAllData()
}
