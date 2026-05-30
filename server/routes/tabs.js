const express = require('express')
const db = require('../db')
const router = express.Router()

const log = db.prepare(
  'INSERT INTO events (type, tab_id, tab_name, product_name, quantity, amount_pence, payment_method, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
)

function logEvent({ type, tab_id = null, tab_name = null, product_name = null, quantity = null, amount_pence = null, payment_method = null, note = null }) {
  log.run(type, tab_id, tab_name, product_name, quantity, amount_pence, payment_method, note)
}

router.get('/', (req, res) => {
  const status = req.query.status || 'open'
  const tabs = db.prepare(`
    SELECT t.*, COALESCE(SUM(ti.unit_price_pence * ti.quantity), 0) as total_pence
    FROM tabs t
    LEFT JOIN tab_items ti ON ti.tab_id = t.id
    WHERE t.status = ?
    GROUP BY t.id
    ORDER BY t.opened_at DESC
  `).all(status)
  res.json(tabs)
})

router.get('/:id', (req, res) => {
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(req.params.id)
  if (!tab) return res.status(404).json({ error: 'Tab not found' })
  const items = db.prepare('SELECT * FROM tab_items WHERE tab_id = ? ORDER BY added_at').all(req.params.id)
  const total_pence = items.reduce((sum, i) => sum + i.unit_price_pence * i.quantity, 0)
  res.json({ ...tab, items, total_pence })
})

router.post('/', (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const info = db.prepare("INSERT INTO tabs (name) VALUES (?)").run(name)
  logEvent({ type: 'tab_opened', tab_id: info.lastInsertRowid, tab_name: name })
  res.status(201).json({ id: info.lastInsertRowid, name, status: 'open' })
})

router.post('/:id/items', (req, res) => {
  const { product_id, quantity = 1, is_member = false } = req.body
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ? AND status = ?').get(req.params.id, 'open')
  if (!tab) return res.status(404).json({ error: 'Open tab not found' })

  const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(product_id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const memberPriceApplied = is_member && product.member_price_pence != null
  const unit_price = memberPriceApplied ? product.member_price_pence : product.price_pence

  db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?').run(quantity, product_id)

  const info = db.prepare(
    'INSERT INTO tab_items (tab_id, product_id, product_name, unit_price_pence, quantity, is_member) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, product_id, product.name, unit_price, quantity, memberPriceApplied ? 1 : 0)

  logEvent({
    type: 'item_added',
    tab_id: tab.id,
    tab_name: tab.name,
    product_name: product.name,
    quantity,
    amount_pence: unit_price * quantity,
    note: memberPriceApplied ? 'member price' : null,
  })

  res.status(201).json({ id: info.lastInsertRowid })
})

router.put('/:id/reprice', (req, res) => {
  const { is_member } = req.body
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ? AND status = ?').get(req.params.id, 'open')
  if (!tab) return res.status(404).json({ error: 'Open tab not found' })

  const items = db.prepare('SELECT * FROM tab_items WHERE tab_id = ?').all(req.params.id)
  const updateItem = db.prepare('UPDATE tab_items SET unit_price_pence = ?, is_member = ? WHERE id = ?')

  for (const item of items) {
    if (!item.product_id) continue
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.product_id)
    if (!product) continue
    const newPrice = (is_member && product.member_price_pence != null)
      ? product.member_price_pence
      : product.price_pence
    updateItem.run(newPrice, is_member ? 1 : 0, item.id)
  }

  res.json({ ok: true })
})

router.delete('/:id/items/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM tab_items WHERE id = ? AND tab_id = ?').get(req.params.itemId, req.params.id)
  if (!item) return res.status(404).json({ error: 'Item not found' })

  const tab = db.prepare('SELECT name FROM tabs WHERE id = ?').get(req.params.id)

  if (item.product_id) {
    db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?').run(item.quantity, item.product_id)
  }

  db.prepare('DELETE FROM tab_items WHERE id = ?').run(req.params.itemId)

  logEvent({
    type: 'item_removed',
    tab_id: Number(req.params.id),
    tab_name: tab?.name,
    product_name: item.product_name,
    quantity: item.quantity,
    amount_pence: item.unit_price_pence * item.quantity,
  })

  res.json({ ok: true })
})

router.put('/:id/close', (req, res) => {
  const { payment_method } = req.body
  if (!payment_method) return res.status(400).json({ error: 'payment_method required' })

  const tab = db.prepare('SELECT * FROM tabs WHERE id = ? AND status = ?').get(req.params.id, 'open')
  if (!tab) return res.status(404).json({ error: 'Open tab not found' })

  const total = db.prepare(
    'SELECT COALESCE(SUM(unit_price_pence * quantity), 0) as total FROM tab_items WHERE tab_id = ?'
  ).get(req.params.id)

  db.prepare(
    "UPDATE tabs SET status = 'closed', closed_at = datetime('now'), payment_method = ? WHERE id = ?"
  ).run(payment_method, req.params.id)

  logEvent({
    type: 'tab_settled',
    tab_id: tab.id,
    tab_name: tab.name,
    amount_pence: total.total,
    payment_method,
  })

  res.json({ ok: true })
})

router.delete('/:id', (req, res) => {
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ? AND status = ?').get(req.params.id, 'open')
  if (!tab) return res.status(404).json({ error: 'Open tab not found' })

  const total = db.prepare(
    'SELECT COALESCE(SUM(unit_price_pence * quantity), 0) as total FROM tab_items WHERE tab_id = ?'
  ).get(req.params.id)

  const items = db.prepare('SELECT * FROM tab_items WHERE tab_id = ?').all(req.params.id)
  const restoreStock = db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?')
  items.forEach(i => { if (i.product_id) restoreStock.run(i.quantity, i.product_id) })

  // Log before deleting — then nullify the FK so the tab row can be removed
  logEvent({ type: 'tab_voided', tab_id: tab.id, tab_name: tab.name, amount_pence: total.total })
  db.prepare('DELETE FROM tab_items WHERE tab_id = ?').run(req.params.id)
  db.prepare('UPDATE events SET tab_id = NULL WHERE tab_id = ?').run(req.params.id)
  db.prepare('DELETE FROM tabs WHERE id = ?').run(req.params.id)

  res.json({ ok: true })
})

module.exports = router
