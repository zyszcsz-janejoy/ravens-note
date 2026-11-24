import { useEffect, useMemo, useState } from 'react'
import * as repo from '../db/repo'
import type { Example, Grammar, Lesson, Vocabulary } from '../types'
import { useData } from '../store/AppData'
import { Button, Card, Chip, Field, Select, TextArea, TextInput } from './ui'

export interface ExampleDraft {
  ja: string
  zh: string
}

const POS_OPTIONS = ['名词', '动词', 'い形容词', 'な形容词', '副词', '助词', '接续词', '连体词', '感叹词', '其他']
const TRANSITIVITY_OPTIONS = ['', '自动词', '他动词']
const CATEGORY_OPTIONS = ['助词', '句型', '动词变形', '时态', '敬语', '副词', '接续', '其他']

function useDraft<T extends object>(key: string, initial: () => T, enabled: boolean) {
  const [value, setValue] = useState<T>(() => {
    if (!enabled) return initial()
    try {
      const raw = localStorage.getItem(key)
      if (raw) return { ...initial(), ...(JSON.parse(raw) as Partial<T>) }
    } catch {
      /* ignore */
    }
    return initial()
  })

  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        /* ignore */
      }
    }, 400)
    return () => window.clearTimeout(timer)
  })

  const clear = () => {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }

  return [value, setValue, clear] as const
}

/* ---------------- 例句编辑 ---------------- */

export function ExampleRows({ value, onChange }: { value: ExampleDraft[]; onChange: (value: ExampleDraft[]) => void }) {
  const rows = value.length ? value : [{ ja: '', zh: '' }]

  const update = (index: number, patch: Partial<ExampleDraft>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row, index) => (
        <div key={index} className="rounded-xl2 border border-line bg-paper/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] text-sub">例句 {index + 1}</span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                className="text-[11px] text-clay"
              >
                删除
              </button>
            )}
          </div>
          <div className="space-y-2">
            <TextInput
              placeholder="日语例句"
              lang="ja"
              value={row.ja}
              onChange={(e) => update(index, { ja: e.target.value })}
            />
            <TextInput
              placeholder="例句的中文翻译"
              value={row.zh}
              onChange={(e) => update(index, { zh: e.target.value })}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { ja: '', zh: '' }])}
        className="w-full rounded-xl2 border border-dashed border-line py-2.5 text-[13px] text-pine active:bg-pine-soft/50"
      >
        ＋ 添加一句例句
      </button>
    </div>
  )
}

/* ---------------- 课文选择 ---------------- */

export function LessonPicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const { lessons, refresh, notify } = useData()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  const create = async () => {
    const clean = title.trim()
    if (!clean) {
      notify('请填写课文名称', 'error')
      return
    }
    setBusy(true)
    try {
      const lesson = await repo.saveLesson({ title: clean, theme: '', note: '' })
      await refresh()
      onChange([...selected, lesson.id])
      setTitle('')
      setAdding(false)
      notify('已新建课文')
    } catch {
      notify('新建失败，请重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {lessons.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {lessons.map((lesson) => (
            <Chip key={lesson.id} active={selected.includes(lesson.id)} onClick={() => toggle(lesson.id)}>
              {lesson.title}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-sub">还没有课文，可以先在下面新建一篇。</p>
      )}

      {adding ? (
        <div className="mt-2.5 flex gap-2">
          <TextInput
            autoFocus
            placeholder="课文名称，例如：第 3 课"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button type="button" variant="soft" onClick={create} disabled={busy} className="shrink-0 px-4">
            新建
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2.5 text-[12px] text-pine active:opacity-70"
        >
          ＋ 新建课文
        </button>
      )}
    </div>
  )
}

/* ---------------- 词汇表单 ---------------- */

interface VocabState {
  word: string
  kana: string
  meaning: string
  pos: string
  transitivity: string
  note: string
  examples: ExampleDraft[]
  lessonIds: string[]
}

const emptyVocab = (): VocabState => ({
  word: '',
  kana: '',
  meaning: '',
  pos: '',
  transitivity: '',
  note: '',
  examples: [{ ja: '', zh: '' }],
  lessonIds: [],
})

function toDrafts(examples: Example[]): ExampleDraft[] {
  const rows = examples
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((e) => ({ ja: e.ja, zh: e.zh }))
  return rows.length ? rows : [{ ja: '', zh: '' }]
}

export function VocabularyForm({
  initial,
  initialLessonIds = [],
  initialExamples = [],
  onSaved,
}: {
  initial?: Vocabulary
  initialLessonIds?: string[]
  initialExamples?: Example[]
  onSaved?: (vocab: Vocabulary) => void
}) {
  const { refresh, notify } = useData()
  const isEdit = Boolean(initial)
  const [form, setForm, clearDraft] = useDraft<VocabState>(
    'ravn.draft.vocab',
    () => ({ ...emptyVocab(), lessonIds: initialLessonIds, examples: toDrafts(initialExamples) }),
    !isEdit,
  )
  const [saving, setSaving] = useState(false)

  const patch = (value: Partial<VocabState>) => setForm((prev) => ({ ...prev, ...value }))

  const submit = async () => {
    if (!form.word.trim()) {
      notify('请填写日语单词', 'error')
      return
    }
    if (!form.meaning.trim()) {
      notify('请填写中文意思', 'error')
      return
    }
    setSaving(true)
    try {
      const saved = await repo.saveVocabulary(
        {
          word: form.word.trim(),
          kana: form.kana.trim(),
          meaning: form.meaning.trim(),
          pos: form.pos,
          transitivity: form.transitivity,
          note: form.note.trim(),
        },
        initial,
      )
      await repo.setItemLessons('vocab', saved.id, form.lessonIds)
      await repo.replaceExamples('vocab', saved.id, form.examples)
      await refresh()
      clearDraft()
      notify(isEdit ? '词汇已更新' : '已添加到词汇库')
      if (isEdit) {
        onSaved?.(saved)
      } else {
        setForm({ ...emptyVocab(), lessonIds: form.lessonIds })
        onSaved?.(saved)
      }
    } catch (err) {
      console.error(err)
      notify('保存失败，请重试', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="space-y-4"
    >
      {!isEdit && (
        <p className="text-[12px] leading-relaxed text-sub">
          填写内容会自动保存为本机草稿，保存后可继续录入下一个。带 <span className="text-clay">*</span> 为必填。
        </p>
      )}

      <Card className="space-y-4 p-4">
        <Field label="日语单词" required>
          <TextInput
            lang="ja"
            placeholder="例如：教科書"
            value={form.word}
            onChange={(e) => patch({ word: e.target.value })}
          />
        </Field>
        <Field label="假名">
          <TextInput
            lang="ja"
            placeholder="例如：きょうかしょ"
            value={form.kana}
            onChange={(e) => patch({ kana: e.target.value })}
          />
        </Field>
        <Field label="中文意思" required>
          <TextInput
            placeholder="例如：教科书"
            value={form.meaning}
            onChange={(e) => patch({ meaning: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="词性">
            <Select value={form.pos} onChange={(e) => patch({ pos: e.target.value })}>
              <option value="">未分类</option>
              {POS_OPTIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="自他动词">
            <Select value={form.transitivity} onChange={(e) => patch({ transitivity: e.target.value })}>
              {TRANSITIVITY_OPTIONS.map((opt) => (
                <option key={opt || 'none'} value={opt}>
                  {opt || '不适用'}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <p className="text-[13px] text-sub">例句</p>
          <p className="mt-0.5 text-[11px] text-sub/70">中译日练习会用到带中文翻译的例句。</p>
        </div>
        <ExampleRows value={form.examples} onChange={(examples) => patch({ examples })} />
      </Card>

      <Card className="space-y-4 p-4">
        <Field label="来源课文">
          <LessonPicker selected={form.lessonIds} onChange={(lessonIds) => patch({ lessonIds })} />
        </Field>
        <Field label="备注">
          <TextArea
            placeholder="记忆方法、易混淆的词等"
            value={form.note}
            onChange={(e) => patch({ note: e.target.value })}
            className="min-h-[72px]"
          />
        </Field>
      </Card>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? '保存中…' : isEdit ? '保存修改' : '保存词汇'}
      </Button>
    </form>
  )
}

/* ---------------- 语法表单 ---------------- */

interface GrammarState {
  name: string
  connection: string
  meaning: string
  usage: string
  category: string
  pitfalls: string
  note: string
  examples: ExampleDraft[]
  lessonIds: string[]
}

const emptyGrammar = (): GrammarState => ({
  name: '',
  connection: '',
  meaning: '',
  usage: '',
  category: '',
  pitfalls: '',
  note: '',
  examples: [{ ja: '', zh: '' }],
  lessonIds: [],
})

export function GrammarForm({
  initial,
  initialLessonIds = [],
  initialExamples = [],
  onSaved,
}: {
  initial?: Grammar
  initialLessonIds?: string[]
  initialExamples?: Example[]
  onSaved?: (grammar: Grammar) => void
}) {
  const { refresh, notify } = useData()
  const isEdit = Boolean(initial)
  const [form, setForm, clearDraft] = useDraft<GrammarState>(
    'ravn.draft.grammar',
    () => ({
      name: initial?.name ?? '',
      connection: initial?.connection ?? '',
      meaning: initial?.meaning ?? '',
      usage: initial?.usage ?? '',
      category: initial?.category ?? '',
      pitfalls: initial?.pitfalls ?? '',
      note: initial?.note ?? '',
      examples: toDrafts(initialExamples),
      lessonIds: initialLessonIds,
    }),
    !isEdit,
  )
  const [saving, setSaving] = useState(false)

  const patch = (value: Partial<GrammarState>) => setForm((prev) => ({ ...prev, ...value }))

  const submit = async () => {
    if (!form.name.trim()) {
      notify('请填写语法名称', 'error')
      return
    }
    if (!form.meaning.trim()) {
      notify('请填写中文意思', 'error')
      return
    }
    setSaving(true)
    try {
      const saved = await repo.saveGrammar(
        {
          name: form.name.trim(),
          connection: form.connection.trim(),
          meaning: form.meaning.trim(),
          usage: form.usage.trim(),
          category: form.category,
          pitfalls: form.pitfalls.trim(),
          note: form.note.trim(),
        },
        initial,
      )
      await repo.setItemLessons('grammar', saved.id, form.lessonIds)
      await repo.replaceExamples('grammar', saved.id, form.examples)
      await refresh()
      clearDraft()
      notify(isEdit ? '语法已更新' : '已添加到语法库')
      if (isEdit) {
        onSaved?.(saved)
      } else {
        setForm({ ...emptyGrammar(), lessonIds: form.lessonIds })
        onSaved?.(saved)
      }
    } catch (err) {
      console.error(err)
      notify('保存失败，请重试', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="space-y-4"
    >
      {!isEdit && (
        <p className="text-[12px] leading-relaxed text-sub">
          填写内容会自动保存为本机草稿。语法的意思、接续、中译日、造句会分别记录熟练度。
        </p>
      )}

      <Card className="space-y-4 p-4">
        <Field label="语法名称" required>
          <TextInput
            lang="ja"
            placeholder="例如：～てしまう"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label="接续方式">
          <TextInput
            lang="ja"
            placeholder="例如：动词て形 + しまう"
            value={form.connection}
            onChange={(e) => patch({ connection: e.target.value })}
          />
        </Field>
        <Field label="中文意思" required>
          <TextInput
            placeholder="例如：表示动作完成／遗憾"
            value={form.meaning}
            onChange={(e) => patch({ meaning: e.target.value })}
          />
        </Field>
        <Field label="语法分类">
          <Select value={form.category} onChange={(e) => patch({ category: e.target.value })}>
            <option value="">未分类</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="使用说明">
          <TextArea
            placeholder="什么时候用、语感、和相似语法的区别"
            value={form.usage}
            onChange={(e) => patch({ usage: e.target.value })}
          />
        </Field>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <p className="text-[13px] text-sub">例句</p>
          <p className="mt-0.5 text-[11px] text-sub/70">中译日和自由造句会把这里的例句作为参考答案。</p>
        </div>
        <ExampleRows value={form.examples} onChange={(examples) => patch({ examples })} />
      </Card>

      <Card className="space-y-4 p-4">
        <Field label="来源课文">
          <LessonPicker selected={form.lessonIds} onChange={(lessonIds) => patch({ lessonIds })} />
        </Field>
        <Field label="易错点">
          <TextArea
            placeholder="容易和什么混淆、接续容易错在哪里"
            value={form.pitfalls}
            onChange={(e) => patch({ pitfalls: e.target.value })}
            className="min-h-[72px]"
          />
        </Field>
        <Field label="个人备注">
          <TextArea
            placeholder="自己的理解、记忆口诀"
            value={form.note}
            onChange={(e) => patch({ note: e.target.value })}
            className="min-h-[72px]"
          />
        </Field>
      </Card>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? '保存中…' : isEdit ? '保存修改' : '保存语法'}
      </Button>
    </form>
  )
}

/* ---------------- 课文表单 ---------------- */

export function LessonForm({ initial, onSaved }: { initial?: Lesson; onSaved?: (lesson: Lesson) => void }) {
  const { refresh, notify } = useData()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [theme, setTheme] = useState(initial?.theme ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim()) {
      notify('请填写课文名称', 'error')
      return
    }
    setSaving(true)
    try {
      const saved = await repo.saveLesson(
        { title: title.trim(), theme: theme.trim(), note: note.trim() },
        initial,
      )
      await refresh()
      notify(initial ? '课文已更新' : '课文已创建')
      onSaved?.(saved)
    } catch {
      notify('保存失败，请重试', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="space-y-4"
    >
      <Card className="space-y-4 p-4">
        <Field label="课文名称" required>
          <TextInput
            placeholder="例如：第 1 课 雨ニモマケズ"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="课文主题">
          <TextInput
            placeholder="例如：自然、校园生活"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          />
        </Field>
        <Field label="个人笔记">
          <TextArea
            placeholder="这篇课文讲了什么、印象深的句子"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </Card>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? '保存中…' : initial ? '保存修改' : '创建课文'}
      </Button>
    </form>
  )
}

/* ---------------- 关联内容选择 ---------------- */

export function LinkPicker({
  kind,
  title,
  selectedIds,
  onSave,
}: {
  kind: 'vocab' | 'grammar'
  title: string
  selectedIds: string[]
  onSave: (ids: string[]) => Promise<void>
}) {
  const { vocabulary, grammar, notify } = useData()
  const [picked, setPicked] = useState<string[]>(selectedIds)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (kind === 'vocab') {
      return vocabulary
        .filter((v) => !q || v.word.toLowerCase().includes(q) || v.kana.includes(q) || v.meaning.includes(q))
        .map((v) => ({ id: v.id, title: v.word, sub: [v.kana, v.meaning].filter(Boolean).join(' · ') }))
    }
    return grammar
      .filter((g) => !q || g.name.includes(q) || g.meaning.includes(q))
      .map((g) => ({ id: g.id, title: g.name, sub: g.meaning }))
  }, [kind, query, vocabulary, grammar])

  const toggle = (id: string) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-3">
      <TextInput placeholder="搜索…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <p className="text-[11px] text-sub">已选 {picked.length} 项 · {title}</p>
      <div className="max-h-[46vh] space-y-1.5 overflow-y-auto rounded-xl2 border border-line bg-card p-2">
        {items.length === 0 && <p className="px-2 py-4 text-center text-[13px] text-sub">没有可关联的内容</p>}
        {items.map((item) => {
          const active = picked.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left ${
                active ? 'bg-pine-soft' : 'active:bg-line/30'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  active ? 'border-pine bg-pine text-paper' : 'border-line'
                }`}
              >
                {active && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px]">{item.title}</span>
                {item.sub && <span className="mt-0.5 block truncate text-[11px] text-sub">{item.sub}</span>}
              </span>
            </button>
          )
        })}
      </div>
      <Button
        className="w-full"
        disabled={saving}
        onClick={async () => {
          setSaving(true)
          try {
            await onSave(picked)
            notify('关联已更新')
          } catch {
            notify('保存失败，请重试', 'error')
          } finally {
            setSaving(false)
          }
        }}
      >
        {saving ? '保存中…' : '保存关联'}
      </Button>
    </div>
  )
}
