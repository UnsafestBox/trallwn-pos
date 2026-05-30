import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import POS from './pages/POS.jsx'
import Tabs from './pages/Tabs.jsx'
import Stock from './pages/Stock.jsx'
import Reports from './pages/Reports.jsx'
import Log from './pages/Log.jsx'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="nav">
          <span className="nav-brand">Trallwn Club</span>
          <NavLink to="/" end>POS</NavLink>
          <NavLink to="/tabs">Tabs</NavLink>
          <NavLink to="/stock">Stock</NavLink>
          <NavLink to="/reports">Reports</NavLink>
          <NavLink to="/log">Log</NavLink>
        </nav>
        <main className="main">
          <Routes>
            <Route path="/" element={<POS />} />
            <Route path="/tabs" element={<Tabs />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/log" element={<Log />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
