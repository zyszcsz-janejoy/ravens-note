import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TaskCard, type TaskSubmit } from '../components/review/TaskCard'
import { Button, Card, EmptyState, PageHeader, ProgressBar, SectionTitle } from '../components/ui'
import * as repo from '../db/repo'
import { buildPools, buildTasks, countPlan, minutesToCount } from '../lib/plan'
import { MODE_LABEL } from '../lib/srs'
import { formatDuration, uid } from '../lib/utils'
import { useData } from '../store/AppData'
import type { ReviewMode, StudySession } from '../types'

const SINGLE_LIMIT = 30

const MODE_CARDS: { mode: ReviewMode; title: string; desc: string }[] = [
  { mode: 'vocab', title: '词汇复习', desc: '看单词，回忆假名和意思' },
  { mode: 'choice', title: '语法选择题', desc: '选出正确的意思或接续' },
  { mode: 'zhJa', title: '中文翻日语', desc: '看中文，写出对应的日语' },
  { mode: 'freeWrite', title: '自由造句', desc: '用指定语法写一句自己的话' },
]

export default function ReviewPage() {
  const { vocabulary, grammar, examples, sessions, loading, refresh, notify } = useData()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<StudySession | null>(null)
  const [busy, setBusy] = useState(false)
  const autoRef = useRef(false)

  const activeSession = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'active' && s.index < s.tasks.length)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0],
    [sessions],
  )

  const startSession = async (mode: ReviewMode | 'mixed', limit: number, minutes?: number) => {
    const tasks = buildTasks({ vocabulary, grammar, examples }, mode, limit)
    if (!tasks.length) {
      notify('暂时没有可复习的内容', 'error')
      return
    }
    const now = Date.now()
    const actives = sessions.filter((s) => s.status === 'active')
    if (actives.length) {
      await Promise.all(
        actives.map((s) => repo.saveSession({ ...s, status: 'abandoned', endedAt: now, updatedAt: now })),
      )
    }
    const next: StudySession = {
      id: uid('s_'),
      mode,
      startedAt: now,
      updatedAt: now,
      status: 'active',
      plannedMinutes: minutes,
      tasks,
      index: 0,
      results: [],
    }
    await repo.saveSession(next)
    setSession(next)
    await refresh()
  }

  useEffect(() => {
    if (loading || autoRef.current) return
    const plan = params.get('plan')
    if (plan === null) return
    autoRef.current = true
    const minutes = Number(plan)
    const safe = Number.isFinite(minutes) ? minutes : 5
    void startSession('mixed', minutesToCount(safe), safe)
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, params])

  const handleSubmit = async (result: TaskSubmit) => {
    if (!session || busy) return
    const task = session.tasks[session.index]
    if (!task) return
    setBusy(true)
    try {
      if (task.mode === 'choice' && task.question) {
        await repo.gradeGrammarFacet(task.itemId, task.question.kind, result.grade)
      } else if (task.itemType === 'grammar') {
        await repo.gradeGrammarFacet(task.itemId, task.facet ?? 'meaning', result.grade)
      } else {
        await repo.gradeVocabulary(task.itemId, result.grade)
      }

      await repo.addReviewRecord({
        itemType: task.itemType,
        itemId: task.itemId,
        mode: task.mode,
        facet: task.facet,
        grade: result.grade,
        correct: result.correct,
        durationMs: result.durationMs,
      })

      if (result.errorType) {
        const prompt =
          task.question?.prompt ??
          task.prompt ??
          (task.itemType === 'vocab'
            ? vocabulary.find((v) => v.id === task.itemId)?.word ?? ''
            : grammar.find((g) => g.id === task.itemId)?.name ?? '')
        await repo.addMistake({
          itemType: task.itemType,
          itemId: task.itemId,
          mode: task.mode,
          errorType: result.errorType,
          prompt,
          userAnswer: result.userAnswer,
        })
      }

      const nextIndex = session.index + 1
      const done = nextIndex >= session.tasks.length
      const next: StudySession = {
        ...session,
        index: nextIndex,
        updatedAt: Date.now(),
        status: done ? 'done' : 'active',
        endedAt: done ? Date.now() : undefined,
        results: [...session.results, { key: task.key, grade: result.grade, correct: result.correct }],
      }
      await repo.saveSession(next)
      setSession(next)
      await refresh()
    } catch (err) {
      console.error(err)
      notify('记录失败，请重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleSkip = async () => {
    if (!session) return
    const nextIndex = session.index + 1
    const done = nextIndex >= session.tasks.length
    const next: StudySession = {
      ...session,
      index: nextIndex,
      updatedAt: Date.now(),
      status: done ? 'done' : 'active',
      endedAt: done ? Date.now() : undefined,
    }
    await repo.saveSession(next)
    setSession(next)
    await refresh()
  }

  const exitSession = () => {
    setSession(null)
    notify('进度已保存，可以下次继续')
    navigate('/review', { replace: true })
  }

  const discardSession = async (target: StudySession) => {
    await repo.saveSession({ ...target, status: 'abandoned', endedAt: Date.now(), updatedAt: Date.now() })
    await refresh()
    notify('已放弃这次练习')
  }

  /* ---------- 练习中 ---------- */
  if (session) {
    if (session.status === 'done' || session.index >= session.tasks.length) {
      const remembered = session.results.filter((r) => r.grade === 'ok' || r.grade === 'mastered').length
      const again = session.results.length - remembered
      const duration = (session.endedAt ?? Date.now()) - session.startedAt
      return (
        <div>
          <PageHeader title="练习完成" subtitle={`${session.mode === 'mixed' ? '混合复习' : MODE_LABEL[session.mode]} · ${formatDuration(duration)}`} />
          <Card className="p-5 text-center">
            <p className="text-[13px] text-sub">完成</p>
            <p className="mt-1 text-[40px] font-semibold leading-none text-pine">{session.results.length}</p>
            <p className="mt-1.5 text-[12px] text-sub">个任务</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl2 bg-pine-soft p-3">
                <p className="text-[22px] font-semibold text-pine">{remembered}</p>
                <p className="mt-0.5 text-[11px] text-pine/70">记住</p>
              </div>
              <div className="rounded-xl2 bg-clay-soft p-3">
                <p className="text-[22px] font-semibold text-clay">{again}</p>
                <p className="mt-0.5 text-[11px] text-clay/70">需要再看</p>
              </div>
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-sub">
              复习时间已经按你的自评安排好，明天再打开会看到新的到期内容。
            </p>
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button variant="outline" onClick={() => setSession(null)}>
              回到复习首页
            </Button>
            <Button
              onClick={() =>
                startSession(
                  'mixed',
                  minutesToCount(session.plannedMinutes ?? 5),
                  session.plannedMinutes ?? 5,
                )
              }
            >
              再来一组
            </Button>
          </div>
        </div>
      )
    }

    const task = session.tasks[session.index]
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={exitSession} className="py-1 text-[13px] text-sub active:opacity-70">
            保存并退出
          </button>
          <span className="text-[12px] text-sub">
            {session.mode === 'mixed' ? '混合复习' : MODE_LABEL[session.mode]} · {session.index + 1} / {session.tasks.length}
          </span>
        </div>
        <div className="mb-4">
          <ProgressBar value={session.index / session.tasks.length} />
        </div>
        <TaskCard key={task.key} task={task} onSubmit={handleSubmit} onSkip={handleSkip} />
      </div>
    )
  }

  /* ---------- 选择练习 ---------- */
  const data = { vocabulary, grammar, examples }
  const pools = buildPools(data)
  const counts = countPlan(data)
  const modeCounts: Record<ReviewMode, number> = {
    vocab: buildTasks(data, 'vocab', SINGLE_LIMIT).length,
    choice: buildTasks(data, 'choice', SINGLE_LIMIT).length,
    zhJa: buildTasks(data, 'zhJa', SINGLE_LIMIT).length,
    freeWrite: buildTasks(data, 'freeWrite', SINGLE_LIMIT).length,
  }

  const hasAnything = vocabulary.length > 0 || grammar.length > 0

  return (
    <div>
      <PageHeader title="复习" subtitle="按记忆节奏，挑一点现在该复习的内容。" />

      {activeSession && (
        <Card className="mb-4 border-pine/30 bg-pine-soft/50 p-4">
          <p className="text-[13px] font-medium text-pine">上次练习还没做完</p>
          <p className="mt-1 text-[12px] text-sub">
            已完成 {activeSession.index} / {activeSession.tasks.length} 个任务
          </p>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={() => setSession(activeSession)}>
              继续上次
            </Button>
            <Button variant="outline" onClick={() => void discardSession(activeSession)}>
              放弃
            </Button>
          </div>
        </Card>
      )}

      {!hasAnything ? (
        <EmptyState
          title="还没有可以复习的内容"
          desc="先到「录入」添加词汇和语法，系统会自动安排复习时间。"
          action={<Button onClick={() => navigate('/add')}>去录入</Button>}
        />
      ) : (
        <>
          <Card
            className="mb-4 p-4"
            onClick={() => void startSession('mixed', minutesToCount(5), 5)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-medium">混合复习</p>
                <p className="mt-1 text-[12px] text-sub">词汇、选择、翻译、造句按节奏穿插</p>
              </div>
              <span className="rounded-full bg-pine px-3 py-1 text-[11px] text-paper">
                {counts.mixed} 个到期
              </span>
            </div>
          </Card>

          <SectionTitle>单项练习</SectionTitle>
          <div className="space-y-2.5">
            {MODE_CARDS.map((item) => {
              const count = modeCounts[item.mode]
              return (
                <Card key={item.mode} className="p-4" onClick={() => void startSession(item.mode, SINGLE_LIMIT)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium">{item.title}</p>
                      <p className="mt-1 text-[12px] text-sub">{item.desc}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-sub">{count ? `${count} 个` : '暂无'}</span>
                  </div>
                </Card>
              )
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-card/60 p-4">
            <p className="text-[12px] font-medium">复习节奏</p>
            <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-sub">
              <li>完全忘记：当天稍后再看一次</li>
              <li>模糊：明天复习</li>
              <li>基本掌握：3 天后</li>
              <li>熟练：7 天起，连续熟练会延长到 14～30 天</li>
            </ul>
            <p className="mt-2.5 text-[11px] leading-relaxed text-sub/80">
              语法的意思、接续、中译日、造句分别记录；选择题答对只算「基本掌握」。
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-sub/80">
              当前到期：词汇 {pools.vocab.length} · 选择 {pools.choice.length} · 中译日 {pools.zhJa.length} · 造句 {pools.freeWrite.length}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
