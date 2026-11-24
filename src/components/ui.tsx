import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  const base = `rounded-2xl border border-line bg-card shadow-soft ${className}`
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} w-full text-left active:scale-[0.995] transition`}>
        {children}
      </button>
    )
  }
  return <div className={base}>{children}</div>
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-sub">{subtitle}</p>}
      </div>
      {right}
    </header>
  )
}

export function SectionTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="text-[13px] font-medium tracking-wide text-sub">{children}</h2>
      {extra}
    </div>
  )
}

type Variant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-pine text-paper shadow-soft active:bg-pine-deep',
  soft: 'bg-pine-soft text-pine active:bg-[#dbe7e1]',
  ghost: 'text-sub active:bg-line/40',
  outline: 'border border-line bg-card text-ink active:bg-line/30',
  danger: 'bg-clay-soft text-clay active:bg-[#f2ddd3]',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-[15px] font-medium transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1 text-[13px] text-sub">
        {label}
        {required && <span className="text-clay">*</span>}
        {hint && <span className="ml-auto text-[11px] text-sub/70">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

const INPUT_CLASS =
  'w-full rounded-xl2 border border-line bg-card px-3.5 py-3 text-[15px] text-ink placeholder:text-sub/50 focus:border-pine/50 focus:outline-none focus:ring-2 focus:ring-pine/10'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLASS} ${props.className ?? ''}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT_CLASS} min-h-[92px] leading-relaxed ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${INPUT_CLASS} appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10 ${props.className ?? ''}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238B8377' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    />
  )
}

export function Chip({
  active,
  onClick,
  children,
  className = '',
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[36px] rounded-full border px-3.5 text-[13px] transition ${
        active ? 'border-pine bg-pine text-paper' : 'border-line bg-card text-sub active:bg-line/30'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function MasteryBadge({
  bucket,
  label,
  className = '',
}: {
  bucket: string
  label: string
  className?: string
}) {
  const map: Record<string, string> = {
    new: 'bg-line/60 text-sub',
    weak: 'bg-clay-soft text-clay',
    fuzzy: 'bg-[#F4EDDC] text-[#93733A]',
    ok: 'bg-sky-soft text-sky',
    strong: 'bg-pine-soft text-pine',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] ${map[bucket] ?? map.new} ${className}`}>{label}</span>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; count?: number }[]
}) {
  return (
    <div className="flex rounded-2xl border border-line bg-card p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-[12px] py-2 text-[13px] transition ${
            value === opt.value ? 'bg-pine text-paper' : 'text-sub'
          }`}
        >
          {opt.label}
          {typeof opt.count === 'number' && (
            <span className={`ml-1 text-[11px] ${value === opt.value ? 'text-paper/70' : 'text-sub/70'}`}>
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/70">
      <div
        className="h-full rounded-full bg-pine transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  )
}

export function EmptyState({
  title,
  desc,
  action,
}: {
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card/60 px-5 py-10 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {desc && <p className="mt-1.5 text-[13px] leading-relaxed text-sub">{desc}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30 animate-fade"
      />
      <div className="animate-rise relative flex max-h-[92vh] w-full max-w-[560px] flex-col rounded-t-[24px] bg-paper shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="-mr-2 rounded-full p-2 text-sub active:bg-line/50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3 pb-safe">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmSheet({
  open,
  title,
  desc,
  confirmText = '确认删除',
  onConfirm,
  onClose,
  danger = true,
}: {
  open: boolean
  title: string
  desc?: string
  confirmText?: string
  onConfirm: () => void
  onClose: () => void
  danger?: boolean
}) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      {desc && <p className="text-[14px] leading-relaxed text-sub">{desc}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Button variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Sheet>
  )
}

export function BackButton({ onClick, label = '返回' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 inline-flex items-center gap-1 py-1 text-[13px] text-sub active:opacity-70"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  )
}
