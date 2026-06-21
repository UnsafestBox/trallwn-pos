import React, { useState, useEffect } from 'react'
import { api } from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useConfig } from '../context/ConfigContext.jsx'

export default function Login() {
  const { login } = useAuth()
  const config = useConfig()
  const requirePin = config.auth.requirePin !== false

  const [users, setUsers] = useState([])
  const [loadError, setLoadError] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.getLoginUsers()
      .then(setUsers)
      .catch(() => setLoadError('Could not reach server. Is it running on port 3001?'))
  }, [])

  async function doLogin(name, pinValue, pinMode = false) {
    setLoading(true)
    setError('')
    try {
      await login(name, pinValue)
    } catch {
      if (pinMode) {
        setError('Incorrect PIN')
        setPin('')
      } else {
        setError('Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  function selectUser(u) {
    if (!requirePin && u.role !== 'super') {
      doLogin(u.name, '')
    } else {
      setSelectedUser(u)
      setPin('')
      setError('')
    }
  }

  function pressDigit(d) {
    if (pin.length >= 6) return
    setPin(p => p + d)
    setError('')
  }

  function backspace() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  async function submit() {
    if (!selectedUser || pin.length === 0) return
    await doLogin(selectedUser.name, pin, true)
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-brand">Trallwn Club POS</div>

        {!selectedUser ? (
          <>
            <div className="login-prompt">Who are you?</div>
            {loadError && <div className="login-error">{loadError}</div>}
            {error && <div className="login-error">{error}</div>}
            <div className="user-list">
              {users.map(u => (
                <button key={u.id} className="user-btn" onClick={() => selectUser(u)} disabled={loading}>
                  {u.name}
                </button>
              ))}
              {!loadError && users.length === 0 && (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', padding: '12px 0' }}>Loading…</div>
              )}
            </div>
          </>
        ) : (
          <>
            <button className="login-back" onClick={() => setSelectedUser(null)}>← Back</button>
            <div className="login-name">{selectedUser.name}</div>
            <div className="pin-dots">
              {[...Array(Math.max(pin.length, 4))].map((_, i) => (
                <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
              ))}
            </div>
            {error && <div className="login-error">{error}</div>}
            <div className="pin-pad">
              {[1,2,3,4,5,6,7,8,9].map(d => (
                <button key={d} className="pin-key" onClick={() => pressDigit(String(d))} disabled={loading}>
                  {d}
                </button>
              ))}
              <button className="pin-key pin-key-action" onClick={backspace} disabled={loading || pin.length === 0}>
                ⌫
              </button>
              <button className="pin-key" onClick={() => pressDigit('0')} disabled={loading}>
                0
              </button>
              <button
                className="pin-key pin-key-confirm"
                onClick={submit}
                disabled={loading || pin.length === 0}
              >
                {loading ? '…' : '↵'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
