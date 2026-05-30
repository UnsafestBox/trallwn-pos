const express = require('express')
const cors = require('cors')
const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/categories', require('./routes/categories'))
app.use('/api/products', require('./routes/products'))
app.use('/api/tabs', require('./routes/tabs'))
app.use('/api/reports', require('./routes/reports'))
app.use('/api/events', require('./routes/events'))

module.exports = app
