import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackButton, Card, Chip, EmptyState, PageHeader } from '../components/ui'
import * as repo from '../db/repo'
import { ERROR_LABEL, MODE_LABEL } from '../lib/srs'
import { formatDateTime } from '../lib/utils'
import { useData } from '../store/AppData'

export default function MistakesPage() {
  const { mistakes, vocabulary, grammar, refresh, notify } = useData()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  const list = useMemo(
    () =>
      [...mistakes]
        .filter((m) => (filter === 'open' ? !m.resolved : true))
        .sort((a, b) => b.createdAt - a.createdAt),
    [mistakes, filter],
  )

  const openCount = mistakes.filter((m) => !m.resolved).length

  const nameOf = (itemType: 'vocab' | 'grammar', itemId: string) =>
    itemType === 'vocab'
      ? vocabulary.find((v) => v.id === itemId)?.word ?? '（已删除的内容）'
      : grammar.find((g) => g.id === itemId)?.name ?? '（已删除的内容）'

  const toggle = async (id: string, resolved: boolean) => {
    await repo.setMistakeResolved(id, resolved)
    await refresh()
    notify(resolved ? '已标记为解决' : '已重新标记为待复习')
  }

  const remove = async (id: string) => {
    await repo.deleteMistake(id)
    await refresh()
    notify('错题已删除')
  }

  return (
    <div>
      <BackButton onClick={() => navigate('/me')} label="我的" />
      <PageHeader title="错题本" subtitle={`${openCount} 条待复习 · 共 ${mistakes.length} 条记录`} />

      <div className="flex gap-2">
        <Chip active={filter === 'open'} onClick={() => setFilter('open')}>
          待复习
        </Chip>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          全部
        </Chip>
      </div>

      <div className="mt-4 space-y-2.5">
        {list.length ? (
          list.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p lang="ja" className="truncate text-[15px] font-medium">
                    {nameOf(m.itemType, m.itemId)}
                  </p>
                  <p className="mt-1 text-[11px] text-sub">
                    {MODE_LABEL[m.mode]} · {formatDateTime(m.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-clay-soft px-2 py-0.5 text-[10px] text-clay">
                  {ERROR_LABEL[m.errorType]}
                </span>
              </div>

              {m.prompt && <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-sub">{m.prompt}</p>}
              {m.userAnswer && (
                <p lang="ja" className="mt-1.5 line-clamp-2 rounded-lg bg-paper px-2.5 py-1.5 text-[12px] text-sub">
                  我的答案：{m.userAnswer}
                </p>
              )}

              <div className="mt-2.5 flex items-center gap-3 text-[11px]">
                <button
                  type="button"
                  onClick={() => void toggle(m.id, !m.resolved)}
                  className={m.resolved ? 'text-sub' : 'text-pine'}
                >
                  {m.resolved ? '标记为待复习' : '标记为已解决'}
                </button>
                <button type="button" onClick={() => void remove(m.id)} className="text-clay">
                  删除
                </button>
                {m.resolved && <span className="ml-auto text-sub">已解决</span>}
              </div>
            </Card>
          ))
        ) : (
          <EmptyState
            title={filter === 'open' ? '没有待复习的错题' : '还没有错题记录'}
            desc="做错的语法选择题和中译日、造句练习会自动记录在这里。"
          />
        )}
      </div>
    </div>
  )
}
