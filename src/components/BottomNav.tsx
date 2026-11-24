import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

function Icon({ path, filled }: { path: ReactNode; filled?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  )
}

const ITEMS = [
  {
    to: '/',
    label: '首页',
    icon: <Icon path={<><path d="M4 10.5 12 4l8 6.5" /><path d="M6.5 9.5V20h11V9.5" /><path d="M10 20v-5h4v5" /></>} />,
  },
  {
    to: '/review',
    label: '复习',
    icon: <Icon path={<><path d="M20 11a8 8 0 1 0-2.6 5.9" /><path d="M20 5v6h-6" /></>} />,
  },
  {
    to: '/add',
    label: '录入',
    icon: <Icon path={<><circle cx="12" cy="12" r="8" /><path d="M12 8.5v7M8.5 12h7" /></>} />,
  },
  {
    to: '/library',
    label: '知识库',
    icon: <Icon path={<><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5z" /><path d="M5 18.5V5.5" /><path d="M9 7.5h6M9 11h6" /></>} />,
  },
  {
    to: '/me',
    label: '我的',
    icon: <Icon path={<><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /></>} />,
  },
]

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto grid w-full max-w-[560px] grid-cols-5 px-2 pb-safe pt-1">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] transition ${
                isActive ? 'text-pine' : 'text-sub/80'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'rounded-lg bg-pine-soft px-2 py-0.5' : 'px-2 py-0.5'}>{item.icon}</span>
                <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
