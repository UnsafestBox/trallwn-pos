const express = require('express')
const db = require('../db')
const router = express.Router()

function listHandler(_req, res) {
  res.json(db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all())
}

router.post('/', (req, res) => {
  const { name, sort_order = 99 } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  try {
    const info = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, sort_order)
    res.status(201).json({ id: info.lastInsertRowid, name, sort_order })
  } catch {
    res.status(409).json({ error: 'Category already exists' })
  }
})

router.put('/:id', (req, res) => {
  const { name, sort_order } = req.body
  db.prepare('UPDATE categories SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order) WHERE id = ?')
    .run(name, sort_order, req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = { listHandler, router }
