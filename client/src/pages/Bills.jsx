import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api/index.js'

function fmt(pence) { return `£${(pence / 100).toFixed(2)}` }

function fmtDateTime(isoStr) {
  const d = new Date(isoStr + 'Z')
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

export default function Bills() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [payFilter, setPayFilter] = useState('')
  const [bills, setBills] = useState([])
  const [expanded, setExpanded] = useState(null)   // tab id currently open
  const [expandedItems, setExpandedItems] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setExpanded(null)
    try {
      const data = await api.getTabs('closed', { date, limit: 200 })
      setBills(data)
    } finally { setLoading(false) }
  }, [date])

  useEffect(() => { load() }, [load])

  async function expand(tab) {
    if (expanded === tab.id) { setExpanded(null); return }
    setExpanded(tab.id)
    const detail = await api.getTab(tab.id)
    setExpandedItems(detail.items)
  }

  const visible = payFilter ? bills.filter(b => b.payment_method === payFilter) : bills

  const totals = bills.reduce((acc, b) => {
    acc.total += b.total_pence
    if (b.payment_method === 'cash') acc.cash += b.total_pence
    if (b.payment_method === 'card') acc.card += b.total_pence
    return acc
  }, { total: 0, cash: 0, card: 0 })

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Settled Bills</span>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ width: 'auto' }}
        />
      </div>

      {/* Summary strip */}
      {bills.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: '10px 16px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4 }}>Bills</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{bills.length}</div>
          </div>
          <div className="card" style={{ padding: '10px 16px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4 }}>Total</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(totals.total)}</div>
          </div>
          <div className="card" style={{ padding: '10px 16px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4 }}>Card</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(totals.card)}</div>
          </div>
          <div className="card" style={{ padding: '10px 16px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4 }}>Cash</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(totals.cash)}</div>
          </div>
        </div>
      )}

      {/* Payment filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'card', 'cash'].map(m => (
          <button
            key={m}
            className={`cat-btn${payFilter === m ? ' active' : ''}`}
            onClick={() => setPayFilter(m)}
          >
            {m === '' ? 'All' : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div className="empty-state">Loading…</div>}
      {!loading && visible.length === 0 && (
        <div className="empty-state">No settled bills {date ? `on ${date}` : ''}</div>
      )}

      {!loading && visible.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {visible.map((bill, i) => {
            const isOpen = expanded === bill.id
            const isLast = i === visible.length - 1
            return (
              <div key={bill.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                {/* Bill header row */}
                <div
                  onClick={() => expand(bill)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: isOpen ? 'var(--surface2)' : undefined,
                    transition: 'background .1s',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{bill.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                      {bill.closed_at ? fmtDateTime(bill.closed_at) : '—'}
                      <span style={{ marginLeft: 8 }}>
                        · {bill.settled_by ?? 'unknown'}
                      </span>
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: bill.payment_method === 'card'
                        ? 'rgba(59,130,246,.15)' : 'rgba(34,197,94,.15)',
                      color: bill.payment_method === 'card'
                        ? 'var(--info)' : 'var(--success)',
                    }}
                  >
                    {bill.payment_method}
                  </span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', textAlign: 'right' }}>
                    {fmt(bill.total_pence)}
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', width: 16, textAlign: 'center' }}>
                    {isOpen ? '▲' : '▼'}
                  </div>
                </div>

                {/* Expanded items */}
                {isOpen && (
                  <div style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
                    {expandedItems.length === 0 && (
                      <div className="empty-state" style={{ padding: '12px 16px' }}>No items</div>
                    )}
                    {expandedItems.map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 24px',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '0.875rem',
                        }}
                      >
                        <span style={{ flex: 1 }}>{item.product_name}</span>
                        {item.is_member === 1 && (
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>M</span>
                        )}
                        <span style={{ color: 'var(--text-dim)' }}>×{item.quantity}</span>
                        <span style={{ fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
                          {fmt(item.unit_price_pence * item.quantity)}
                        </span>
                      </div>
                    ))}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '10px 24px', fontWeight: 700, fontSize: '0.9rem',
                    }}>
                      <span>Total</span>
                      <span>{fmt(bill.total_pence)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
