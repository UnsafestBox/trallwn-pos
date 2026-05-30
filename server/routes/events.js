const express = require('express')
const db = require('../db')
const router = express.Router()

router.get('/', (req, res) => {
  const { date, type, limit = 200 } = req.query

  let query = 'SELECT * FROM events'
  const conditions = []
  const params = []

  if (date) {
    conditions.push("date(created_at) = ?")
    params.push(date)
  }
  if (type) {
    conditions.push("type = ?")
    params.push(type)
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
  query += ' ORDER BY created_at DESC LIMIT ?'
  params.push(Number(limit))

  res.json(db.prepare(query).all(...params))
})

module.exports = router
