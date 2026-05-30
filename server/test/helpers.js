// Must be set before any require('../..') so db.js picks it up
process.env.DB_PATH = ':memory:'

const http = require('node:http')
const app = require('../app')
const db = require('../db')

let server
let baseUrl
let token = null

async function startServer() {
  await new Promise(resolve => {
    server = http.createServer(app)
    server.listen(0, resolve)
  })
  baseUrl = `http://localhost:${server.address().port}`
  // Log in as the seeded Admin user
  const res = await post('/api/auth/login', { name: 'Admin', pin: '0000' })
  token = res.body.token
}

async function stopServer() {
  await new Promise(resolve => server.close(resolve))
}

function clearDb() {
  db.exec(`
    DELETE FROM tab_items;
    DELETE FROM events;
    DELETE FROM tabs;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM sqlite_sequence
      WHERE name IN ('tab_items','events','tabs','products','categories');
  `)
  // Re-seed categories (users + sessions kept so the token stays valid)
  const ins = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)')
  ;[['Draught', 1], ['Bottles', 2], ['Spirits', 3], ['Soft Drinks', 4], ['Food', 5]]
    .forEach(([name, order]) => ins.run(name, order))
}

async function req(method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  return { status: res.status, body: data }
}

const get  = (path)       => req('GET',    path)
const post = (path, body) => req('POST',   path, body)
const put  = (path, body) => req('PUT',    path, body)
const del  = (path)       => req('DELETE', path)

module.exports = { startServer, stopServer, clearDb, get, post, put, del, db }
