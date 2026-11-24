import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as repo from '../db/repo'
import type { Snapshot } from '../types'

const EMPTY: Snapshot = {
  lessons: [],
  vocabulary: [],
  grammar: [],
  examples: [],
  lessonVocabulary: [],
  lessonGrammar: [],
  lessonImages: [],
  records: [],
  mistakes: [],
  sessions: [],
}

interface ToastState {
  id: number
  msg: string
  kind: 'ok' | 'error'
}

interface DataValue extends Snapshot {
  loading: boolean
  refresh: () => Promise<void>
  notify: (msg: string, kind?: 'ok' | 'error') => void
}

const Ctx = createContext<DataValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await repo.loadSnapshot()
      setSnap(next)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const notify = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ id: Date.now(), msg, kind })
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const value = useMemo<DataValue>(
    () => ({ ...snap, loading, refresh, notify }),
    [snap, loading, refresh, notify],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-6">
          <div
            className={`animate-toast rounded-full px-4 py-2.5 text-sm shadow-soft ${
              toast.kind === 'error' ? 'bg-clay text-white' : 'bg-ink text-paper'
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useData(): DataValue {
  const value = useContext(Ctx)
  if (!value) throw new Error('useData 必须在 DataProvider 内使用')
  return value
}
