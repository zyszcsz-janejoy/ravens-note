import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, PageHeader, SectionTitle, Sheet, TextInput } from '../components/ui'
import * as repo from '../db/repo'
import { MODE_LABEL } from '../lib/srs'
import { lockDevice } from '../lib/auth'
import { formatDateFull, formatDateTime } from '../lib/utils'
import { useData } from '../store/AppData'

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

export default function MePage() {
  const { vocabulary, grammar, lessons, records, mistakes, sessions, refresh, notify } = useData()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ text: string; counts: Record<string, number> } | null>(null)
  const [importing, setImporting] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearText, setClearText] = useState('')
  const [busy, setBusy] = useState(false)

  const openMistakes = mistakes.filter((m) => !m.resolved).length

  const studyDays = useMemo(
    () => new Set(records.map((r) => formatDateFull(r.createdAt))).size,
    [records],
  )

  const history = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'done')
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 8),
    [sessions],
  )

  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true)

  const handleExport = async () => {
    setBusy(true)
    try {
      const backup = await repo.buildBackup()
      const text = JSON.stringify(backup, null, 2)
      downloadText(`ravens-note-${formatDateFull(Date.now())}.json`, text)
      notify('已导出备份文件')
    } catch {
      notify('导出失败，请重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    setBusy(true)
    try {
      const backup = await repo.buildBackup()
      const ok = await copyText(JSON.stringify(backup, null, 2))
      notify(ok ? '备份数据已复制' : '复制失败，请改用导出文件', ok ? 'ok' : 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 30 * 1024 * 1024) {
      notify('文件过大，无法导入', 'error')
      return
    }
    const text = await file.text()
    const parsed = repo.parseBackup(text)
    if (!parsed.ok) {
      notify(parsed.error, 'error')
      return
    }
    setPending({ text, counts: parsed.file.counts })
  }

  const confirmImport = async () => {
    if (!pending) return
    setImporting(true)
    try {
      const report = await repo.importBackup(pending.text)
      await refresh()
      setPending(null)
      notify(
        `导入完成：词汇 +${report.added.vocabulary}、语法 +${report.added.grammar}、课文 +${report.added.lessons}`,
      )
    } catch (err) {
      notify(err instanceof Error ? err.message : '导入失败', 'error')
    } finally {
      setImporting(false)
    }
  }

  const confirmClear = async () => {
    if (clearText.trim() !== '删除') return
    setBusy(true)
    try {
      await repo.clearEverything()
      await refresh()
      setClearOpen(false)
      setClearText('')
      notify('数据已清空')
    } catch {
      notify('清空失败，请重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="我的" subtitle="数据保存在本机浏览器中，不需要账号。" />

      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: '累计词汇', value: vocabulary.length, tone: 'bg-pine-soft text-pine' },
          { label: '累计语法', value: grammar.length, tone: 'bg-sky-soft text-sky' },
          { label: '未解决错题', value: openMistakes, tone: 'bg-clay-soft text-clay' },
          { label: '复习次数', value: records.length, tone: 'bg-card text-ink' },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl border border-line p-4 ${item.tone}`}>
            <p className="text-[26px] font-semibold leading-none">{item.value}</p>
            <p className="mt-1.5 text-[11px] opacity-80">{item.label}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-sub">
        {lessons.length} 篇课文 · 学习 {studyDays} 天
      </p>

      <div className="mt-5">
        <SectionTitle>学习记录</SectionTitle>
        {history.length ? (
          <Card className="divide-y divide-line p-0">
            {history.map((s) => {
              const remembered = s.results.filter((r) => r.grade === 'ok' || r.grade === 'mastered').length
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px]">
                      {s.mode === 'mixed' ? '混合复习' : MODE_LABEL[s.mode]}
                      <span className="ml-1.5 text-[11px] text-sub">{s.results.length} 个任务</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-sub">{formatDateTime(s.startedAt)}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-pine">记住 {remembered}</span>
                </div>
              )
            })}
          </Card>
        ) : (
          <Card className="p-4">
            <p className="text-[12px] leading-relaxed text-sub">
              完成一次复习后，这里会留下学习记录。
            </p>
          </Card>
        )}
      </div>

      <div className="mt-5">
        <SectionTitle>错题本</SectionTitle>
        <Card className="p-4" onClick={() => navigate('/mistakes')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] font-medium">查看错题和薄弱语法</p>
              <p className="mt-1 text-[12px] text-sub">
                {openMistakes ? `${openMistakes} 条待复习` : '暂时没有未解决的错题'}
              </p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-sub">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <SectionTitle>数据管理</SectionTitle>
        <Card className="space-y-3 p-4">
          <p className="text-[12px] leading-relaxed text-sub">
            导出的 JSON 文件包含全部词汇、语法、课文、复习记录和错题，可以用来备份或换设备。
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="soft" onClick={() => void handleExport()} disabled={busy}>
              导出 JSON
            </Button>
            <Button variant="outline" onClick={() => void handleCopy()} disabled={busy}>
              复制数据
            </Button>
          </div>

          <div className="h-px bg-line" />

          <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
            导入 JSON 备份
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void handleFile(e)} />
          <p className="text-[11px] leading-relaxed text-sub">
            导入采用合并方式：相同的词汇（单词 + 假名）、语法（名称 + 接续）和课文标题会自动跳过，不会重复。
          </p>
        </Card>
      </div>

      <div className="mt-5">
        <SectionTitle>其他</SectionTitle>
        <Card className="divide-y divide-line p-0">
          <div className="px-4 py-3.5">
            <p className="text-[13px]">添加到手机主屏幕</p>
            <p className="mt-1 text-[11px] leading-relaxed text-sub">
              {standalone
                ? '已经在独立窗口模式运行。'
                : 'iPhone 用 Safari：分享 → 添加到主屏幕。Android 用 Chrome：菜单 → 添加到主屏幕。'}
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[13px]">离线使用</p>
            <p className="mt-1 text-[11px] leading-relaxed text-sub">
              打开过一次后，页面会被缓存，断网也能复习。
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[13px]">锁定本设备</p>
            <p className="mt-1 text-[11px] leading-relaxed text-sub">
              清除本机的免密状态，下次打开需要重新输入密码。
            </p>
            <button
              type="button"
              onClick={() => {
                lockDevice()
                window.location.reload()
              }}
              className="mt-2 text-[12px] text-pine underline underline-offset-2"
            >
              立即锁定
            </button>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[13px] text-clay">清空全部数据</p>
            <p className="mt-1 text-[11px] leading-relaxed text-sub">
              会删除所有词汇、语法、课文和记录，且无法恢复。
            </p>
            <button
              type="button"
              onClick={() => setClearOpen(true)}
              className="mt-2 text-[12px] text-clay underline underline-offset-2"
            >
              清空数据
            </button>
          </div>
        </Card>
      </div>

      <p className="mt-6 text-center text-[11px] text-sub/70">RAVEN&apos;sノート · v0.1.0 · 第一阶段</p>

      <Sheet open={pending !== null} title="确认导入" onClose={() => setPending(null)}>
        {pending && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-sub">
              文件包含：词汇 {pending.counts.vocabulary ?? 0}、语法 {pending.counts.grammar ?? 0}、课文{' '}
              {pending.counts.lessons ?? 0}、例句 {pending.counts.examples ?? 0}、复习记录{' '}
              {pending.counts.review_records ?? 0}、错题 {pending.counts.mistakes ?? 0}。
            </p>
            <p className="text-[12px] leading-relaxed text-sub">
              导入会与现有数据合并，已存在的相同内容会自动跳过。建议先导出当前数据作为备份。
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="outline" onClick={() => setPending(null)}>
                取消
              </Button>
              <Button onClick={() => void confirmImport()} disabled={importing}>
                {importing ? '导入中…' : '确认导入'}
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={clearOpen} title="清空全部数据" onClose={() => setClearOpen(false)}>
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-clay">
            这一步无法撤销。所有词汇、语法、课文、复习记录和错题都会被删除。
          </p>
          <p className="text-[12px] text-sub">
            请在下方输入「删除」两个字确认：
          </p>
          <TextInput value={clearText} onChange={(e) => setClearText(e.target.value)} placeholder="删除" />
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" onClick={() => setClearOpen(false)}>
              取消
            </Button>
            <Button variant="danger" disabled={clearText.trim() !== '删除' || busy} onClick={() => void confirmClear()}>
              {busy ? '处理中…' : '永久清空'}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
