const express = require('express')
const db = require('../db')
const { hashPin, randomToken } = require('../lib/crypto')
const { requireAuth } = require('../middleware/auth')
const router = express.Router()

// Public — list active users by name for the login screen
router.get('/users', (_req, res) => {
  const users = db.prepare('SELECT id, name FROM users WHERE active = 1 ORDER BY name').all()
  res.json(users)
})

// Public — verify PIN and create session
router.post('/login', (req, res) => {
  const { name, pin } = req.body
  if (!name || !pin) return res.status(400).json({ error: 'name and pin required' })

  const user = db.prepare('SELECT * FROM users WHERE name = ? AND active = 1').get(name)
  if (!user || user.pin_hash !== hashPin(pin)) {
    return res.status(401).json({ error: 'Incorrect name or PIN' })
  }

  const token = randomToken()
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id)

  res.json({ token, user: { id: user.id, name: user.name, role: user.role } })
})

// Protected — return current user from token
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user)
})

// Protected — delete session (logout)
router.post('/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  res.json({ ok: true })
})

module.exports = router
