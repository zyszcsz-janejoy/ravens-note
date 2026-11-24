import type { ChoiceQuestion, Grammar } from '../types'

function shuffle<T>(list: T[]): T[] {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 根据语法制一道选择题；干扰项来自其他语法的意思/接续 */
export function makeChoiceQuestion(
  target: Grammar,
  pool: Grammar[],
  prefer: 'meaning' | 'connection' = 'meaning',
): ChoiceQuestion | null {
  const canUseConnection = prefer === 'connection' && target.connection.trim().length > 0
  const kind: 'meaning' | 'connection' = canUseConnection ? 'connection' : 'meaning'
  const correct = (kind === 'meaning' ? target.meaning : target.connection).trim()
  if (!target.name.trim() || !correct) return null

  const others = pool
    .filter((g) => g.id !== target.id)
    .map((g) => (kind === 'meaning' ? g.meaning : g.connection).trim())
    .filter((v) => v.length > 0 && v !== correct)

  const unique = Array.from(new Set(others))
  if (!unique.length) return null

  const options = shuffle([correct, ...shuffle(unique).slice(0, 3)])
  const label = kind === 'meaning' ? '意思' : '接续'
  const explanation = [
    `意思：${target.meaning || '未填写'}`,
    `接续：${target.connection || '未填写'}`,
    target.usage ? `说明：${target.usage}` : '',
    target.pitfalls ? `易错点：${target.pitfalls}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    kind,
    prompt: `「${target.name}」的正确${label}是？`,
    options,
    answer: correct,
    explanation,
    grammarId: target.id,
  }
}
