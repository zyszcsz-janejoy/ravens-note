export function uid(prefix = ''): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return prefix + raw
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatDateFull(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDateLabel(ts: number): string {
  const d = new Date(ts)
  return `${formatDate(ts)} · ${WEEKDAYS[d.getDay()]}`
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${formatDateFull(ts)} ${hh}:${mm}`
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 1) return '不到 1 分钟'
  return `${min} 分钟`
}
