import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import POS from './pages/POS.jsx'
import Tabs from './pages/Tabs.jsx'
import Stock from './pages/Stock.jsx'
import Reports from './pages/Reports.jsx'
import Log from './pages/Log.jsx'
import Users from './pages/Users.jsx'
import './index.css'

function SuperOnly({ children }) {
  const { user } = useAuth()
  if (user?.role !== 'super') return <div className="page empty-state">Access restricted to super users.</div>
  return children
}

function App() {
  const { user, logout } = useAuth()

  if (user === undefined) return null // still loading session

  if (!user) return <Login />

  return (
    <BrowserRouter>
      <div className="app">
        <nav className="nav">
          <span className="nav-brand">Trallwn Club</span>
          <NavLink to="/" end>POS</NavLink>
          <NavLink to="/tabs">Tabs</NavLink>
          {user.role === 'super' && <NavLink to="/stock">Stock</NavLink>}
          {user.role === 'super' && <NavLink to="/reports">Reports</NavLink>}
          {user.role === 'super' && <NavLink to="/log">Log</NavLink>}
          {user.role === 'super' && <NavLink to="/users">Users</NavLink>}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginRight: 4 }}>{user.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Sign out</button>
        </nav>
        <main className="main">
          <Routes>
            <Route path="/" element={<POS />} />
            <Route path="/tabs" element={<Tabs />} />
            <Route path="/stock" element={<SuperOnly><Stock /></SuperOnly>} />
            <Route path="/reports" element={<SuperOnly><Reports /></SuperOnly>} />
            <Route path="/log" element={<SuperOnly><Log /></SuperOnly>} />
            <Route path="/users" element={<SuperOnly><Users /></SuperOnly>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)
