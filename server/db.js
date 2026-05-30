const { DatabaseSync } = require('node:sqlite')
const path = require('path')

const dbPath = process.env.DB_PATH || path.join(__dirname, 'pos.db')
const db = new DatabaseSync(dbPath)

if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    price_pence INTEGER NOT NULL,
    stock_qty REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS tabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT,
    payment_method TEXT,
    status TEXT NOT NULL DEFAULT 'open'
  );

  CREATE TABLE IF NOT EXISTS tab_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tab_id INTEGER NOT NULL REFERENCES tabs(id),
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    unit_price_pence INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    tab_id INTEGER REFERENCES tabs(id),
    tab_name TEXT,
    product_name TEXT,
    quantity INTEGER,
    amount_pence INTEGER,
    payment_method TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Migrations for columns added after initial release
try { db.exec('ALTER TABLE products ADD COLUMN member_price_pence INTEGER') } catch {}
try { db.exec('ALTER TABLE tab_items ADD COLUMN is_member INTEGER NOT NULL DEFAULT 0') } catch {}

const catCount = db.prepare('SELECT COUNT(*) as n FROM categories').get()
if (catCount.n === 0) {
  const insertCat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)')
  ;[['Draught', 1], ['Bottles', 2], ['Spirits', 3], ['Soft Drinks', 4], ['Food', 5]].forEach(
    ([name, order]) => insertCat.run(name, order)
  )
}

module.exports = db
