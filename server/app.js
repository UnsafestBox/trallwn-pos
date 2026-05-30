const express = require('express')
const cors = require('cors')
const { requireAuth, requireSuper } = require('./middleware/auth')

const app = express()
app.use(cors())
app.use(express.json())

// Public — login/logout/me
app.use('/api/auth', require('./routes/auth'))

// All routes below require a valid session
app.use(requireAuth)

// Normal users: read products/categories (needed for the POS menu), manage tabs
app.get('/api/categories',    require('./routes/categories').listHandler)
app.get('/api/products',      require('./routes/products').listHandler)
app.use('/api/tabs',          require('./routes/tabs'))

// Super users only: write to stock, see reports/logs, manage users
app.use('/api/categories',    requireSuper, require('./routes/categories').router)
app.use('/api/products',      requireSuper, require('./routes/products').router)
app.use('/api/reports',       requireSuper, require('./routes/reports'))
app.use('/api/events',        requireSuper, require('./routes/events'))
app.use('/api/users',         requireSuper, require('./routes/users'))

module.exports = app
