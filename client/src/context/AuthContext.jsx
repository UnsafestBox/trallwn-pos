import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/index.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = still loading

  useEffect(() => {
    const token = localStorage.getItem('pos_token')
    if (!token) { setUser(null); return }
    api.me()
      .then(setUser)
      .catch(() => { localStorage.removeItem('pos_token'); setUser(null) })
  }, [])

  useEffect(() => {
    function onUnauthorized() { setUser(null) }
    window.addEventListener('pos:unauthorized', onUnauthorized)
    return () => window.removeEventListener('pos:unauthorized', onUnauthorized)
  }, [])

  async function login(name, pin) {
    const { token, user } = await api.login(name, pin)
    localStorage.setItem('pos_token', token)
    setUser(user)
  }

  async function logout() {
    try { await api.logout() } catch {}
    localStorage.removeItem('pos_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
