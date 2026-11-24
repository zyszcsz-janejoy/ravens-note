import type { Example, Grammar, ReviewMode, ReviewTask, Vocabulary } from '../types'
import { isDue } from './srs'
import { makeChoiceQuestion } from './quiz'
import { uid } from './utils'

export interface PlanData {
  vocabulary: Vocabulary[]
  grammar: Grammar[]
  examples: Example[]
}

export interface PlanPools {
  vocab: ReviewTask[]
  choice: ReviewTask[]
  zhJa: ReviewTask[]
  freeWrite: ReviewTask[]
}

function grammarExamples(data: PlanData, grammarId: string): Example[] {
  return data.examples
    .filter((e) => e.ownerType === 'grammar' && e.ownerId === grammarId && e.ja.trim().length > 0)
    .sort((a, b) => a.order - b.order)
}

function sortedVocab(list: Vocabulary[]): Vocabulary[] {
  return [...list].sort((a, b) => {
    const aNew = a.srs.reviews === 0
    const bNew = b.srs.reviews === 0
    if (aNew !== bNew) return aNew ? 1 : -1
    return a.srs.dueAt - b.srs.dueAt
  })
}

/** 今日到期的复习任务池 */
export function buildPools(data: PlanData, now = Date.now()): PlanPools {
  const vocab = sortedVocab(data.vocabulary.filter((v) => isDue(v.srs, now))).map<ReviewTask>((v) => ({
    key: uid('t_'),
    mode: 'vocab',
    itemType: 'vocab',
    itemId: v.id,
  }))

  const choice: ReviewTask[] = []
  const zhJa: ReviewTask[] = []
  const freeWrite: ReviewTask[] = []

  for (const g of data.grammar) {
    const meaningDue = isDue(g.facets.meaning, now)
    const connectionDue = isDue(g.facets.connection, now)
    if (meaningDue || connectionDue) {
      const prefer = meaningDue ? 'meaning' : 'connection'
      const question = makeChoiceQuestion(g, data.grammar, prefer)
      if (question) {
        choice.push({
          key: uid('t_'),
          mode: 'choice',
          itemType: 'grammar',
          itemId: g.id,
          facet: prefer,
          question,
        })
      }
    }

    const exs = grammarExamples(data, g.id)
    if (!exs.length) continue

    if (isDue(g.facets.zhJa, now)) {
      const example = exs.find((e) => e.zh.trim().length > 0)
      if (example) {
        zhJa.push({
          key: uid('t_'),
          mode: 'zhJa',
          itemType: 'grammar',
          itemId: g.id,
          facet: 'zhJa',
          prompt: example.zh.trim(),
          answer: example.ja.trim(),
        })
      }
    }

    if (isDue(g.facets.freeWrite, now)) {
      freeWrite.push({
        key: uid('t_'),
        mode: 'freeWrite',
        itemType: 'grammar',
        itemId: g.id,
        facet: 'freeWrite',
      })
    }
  }

  return { vocab, choice, zhJa, freeWrite }
}

/** 单项练习的补充池：到期内容不足时，用已录入内容继续练 */
function fallbackPools(data: PlanData, now: number): PlanPools {
  const vocab: ReviewTask[] = data.vocabulary.map((v) => ({
    key: uid('t_'),
    mode: 'vocab',
    itemType: 'vocab',
    itemId: v.id,
  }))

  const choice: ReviewTask[] = []
  const zhJa: ReviewTask[] = []
  const freeWrite: ReviewTask[] = []

  for (const g of data.grammar) {
    const question = makeChoiceQuestion(g, data.grammar, 'meaning')
    if (question) {
      choice.push({ key: uid('t_'), mode: 'choice', itemType: 'grammar', itemId: g.id, facet: 'meaning', question })
    }
    const exs = grammarExamples(data, g.id)
    if (!exs.length) continue
    const example = exs.find((e) => e.zh.trim().length > 0) ?? exs[0]
    zhJa.push({
      key: uid('t_'),
      mode: 'zhJa',
      itemType: 'grammar',
      itemId: g.id,
      facet: 'zhJa',
      prompt: example.zh.trim() || example.ja.trim(),
      answer: example.ja.trim(),
    })
    freeWrite.push({ key: uid('t_'), mode: 'freeWrite', itemType: 'grammar', itemId: g.id, facet: 'freeWrite' })
  }

  return { vocab, choice, zhJa, freeWrite }
}

function limitOf(minutes: number): number {
  switch (minutes) {
    case 3:
      return 5
    case 5:
      return 9
    case 10:
      return 18
    case 15:
      return 26
    default:
      return Number.MAX_SAFE_INTEGER
  }
}

export function minutesToCount(minutes: number): number {
  return limitOf(minutes)
}

const MIX_PATTERN: (keyof PlanPools)[] = ['vocab', 'choice', 'vocab', 'zhJa', 'vocab', 'choice', 'vocab', 'freeWrite']

export function buildTasks(
  data: PlanData,
  mode: ReviewMode | 'mixed',
  limit = Number.MAX_SAFE_INTEGER,
  now = Date.now(),
): ReviewTask[] {
  if (mode === 'mixed') {
    const pools = buildPools(data, now)
    const out: ReviewTask[] = []
    while (out.length < limit) {
      let progressed = false
      for (const key of MIX_PATTERN) {
        if (out.length >= limit) break
        const next = pools[key].shift()
        if (next) {
          out.push(next)
          progressed = true
        }
      }
      if (!progressed) break
    }
    return out
  }

  const due = buildPools(data, now)
  const all = fallbackPools(data, now)
  const primary = due[mode]
  const pool = primary.length ? primary : all[mode]
  return pool.slice(0, limit)
}

/** 首页展示用的数量统计 */
export function countPlan(data: PlanData, now = Date.now()): {
  vocab: number
  grammar: number
  zhJa: number
  freeWrite: number
  mixed: number
} {
  const pools = buildPools(data, now)
  const grammarDue = new Set(pools.choice.map((t) => t.itemId)).size
  return {
    vocab: pools.vocab.length,
    grammar: grammarDue,
    zhJa: pools.zhJa.length,
    freeWrite: pools.freeWrite.length,
    mixed: pools.vocab.length + pools.choice.length + pools.zhJa.length + pools.freeWrite.length,
  }
}
