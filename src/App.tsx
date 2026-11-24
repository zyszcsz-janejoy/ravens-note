import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import LockScreen from './components/LockScreen'
import { isUnlocked } from './lib/auth'
import HomePage from './pages/HomePage'
import ReviewPage from './pages/ReviewPage'
import AddPage from './pages/AddPage'
import LibraryPage from './pages/LibraryPage'
import MePage from './pages/MePage'
import MistakesPage from './pages/MistakesPage'
import { useData } from './store/AppData'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

export default function App() {
  const { loading } = useData()
  const [unlocked, setUnlocked] = useState(() => isUnlocked())

  if (!unlocked) {
    return <LockScreen onUnlocked={() => setUnlocked(true)} />
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-pine" />
          <p className="text-sm text-sub">正在打开笔记本…</p>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <ScrollToTop />
      <div className="mx-auto w-full max-w-[560px] px-4 pb-32 pt-5">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="/mistakes" element={<MistakesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </HashRouter>
  )
}
