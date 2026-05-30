const express = require('express')
const db = require('../db')
const router = express.Router()

router.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1
    ORDER BY c.sort_order, p.name
  `).all()
  res.json(rows)
})

router.post('/', (req, res) => {
  const { name, category_id, price_pence, member_price_pence = null, stock_qty = 0, min_stock = 0 } = req.body
  if (!name || !category_id || price_pence == null) {
    return res.status(400).json({ error: 'name, category_id, price_pence required' })
  }
  const info = db.prepare(
    'INSERT INTO products (name, category_id, price_pence, member_price_pence, stock_qty, min_stock) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, category_id, price_pence, member_price_pence, stock_qty, min_stock)
  res.status(201).json({ id: info.lastInsertRowid })
})

router.put('/:id', (req, res) => {
  const { name, category_id, price_pence, stock_qty, min_stock, active } = req.body
  const id = req.params.id

  if (name !== undefined)         db.prepare('UPDATE products SET name = ? WHERE id = ?').run(name, id)
  if (category_id !== undefined)  db.prepare('UPDATE products SET category_id = ? WHERE id = ?').run(category_id, id)
  if (price_pence !== undefined)  db.prepare('UPDATE products SET price_pence = ? WHERE id = ?').run(price_pence, id)
  if (stock_qty !== undefined)    db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(stock_qty, id)
  if (min_stock !== undefined)    db.prepare('UPDATE products SET min_stock = ? WHERE id = ?').run(min_stock, id)
  if (active !== undefined)       db.prepare('UPDATE products SET active = ? WHERE id = ?').run(active, id)
  // member_price_pence is always present in a full edit (null means "clear it")
  if ('member_price_pence' in req.body) {
    db.prepare('UPDATE products SET member_price_pence = ? WHERE id = ?').run(req.body.member_price_pence, id)
  }

  res.json({ ok: true })
})

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
