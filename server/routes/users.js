const express = require('express')
const db = require('../db')
const { hashPin } = require('../lib/crypto')
const router = express.Router()

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT id, name, role, active FROM users ORDER BY name').all())
})

router.post('/', (req, res) => {
  const { name, pin, role = 'normal' } = req.body
  if (!name || !pin) return res.status(400).json({ error: 'name and pin required' })
  if (!['normal', 'super'].includes(role)) return res.status(400).json({ error: 'role must be normal or super' })
  try {
    const info = db.prepare('INSERT INTO users (name, pin_hash, role) VALUES (?, ?, ?)')
      .run(name, hashPin(String(pin)), role)
    res.status(201).json({ id: info.lastInsertRowid })
  } catch {
    res.status(409).json({ error: 'Name already taken' })
  }
})

router.put('/:id', (req, res) => {
  const { name, pin, role, active } = req.body
  const id = req.params.id

  // Prevent removing the last super user
  if (role === 'normal' || active === 0) {
    const superCount = db.prepare("SELECT COUNT(*) as n FROM users WHERE role = 'super' AND active = 1 AND id != ?").get(id)
    if (superCount.n === 0) {
      return res.status(400).json({ error: 'Cannot demote or deactivate the last super user' })
    }
  }

  if (name !== undefined)   db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id)
  if (pin !== undefined)    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(String(pin)), id)
  if (role !== undefined)   db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
  if (active !== undefined) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active, id)

  res.json({ ok: true })
})

module.exports = router
