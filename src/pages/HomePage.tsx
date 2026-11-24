import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Chip, EmptyState, SectionTitle } from '../components/ui'
import { countPlan, buildTasks, minutesToCount } from '../lib/plan'
import { formatDateLabel, formatDate } from '../lib/utils'
import { useData } from '../store/AppData'

const TIME_OPTIONS = [
  { label: '3 分钟', value: 3 },
  { label: '5 分钟', value: 5 },
  { label: '10 分钟', value: 10 },
  { label: '15 分钟', value: 15 },
  { label: '不限时间', value: 0 },
]

function StatTile({ value, label, tone }: { value: number; label: string; tone: 'pine' | 'sky' | 'clay' }) {
  const style =
    tone === 'pine'
      ? 'bg-pine-soft text-pine'
      : tone === 'sky'
        ? 'bg-sky-soft text-sky'
        : 'bg-clay-soft text-clay'
  return (
    <div className={`rounded-2xl p-3.5 ${style}`}>
      <p className="text-[24px] font-semibold leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] leading-tight opacity-80">{label}</p>
    </div>
  )
}

export default function HomePage() {
  const { vocabulary, grammar, examples, lessons, lessonVocabulary, lessonGrammar } = useData()
  const navigate = useNavigate()
  const [minutes, setMinutes] = useState(5)
  const now = Date.now()

  const counts = useMemo(
    () => countPlan({ vocabulary, grammar, examples }, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vocabulary, grammar, examples],
  )

  const recommended = useMemo(
    () => buildTasks({ vocabulary, grammar, examples }, 'mixed', minutesToCount(minutes), now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vocabulary, grammar, examples, minutes],
  )

  const recentLessons = useMemo(
    () => [...lessons].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3),
    [lessons],
  )

  const isEmpty = vocabulary.length === 0 && grammar.length === 0

  const vocabCountOf = (lessonId: string) => lessonVocabulary.filter((l) => l.lessonId === lessonId).length
  const grammarCountOf = (lessonId: string) => lessonGrammar.filter((l) => l.lessonId === lessonId).length

  return (
    <div>
      <header className="mb-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-[0.22em] text-sub">RAVEN&apos;S NOTE</p>
          <p className="text-[11px] text-sub">{formatDateLabel(now)}</p>
        </div>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">
          RAVEN&apos;s<span className="text-pine">ノート</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-sub">今天也积累一点日语。</p>
      </header>

      {isEmpty ? (
        <Card className="mb-5 p-5">
          <p className="text-[15px] font-medium">笔记本还是空的</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
            先新建一篇课文，把里面的词汇和语法录进来吧。所有内容都保存在你的手机浏览器里。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button onClick={() => navigate('/add')}>录入内容</Button>
            <Button variant="outline" onClick={() => navigate('/library?tab=lesson')}>
              新建课文
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-3 gap-2.5">
        <StatTile value={counts.vocab} label="今日待复习词汇" tone="pine" />
        <StatTile value={counts.grammar} label="今日待复习语法" tone="sky" />
        <StatTile value={counts.zhJa + counts.freeWrite} label="今日输出练习" tone="clay" />
      </div>

      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-medium">开始复习</p>
          <p className="text-[11px] text-sub">到期任务 {counts.mixed} 个</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {TIME_OPTIONS.map((opt) => (
            <Chip key={opt.value} active={minutes === opt.value} onClick={() => setMinutes(opt.value)}>
              {opt.label}
            </Chip>
          ))}
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-sub">
          {recommended.length
            ? `按这个时长，推荐完成 ${recommended.length} 个任务（词汇 ${counts.vocab} · 语法 ${counts.grammar} · 输出 ${counts.zhJa + counts.freeWrite}）。`
            : '今天没有到期的内容。可以先录入新课文，或用单项练习巩固。'}
        </p>

        <Button
          className="mt-3 w-full"
          disabled={!recommended.length}
          onClick={() => navigate(`/review?plan=${minutes}`)}
        >
          {recommended.length ? '开始复习' : '暂无到期内容'}
        </Button>
      </Card>

      <div className="mt-6">
        <SectionTitle
          extra={
            lessons.length > 0 ? (
              <button
                type="button"
                onClick={() => navigate('/library?tab=lesson')}
                className="text-[12px] text-pine"
              >
                全部课文
              </button>
            ) : undefined
          }
        >
          最近学习的课文
        </SectionTitle>

        {recentLessons.length ? (
          <div className="space-y-2.5">
            {recentLessons.map((lesson) => (
              <Card
                key={lesson.id}
                className="p-4"
                onClick={() => navigate(`/library?tab=lesson&focus=${lesson.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{lesson.title}</p>
                    <p className="mt-1 text-[12px] text-sub">
                      {vocabCountOf(lesson.id)} 个词汇 · {grammarCountOf(lesson.id)} 个语法
                      {lesson.theme ? ` · ${lesson.theme}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-sub">{formatDate(lesson.updatedAt)}</span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="还没有课文"
            desc="每篇课文可以关联多个词汇和语法。"
            action={<Button onClick={() => navigate('/library?tab=lesson')}>新建第一篇课文</Button>}
          />
        )}
      </div>
    </div>
  )
}
