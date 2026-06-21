import React, { useCallback, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ConfigProvider, useConfig } from './context/ConfigContext.jsx'
import { useInactivityTimeout } from './hooks/useInactivityTimeout.js'
import Login from './pages/Login.jsx'
import POS from './pages/POS.jsx'
import Tabs from './pages/Tabs.jsx'
import Stock from './pages/Stock.jsx'
import Reports from './pages/Reports.jsx'
import Log from './pages/Log.jsx'
import Users from './pages/Users.jsx'
import Bills from './pages/Bills.jsx'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './index.css'

function ThemeApplier() {
  const { theme } = useConfig()
  useEffect(() => {
    document.documentElement.dataset.theme = theme || 'dark'
  }, [theme])
  return null
}

function SuperOnly({ children }) {
  const { user } = useAuth()
  if (user?.role !== 'super') return <div className="page empty-state">Access restricted to super users.</div>
  return children
}

function App() {
  const { user, logout } = useAuth()
  const config = useConfig()
  const { features } = config

  const timeoutMs = (config.auth.inactivityTimeoutMinutes || 0) * 60 * 1000
  const warningMs = (config.auth.inactivityWarningSecs || 30) * 1000

  const stableLogout = useCallback(logout, [logout])
  const { secondsLeft, dismiss } = useInactivityTimeout(
    stableLogout,
    !!user && timeoutMs > 0,
    timeoutMs,
    warningMs
  )

  if (user === undefined) return null // still loading session
  if (!user) return <Login />

  return (
    <BrowserRouter>
      <div className="app">
        <nav className="nav">
          <span className="nav-brand">Trallwn Club</span>
          <NavLink to="/" end>POS</NavLink>
          <NavLink to="/tabs">Tabs</NavLink>
          {features.bills && <NavLink to="/bills">Bills</NavLink>}
          {user.role === 'super' && features.reports && <NavLink to="/reports">Reports</NavLink>}
          {user.role === 'super' && features.stockManagement && <NavLink to="/stock">Stock</NavLink>}
          {user.role === 'super' && features.eventLog && <NavLink to="/log">Log</NavLink>}
          {user.role === 'super' && <NavLink to="/users">Users</NavLink>}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginRight: 4 }}>{user.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Sign out</button>
        </nav>

        <main className="main">
          <Routes>
            <Route path="/" element={<POS />} />
            <Route path="/tabs" element={<Tabs />} />
            {features.bills && <Route path="/bills" element={<Bills />} />}
            {features.reports && <Route path="/reports" element={<SuperOnly><Reports /></SuperOnly>} />}
            {features.stockManagement && <Route path="/stock" element={<SuperOnly><Stock /></SuperOnly>} />}
            {features.eventLog && <Route path="/log" element={<SuperOnly><Log /></SuperOnly>} />}
            <Route path="/users" element={<SuperOnly><Users /></SuperOnly>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {secondsLeft !== null && (
          <div className="timeout-overlay">
            <div className="timeout-box">
              <div className="timeout-title">Still there, {user.name}?</div>
              <div className="timeout-count">{secondsLeft}</div>
              <div className="timeout-sub">seconds until automatic sign-out</div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={dismiss}>
                Stay signed in
              </button>
            </div>
          </div>
        )}
      </div>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ConfigProvider>
    <ThemeApplier />
    <AuthProvider>
      <App />
    </AuthProvider>
  </ConfigProvider>
)
