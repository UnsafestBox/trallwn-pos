const db = require('../db')

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  const session = db.prepare(`
    SELECT s.token, u.id as user_id, u.name as user_name, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND u.active = 1
  `).get(token)

  if (!session) return res.status(401).json({ error: 'Invalid or expired session' })

  req.user = { id: session.user_id, name: session.user_name, role: session.role }
  next()
}

function requireSuper(req, res, next) {
  if (req.user?.role !== 'super') {
    return res.status(403).json({ error: 'Super user access required' })
  }
  next()
}

module.exports = { requireAuth, requireSuper }
