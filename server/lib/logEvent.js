const db = require('../db')

const stmt = db.prepare(
  'INSERT INTO events (type, tab_id, tab_name, product_name, quantity, amount_pence, payment_method, note, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
)

function logEvent({
  type,
  tab_id = null, tab_name = null,
  product_name = null, quantity = null,
  amount_pence = null, payment_method = null,
  note = null,
  user_id = null, user_name = null,
}) {
  stmt.run(type, tab_id, tab_name, product_name, quantity, amount_pence, payment_method, note, user_id, user_name)
}

module.exports = { logEvent }
