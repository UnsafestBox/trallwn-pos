const express = require('express')
const cors = require('cors')
const { requireAuth, requireSuper } = require('./middleware/auth')
const config = require('./config')

const app = express()
app.use(cors())
app.use(express.json())

// Public — feature/auth config for the client
app.get('/api/config', (_req, res) => res.json(config))

// Public — login/logout/me
app.use('/api/auth', require('./routes/auth'))

// All routes below require a valid session
app.use(requireAuth)

// All authenticated users: read menu, manage tabs, see reports and bills
app.get('/api/categories',    require('./routes/categories').listHandler)
app.get('/api/products',      require('./routes/products').listHandler)
app.use('/api/tabs',          require('./routes/tabs'))
app.use('/api/reports',       require('./routes/reports'))

// Super users only: write to stock, see full event log, manage users
app.use('/api/categories',    requireSuper, require('./routes/categories').router)
app.use('/api/products',      requireSuper, require('./routes/products').router)
app.use('/api/events',        requireSuper, require('./routes/events'))
app.use('/api/users',         requireSuper, require('./routes/users'))

module.exports = app
