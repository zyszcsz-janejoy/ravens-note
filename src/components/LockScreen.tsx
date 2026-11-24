import { useState, type FormEvent } from 'react'
import { Button, TextInput } from './ui'
import { unlockWithPassword } from '../lib/auth'

export default function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setError('请输入密码')
      return
    }
    if (unlockWithPassword(password, remember)) {
      onUnlocked()
      return
    }
    setError('密码不正确，请再试一次')
    setPassword('')
  }

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-paper px-6 pb-16 pt-10">
      <div className="mx-auto w-full max-w-[400px]">
        <p className="text-[10px] tracking-[0.22em] text-sub">RAVEN&apos;S NOTE</p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
          RAVEN&apos;s<span className="text-pine">ノート</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-sub">我的个人日语知识库</p>

        <form onSubmit={submit} className="mt-7 rounded-xl2 border border-line bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-pine"
            >
              <rect x="4" y="10" width="16" height="10" rx="2.5" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <p className="text-[15px] font-medium">解锁笔记本</p>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-sub">
            请输入访问密码。密码只在当前设备校验，不会上传到任何服务器。
          </p>

          <div className="relative mt-4">
            <TextInput
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder="输入密码"
              autoComplete="current-password"
              autoFocus
              className="pr-16"
              aria-label="访问密码"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-1 top-1/2 min-h-[40px] -translate-y-1/2 rounded-xl px-3 text-[12px] text-sub active:opacity-60"
            >
              {show ? '隐藏' : '显示'}
            </button>
          </div>

          {error ? <p className="mt-2 text-[12px] text-clay">{error}</p> : null}

          <label className="mt-3.5 flex min-h-[44px] items-center gap-2.5 text-[12px] text-sub">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-5 w-5 accent-pine"
            />
            7 天内在这台设备上免输入
          </label>

          <Button type="submit" className="mt-2 w-full">
            进入
          </Button>
        </form>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-sub/80">
          学习数据只保存在本机浏览器里。
          <br />
          忘记密码时需要修改网站源码来重置。
        </p>
      </div>
    </div>
  )
}
