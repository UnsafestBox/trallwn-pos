const express = require('express')
const db = require('../db')
const router = express.Router()

router.get('/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10)

  const summary = db.prepare(`
    SELECT
      COUNT(DISTINCT t.id) as tab_count,
      COALESCE(SUM(ti.unit_price_pence * ti.quantity), 0)                                               as total_pence,
      SUM(CASE WHEN t.payment_method = 'cash' THEN ti.unit_price_pence * ti.quantity ELSE 0 END)        as cash_pence,
      SUM(CASE WHEN t.payment_method = 'card' THEN ti.unit_price_pence * ti.quantity ELSE 0 END)        as card_pence,
      SUM(CASE WHEN ti.is_member = 1 THEN ti.unit_price_pence * ti.quantity ELSE 0 END)                 as member_pence,
      SUM(CASE WHEN ti.is_member = 0 THEN ti.unit_price_pence * ti.quantity ELSE 0 END)                 as non_member_pence,
      SUM(CASE WHEN ti.is_member = 1 THEN ti.quantity ELSE 0 END)                                       as member_items,
      SUM(CASE WHEN ti.is_member = 0 THEN ti.quantity ELSE 0 END)                                       as non_member_items
    FROM tabs t
    JOIN tab_items ti ON ti.tab_id = t.id
    WHERE t.status = 'closed' AND date(t.closed_at) = ?
  `).get(date)

  const topItems = db.prepare(`
    SELECT
      ti.product_name,
      SUM(ti.quantity)                                                   as qty,
      SUM(ti.unit_price_pence * ti.quantity)                             as revenue_pence,
      SUM(CASE WHEN ti.is_member = 1 THEN ti.quantity ELSE 0 END)       as member_qty,
      SUM(CASE WHEN ti.is_member = 0 THEN ti.quantity ELSE 0 END)       as non_member_qty,
      SUM(CASE WHEN ti.is_member = 1 THEN ti.unit_price_pence * ti.quantity ELSE 0 END) as member_revenue_pence,
      SUM(CASE WHEN ti.is_member = 0 THEN ti.unit_price_pence * ti.quantity ELSE 0 END) as non_member_revenue_pence
    FROM tabs t
    JOIN tab_items ti ON ti.tab_id = t.id
    WHERE t.status = 'closed' AND date(t.closed_at) = ?
    GROUP BY ti.product_name
    ORDER BY qty DESC
    LIMIT 10
  `).all(date)

  const byHour = db.prepare(`
    SELECT strftime('%H', t.closed_at) as hour, SUM(ti.unit_price_pence * ti.quantity) as revenue_pence
    FROM tabs t
    JOIN tab_items ti ON ti.tab_id = t.id
    WHERE t.status = 'closed' AND date(t.closed_at) = ?
    GROUP BY hour
    ORDER BY hour
  `).all(date)

  res.json({ date, summary, topItems, byHour })
})

router.get('/stock-alerts', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 AND p.stock_qty <= p.min_stock
    ORDER BY (p.stock_qty - p.min_stock), p.name
  `).all()
  res.json(rows)
})

module.exports = router
