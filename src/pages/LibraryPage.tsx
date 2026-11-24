import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GrammarForm, LessonForm, LinkPicker, VocabularyForm } from '../components/forms'
import LessonImagePanel from '../components/LessonImagePanel'
import {
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  MasteryBadge,
  PageHeader,
  SectionTitle,
  Segmented,
  Select,
  Sheet,
  TextInput,
} from '../components/ui'
import * as repo from '../db/repo'
import {
  FACETS,
  FACET_LABEL,
  MASTERY_LABEL,
  dueDays,
  grammarMastery,
  isNew,
  masteryBucket,
  type MasteryBucket,
} from '../lib/srs'
import { formatDate } from '../lib/utils'
import { useData } from '../store/AppData'
import type { Example, SrsState } from '../types'

type Tab = 'vocab' | 'grammar' | 'lesson'
type Detail = { kind: Tab; id: string }

const MASTERY_OPTIONS: { value: MasteryBucket; label: string }[] = [
  { value: 'new', label: '未学习' },
  { value: 'weak', label: '需加强' },
  { value: 'fuzzy', label: '模糊' },
  { value: 'ok', label: '基本掌握' },
  { value: 'strong', label: '熟练' },
]

function nextReviewText(srs: SrsState): string {
  if (srs.reviews === 0) return '尚未复习'
  const days = dueDays(srs)
  return days === 0 ? '今天到期' : `${days} 天后`
}

function sortedExamples(examples: Example[]): Example[] {
  return [...examples].sort((a, b) => a.order - b.order)
}

export default function LibraryPage() {
  const { vocabulary, grammar, lessons } = useData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rawTab = params.get('tab')
  const tab: Tab = rawTab === 'grammar' || rawTab === 'lesson' ? rawTab : 'vocab'
  const focus = params.get('focus')
  const [detail, setDetail] = useState<Detail | null>(null)

  useEffect(() => {
    if (focus) setDetail({ kind: tab, id: focus })
  }, [focus, tab])

  const changeTab = (next: Tab) => {
    setDetail(null)
    setParams({ tab: next }, { replace: true })
  }

  const closeDetail = () => {
    setDetail(null)
    if (focus) {
      const next = new URLSearchParams(params)
      next.delete('focus')
      next.set('tab', tab)
      setParams(next, { replace: true })
    }
  }

  return (
    <div>
      <PageHeader
        title="知识库"
        subtitle={`${vocabulary.length} 个词汇 · ${grammar.length} 条语法 · ${lessons.length} 篇课文`}
      />

      <Segmented<Tab>
        value={tab}
        onChange={changeTab}
        options={[
          { value: 'vocab', label: '词汇', count: vocabulary.length },
          { value: 'grammar', label: '语法', count: grammar.length },
          { value: 'lesson', label: '课文', count: lessons.length },
        ]}
      />

      <div className="mt-4">
        {tab === 'vocab' && <VocabTab onOpen={(id) => setDetail({ kind: 'vocab', id })} onAdd={() => navigate('/add')} />}
        {tab === 'grammar' && (
          <GrammarTab onOpen={(id) => setDetail({ kind: 'grammar', id })} onAdd={() => navigate('/add')} />
        )}
        {tab === 'lesson' && <LessonTab onOpen={(id) => setDetail({ kind: 'lesson', id })} />}
      </div>

      {detail?.kind === 'vocab' && <VocabDetailSheet vocabId={detail.id} onClose={closeDetail} />}
      {detail?.kind === 'grammar' && <GrammarDetailSheet grammarId={detail.id} onClose={closeDetail} />}
      {detail?.kind === 'lesson' && <LessonDetailSheet lessonId={detail.id} onClose={closeDetail} />}
    </div>
  )
}

/* ---------------- 词汇列表 ---------------- */

function VocabTab({ onOpen, onAdd }: { onOpen: (id: string) => void; onAdd: () => void }) {
  const { vocabulary, lessons, lessonVocabulary } = useData()
  const [query, setQuery] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [pos, setPos] = useState('')
  const [mastery, setMastery] = useState('')

  const lessonMap = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons])

  const lessonNames = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const link of lessonVocabulary) {
      const lesson = lessonMap.get(link.lessonId)
      if (!lesson) continue
      const list = map.get(link.vocabularyId) ?? []
      list.push(lesson.title)
      map.set(link.vocabularyId, list)
    }
    return map
  }, [lessonVocabulary, lessonMap])

  const posOptions = useMemo(
    () => Array.from(new Set(vocabulary.map((v) => v.pos).filter(Boolean))),
    [vocabulary],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const idsInLesson = lessonId
      ? new Set(lessonVocabulary.filter((l) => l.lessonId === lessonId).map((l) => l.vocabularyId))
      : null
    return vocabulary
      .filter((v) => {
        if (q && !`${v.word} ${v.kana} ${v.meaning} ${v.note}`.toLowerCase().includes(q)) return false
        if (idsInLesson && !idsInLesson.has(v.id)) return false
        if (pos && v.pos !== pos) return false
        if (mastery && masteryBucket(v.srs) !== mastery) return false
        return true
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [vocabulary, query, lessonId, pos, mastery, lessonVocabulary])

  return (
    <div>
      <TextInput placeholder="搜索单词、假名或意思" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="px-2.5 pr-8 text-[13px]">
          <option value="">全部课文</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </Select>
        <Select value={pos} onChange={(e) => setPos(e.target.value)} className="px-2.5 pr-8 text-[13px]">
          <option value="">全部词性</option>
          {posOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select value={mastery} onChange={(e) => setMastery(e.target.value)} className="px-2.5 pr-8 text-[13px]">
          <option value="">掌握程度</option>
          {MASTERY_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>

      <p className="mt-3 text-[11px] text-sub">共 {filtered.length} 个词汇</p>

      {filtered.length ? (
        <div className="mt-2 space-y-2">
          {filtered.map((v) => {
            const bucket = masteryBucket(v.srs)
            return (
              <Card key={v.id} className="p-3.5" onClick={() => onOpen(v.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-baseline gap-2">
                      <span lang="ja" className="text-[16px] font-medium">
                        {v.word}
                      </span>
                      {v.kana && (
                        <span lang="ja" className="text-[11px] text-sub">
                          {v.kana}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 truncate text-[12px] text-sub">{v.meaning || '未填写意思'}</p>
                  </div>
                  <MasteryBadge bucket={bucket} label={MASTERY_LABEL[bucket]} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-sub">
                  {v.pos && <span className="rounded-full bg-paper px-1.5 py-0.5">{v.pos}</span>}
                  {(lessonNames.get(v.id) ?? []).map((name) => (
                    <span key={name} className="truncate">
                      · {name}
                    </span>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState
            title={vocabulary.length ? '没有符合条件的词汇' : '词汇库还是空的'}
            desc={vocabulary.length ? '换个关键词或筛选条件试试。' : '添加词汇后，可以按课文、词性和掌握程度筛选。'}
            action={<Button onClick={onAdd}>添加词汇</Button>}
          />
        </div>
      )}
    </div>
  )
}

/* ---------------- 语法列表 ---------------- */

function GrammarTab({ onOpen, onAdd }: { onOpen: (id: string) => void; onAdd: () => void }) {
  const { grammar, lessons, lessonGrammar } = useData()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [mastery, setMastery] = useState('')

  const lessonMap = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons])
  const lessonNames = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const link of lessonGrammar) {
      const lesson = lessonMap.get(link.lessonId)
      if (!lesson) continue
      const list = map.get(link.grammarId) ?? []
      list.push(lesson.title)
      map.set(link.grammarId, list)
    }
    return map
  }, [lessonGrammar, lessonMap])

  const categories = useMemo(
    () => Array.from(new Set(grammar.map((g) => g.category).filter(Boolean))),
    [grammar],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return grammar
      .filter((g) => {
        if (q && !`${g.name} ${g.meaning} ${g.connection} ${g.usage}`.toLowerCase().includes(q)) return false
        if (category && g.category !== category) return false
        if (mastery && masteryBucket(grammarMastery(g.facets)) !== mastery) return false
        return true
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [grammar, query, category, mastery])

  return (
    <div>
      <TextInput placeholder="搜索语法名称、意思或接续" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="px-2.5 pr-8 text-[13px]">
          <option value="">全部分类</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select value={mastery} onChange={(e) => setMastery(e.target.value)} className="px-2.5 pr-8 text-[13px]">
          <option value="">掌握程度</option>
          {MASTERY_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>

      <p className="mt-3 text-[11px] text-sub">共 {filtered.length} 条语法</p>

      {filtered.length ? (
        <div className="mt-2 space-y-2">
          {filtered.map((g) => {
            const overall = grammarMastery(g.facets)
            const bucket = masteryBucket(overall)
            return (
              <Card key={g.id} className="p-3.5" onClick={() => onOpen(g.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p lang="ja" className="text-[16px] font-medium">
                      {g.name}
                    </p>
                    <p className="mt-1 truncate text-[12px] text-sub">{g.meaning || '未填写意思'}</p>
                  </div>
                  <MasteryBadge bucket={bucket} label={MASTERY_LABEL[bucket]} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-sub">
                  {g.category && <span className="rounded-full bg-paper px-1.5 py-0.5">{g.category}</span>}
                  {(lessonNames.get(g.id) ?? []).map((name) => (
                    <span key={name} className="truncate">
                      · {name}
                    </span>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState
            title={grammar.length ? '没有符合条件的语法' : '语法库还是空的'}
            desc={grammar.length ? '换个关键词或筛选条件试试。' : '添加语法后，可以生成选择题和造句练习。'}
            action={<Button onClick={onAdd}>添加语法</Button>}
          />
        </div>
      )}
    </div>
  )
}

/* ---------------- 课文列表 ---------------- */

function LessonTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { lessons, lessonVocabulary, lessonGrammar, lessonImages } = useData()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const imageLessonIds = useMemo(() => new Set(lessonImages.map((i) => i.lessonId)), [lessonImages])

  const vocabCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const link of lessonVocabulary) map.set(link.lessonId, (map.get(link.lessonId) ?? 0) + 1)
    return map
  }, [lessonVocabulary])

  const grammarCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const link of lessonGrammar) map.set(link.lessonId, (map.get(link.lessonId) ?? 0) + 1)
    return map
  }, [lessonGrammar])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...lessons]
      .filter((l) => !q || `${l.title} ${l.theme} ${l.note}`.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [lessons, query])

  return (
    <div>
      <div className="flex gap-2">
        <TextInput placeholder="搜索课文" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button variant="soft" className="shrink-0 px-4" onClick={() => setCreating(true)}>
          ＋ 新建
        </Button>
      </div>

      <p className="mt-3 text-[11px] text-sub">共 {filtered.length} 篇课文</p>

      {filtered.length ? (
        <div className="mt-2 space-y-2">
          {filtered.map((lesson) => (
            <Card key={lesson.id} className="p-4" onClick={() => onOpen(lesson.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{lesson.title}</p>
                  <p className="mt-1 text-[12px] text-sub">
                    {vocabCount.get(lesson.id) ?? 0} 个词汇 · {grammarCount.get(lesson.id) ?? 0} 个语法
                    {lesson.theme ? ` · ${lesson.theme}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {imageLessonIds.has(lesson.id) && (
                    <span className="rounded-full bg-pine/10 px-2 py-0.5 text-[10px] text-pine">
                      二维码
                    </span>
                  )}
                  <span className="text-[11px] text-sub">{formatDate(lesson.updatedAt)}</span>
                </div>
              </div>
              {lesson.note && <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-sub">{lesson.note}</p>}
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState
            title={lessons.length ? '没有找到课文' : '还没有课文'}
            desc="课文可以把词汇和语法按学习顺序组织起来。"
            action={<Button onClick={() => setCreating(true)}>新建课文</Button>}
          />
        </div>
      )}

      <Sheet open={creating} title="新建课文" onClose={() => setCreating(false)}>
        <LessonForm onSaved={() => setCreating(false)} />
      </Sheet>
    </div>
  )
}

/* ---------------- 词汇详情 ---------------- */

function VocabDetailSheet({ vocabId, onClose }: { vocabId: string; onClose: () => void }) {
  const { vocabulary, examples, lessons, lessonVocabulary, refresh, notify } = useData()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const vocab = vocabulary.find((v) => v.id === vocabId)

  const exs = useMemo(
    () => sortedExamples(examples.filter((e) => e.ownerType === 'vocab' && e.ownerId === vocabId)),
    [examples, vocabId],
  )
  const lessonIds = useMemo(
    () => lessonVocabulary.filter((l) => l.vocabularyId === vocabId).map((l) => l.lessonId),
    [lessonVocabulary, vocabId],
  )
  const linkedLessons = lessons.filter((l) => lessonIds.includes(l.id))

  if (!vocab) return null

  const bucket = masteryBucket(vocab.srs)

  const remove = async () => {
    await repo.deleteVocabulary(vocab.id)
    await refresh()
    notify('词汇已删除')
    setConfirming(false)
    onClose()
  }

  return (
    <Sheet open title={editing ? '编辑词汇' : '词汇详情'} onClose={onClose}>
      {editing ? (
        <VocabularyForm
          initial={vocab}
          initialLessonIds={lessonIds}
          initialExamples={exs}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p lang="ja" className="text-[28px] font-medium leading-snug">
                {vocab.word}
              </p>
              <p lang="ja" className="mt-1 text-[14px] text-sub">
                {vocab.kana || '未填写假名'}
              </p>
            </div>
            <MasteryBadge bucket={bucket} label={MASTERY_LABEL[bucket]} />
          </div>

          <p className="text-[16px] leading-relaxed">{vocab.meaning || '未填写意思'}</p>

          <div className="flex flex-wrap gap-1.5 text-[11px] text-sub">
            {vocab.pos && <span className="rounded-full bg-card px-2 py-0.5">{vocab.pos}</span>}
            {vocab.transitivity && <span className="rounded-full bg-card px-2 py-0.5">{vocab.transitivity}</span>}
            {linkedLessons.map((l) => (
              <span key={l.id} className="rounded-full bg-pine-soft px-2 py-0.5 text-pine">
                {l.title}
              </span>
            ))}
          </div>

          <Card className="p-4">
            <p className="text-[11px] text-sub">复习状态</p>
            <div className="mt-2 flex justify-between text-[13px]">
              <span>已复习 {vocab.srs.reviews} 次</span>
              <span>下次：{nextReviewText(vocab.srs)}</span>
            </div>
          </Card>

          <div>
            <SectionTitle>例句</SectionTitle>
            {exs.length ? (
              <div className="space-y-2">
                {exs.map((ex) => (
                  <div key={ex.id} className="rounded-xl2 border border-line bg-card p-3.5">
                    <p lang="ja" className="text-[14px] leading-relaxed">
                      {ex.ja}
                    </p>
                    {ex.zh && <p className="mt-1 text-[12px] text-sub">{ex.zh}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-sub">还没有例句</p>
            )}
          </div>

          {vocab.note && (
            <div>
              <SectionTitle>备注</SectionTitle>
              <p className="whitespace-pre-line rounded-xl2 bg-card p-3.5 text-[13px] leading-relaxed text-sub">
                {vocab.note}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Button variant="soft" onClick={() => setEditing(true)}>
              编辑
            </Button>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              删除
            </Button>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={confirming}
        title="删除这个词汇？"
        desc="相关的例句、课文关联、复习记录和错题也会一起删除，且无法恢复。"
        onClose={() => setConfirming(false)}
        onConfirm={() => void remove()}
      />
    </Sheet>
  )
}

/* ---------------- 语法详情 ---------------- */

function GrammarDetailSheet({ grammarId, onClose }: { grammarId: string; onClose: () => void }) {
  const { grammar, examples, lessons, lessonGrammar, refresh, notify } = useData()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const item = grammar.find((g) => g.id === grammarId)

  const exs = useMemo(
    () => sortedExamples(examples.filter((e) => e.ownerType === 'grammar' && e.ownerId === grammarId)),
    [examples, grammarId],
  )
  const lessonIds = useMemo(
    () => lessonGrammar.filter((l) => l.grammarId === grammarId).map((l) => l.lessonId),
    [lessonGrammar, grammarId],
  )
  const linkedLessons = lessons.filter((l) => lessonIds.includes(l.id))

  if (!item) return null

  const remove = async () => {
    await repo.deleteGrammar(item.id)
    await refresh()
    notify('语法已删除')
    setConfirming(false)
    onClose()
  }

  return (
    <Sheet open title={editing ? '编辑语法' : '语法详情'} onClose={onClose}>
      {editing ? (
        <GrammarForm
          initial={item}
          initialLessonIds={lessonIds}
          initialExamples={exs}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <div className="space-y-4">
          <div>
            <p lang="ja" className="text-[24px] font-medium leading-snug">
              {item.name}
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed">{item.meaning || '未填写意思'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              {item.category && <span className="rounded-full bg-card px-2 py-0.5 text-sub">{item.category}</span>}
              {linkedLessons.map((l) => (
                <span key={l.id} className="rounded-full bg-pine-soft px-2 py-0.5 text-pine">
                  {l.title}
                </span>
              ))}
            </div>
          </div>

          {item.connection && (
            <Card className="p-4">
              <p className="text-[11px] text-sub">接续</p>
              <p lang="ja" className="mt-1 text-[14px] leading-relaxed">
                {item.connection}
              </p>
            </Card>
          )}

          <div>
            <SectionTitle>四项掌握程度</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {FACETS.map((facet) => {
                const srs = item.facets[facet]
                const bucket = masteryBucket(srs)
                return (
                  <div key={facet} className="rounded-xl2 border border-line bg-card p-3">
                    <p className="text-[11px] text-sub">{FACET_LABEL[facet]}</p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-[13px] font-medium">{MASTERY_LABEL[bucket]}</span>
                      <span className="text-[10px] text-sub">
                        {isNew(srs) ? '未练' : nextReviewText(srs)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {item.usage && (
            <div>
              <SectionTitle>使用说明</SectionTitle>
              <p className="whitespace-pre-line rounded-xl2 bg-card p-3.5 text-[13px] leading-relaxed text-sub">
                {item.usage}
              </p>
            </div>
          )}

          <div>
            <SectionTitle>例句</SectionTitle>
            {exs.length ? (
              <div className="space-y-2">
                {exs.map((ex) => (
                  <div key={ex.id} className="rounded-xl2 border border-line bg-card p-3.5">
                    <p lang="ja" className="text-[14px] leading-relaxed">
                      {ex.ja}
                    </p>
                    {ex.zh && <p className="mt-1 text-[12px] text-sub">{ex.zh}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-sub">还没有例句，中译日和造句练习需要例句作参考。</p>
            )}
          </div>

          {item.pitfalls && (
            <div>
              <SectionTitle>易错点</SectionTitle>
              <p className="whitespace-pre-line rounded-xl2 bg-clay-soft/50 p-3.5 text-[13px] leading-relaxed text-clay">
                {item.pitfalls}
              </p>
            </div>
          )}

          {item.note && (
            <div>
              <SectionTitle>个人备注</SectionTitle>
              <p className="whitespace-pre-line rounded-xl2 bg-card p-3.5 text-[13px] leading-relaxed text-sub">
                {item.note}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Button variant="soft" onClick={() => setEditing(true)}>
              编辑
            </Button>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              删除
            </Button>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={confirming}
        title="删除这个语法？"
        desc="相关的例句、课文关联、复习记录和错题也会一起删除，且无法恢复。"
        onClose={() => setConfirming(false)}
        onConfirm={() => void remove()}
      />
    </Sheet>
  )
}

/* ---------------- 课文详情 ---------------- */

function LessonDetailSheet({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const { lessons, vocabulary, grammar, lessonVocabulary, lessonGrammar, refresh, notify } = useData()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [linkKind, setLinkKind] = useState<'vocab' | 'grammar' | null>(null)
  const lesson = lessons.find((l) => l.id === lessonId)

  const linkedVocab = useMemo(() => {
    const ids = new Set(
      lessonVocabulary.filter((l) => l.lessonId === lessonId).map((l) => l.vocabularyId),
    )
    return vocabulary.filter((v) => ids.has(v.id))
  }, [lessonVocabulary, vocabulary, lessonId])

  const linkedGrammar = useMemo(() => {
    const ids = new Set(lessonGrammar.filter((l) => l.lessonId === lessonId).map((l) => l.grammarId))
    return grammar.filter((g) => ids.has(g.id))
  }, [lessonGrammar, grammar, lessonId])

  if (!lesson) return null

  const remove = async () => {
    await repo.deleteLesson(lesson.id)
    await refresh()
    notify('课文已删除')
    setConfirming(false)
    onClose()
  }

  return (
    <Sheet open title={editing ? '编辑课文' : '课文详情'} onClose={onClose}>
      {editing ? (
        <LessonForm initial={lesson} onSaved={() => setEditing(false)} />
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-[20px] font-semibold leading-snug">{lesson.title}</p>
            <p className="mt-1 text-[12px] text-sub">
              {lesson.theme || '未填写主题'} · 更新于 {formatDate(lesson.updatedAt)}
            </p>
          </div>

          {lesson.note && (
            <div>
              <SectionTitle>个人笔记</SectionTitle>
              <p className="whitespace-pre-line rounded-xl2 bg-card p-3.5 text-[13px] leading-relaxed text-sub">
                {lesson.note}
              </p>
            </div>
          )}

          <LessonImagePanel lessonId={lesson.id} />

          <div>
            <SectionTitle
              extra={
                <button type="button" onClick={() => setLinkKind('vocab')} className="text-[12px] text-pine">
                  管理
                </button>
              }
            >
              关联词汇 · {linkedVocab.length}
            </SectionTitle>
            {linkedVocab.length ? (
              <div className="space-y-1.5">
                {linkedVocab.map((v) => (
                  <div key={v.id} className="rounded-xl2 border border-line bg-card px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p lang="ja" className="text-[14px]">
                        {v.word}
                      </p>
                      <span className="shrink-0 text-[10px] text-sub">{MASTERY_LABEL[masteryBucket(v.srs)]}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-sub">{v.meaning}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-sub">还没有关联词汇</p>
            )}
          </div>

          <div>
            <SectionTitle
              extra={
                <button type="button" onClick={() => setLinkKind('grammar')} className="text-[12px] text-pine">
                  管理
                </button>
              }
            >
              关联语法 · {linkedGrammar.length}
            </SectionTitle>
            {linkedGrammar.length ? (
              <div className="space-y-1.5">
                {linkedGrammar.map((g) => (
                  <div key={g.id} className="rounded-xl2 border border-line bg-card px-3 py-2.5">
                    <p lang="ja" className="text-[14px]">
                      {g.name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-sub">{g.meaning}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-sub">还没有关联语法</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Button variant="soft" onClick={() => setEditing(true)}>
              编辑
            </Button>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              删除
            </Button>
          </div>
        </div>
      )}

      <Sheet open={linkKind !== null} title={linkKind === 'vocab' ? '关联词汇' : '关联语法'} onClose={() => setLinkKind(null)}>
        {linkKind && (
          <LinkPicker
            kind={linkKind}
            title={lesson.title}
            selectedIds={linkKind === 'vocab' ? linkedVocab.map((v) => v.id) : linkedGrammar.map((g) => g.id)}
            onSave={async (ids) => {
              await repo.setLessonItems(linkKind, lesson.id, ids)
              await refresh()
              setLinkKind(null)
            }}
          />
        )}
      </Sheet>

      <ConfirmSheet
        open={confirming}
        title="删除这篇课文？"
        desc="课文与词汇、语法的关联会一起删除，但词汇和语法本身会保留。"
        onClose={() => setConfirming(false)}
        onConfirm={() => void remove()}
      />
    </Sheet>
  )
}
