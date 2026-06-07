import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api/index.js'

function fmt(pence) { return `£${(pence / 100).toFixed(2)}` }

function fmtTime(isoStr) {
  // SQLite returns UTC without Z — append it for correct parsing
  const d = new Date(isoStr + 'Z')
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDate(isoStr) {
  const d = new Date(isoStr + 'Z')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const TYPE_META = {
  tab_opened:    { label: 'Tab opened',    color: 'var(--info)',     icon: '📂' },
  item_added:    { label: 'Item added',    color: 'var(--text)',     icon: '➕' },
  item_removed:  { label: 'Item removed',  color: 'var(--text-dim)', icon: '➖' },
  tab_settled:   { label: 'Tab settled',   color: 'var(--success)',  icon: '✅' },
  tab_voided:    { label: 'Tab voided',    color: 'var(--danger)',   icon: '🗑️' },
  login_success: { label: 'Login',         color: 'var(--success)',  icon: '🔓' },
  login_failed:  { label: 'Failed login',  color: 'var(--danger)',   icon: '🔒' },
  user_created:  { label: 'User created',  color: 'var(--info)',     icon: '👤' },
  user_updated:  { label: 'User updated',  color: 'var(--text-dim)', icon: '✏️' },
}

const ALL_TYPES = Object.keys(TYPE_META)

export default function Log() {
  const [events, setEvents] = useState([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getEvents({ date, type: typeFilter || undefined, limit: 500 })
      setEvents(data)
    } finally { setLoading(false) }
  }, [date, typeFilter])

  useEffect(() => { load() }, [load])

  // Group by date for display (useful when no date filter)
  let lastDate = null

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Activity Log</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setDate('')} style={{ opacity: date ? 1 : .4 }}>
            All dates
          </button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ width: 'auto' }}
          />
        </div>
      </div>

      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          className={`cat-btn${typeFilter === '' ? ' active' : ''}`}
          onClick={() => setTypeFilter('')}
        >All</button>
        {ALL_TYPES.map(t => (
          <button
            key={t}
            className={`cat-btn${typeFilter === t ? ' active' : ''}`}
            onClick={() => setTypeFilter(t)}
          >{TYPE_META[t].label}</button>
        ))}
      </div>

      {loading && <div className="empty-state">Loading...</div>}

      {!loading && events.length === 0 && (
        <div className="empty-state">No events found</div>
      )}

      {!loading && events.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {events.map((ev, i) => {
            const evDate = ev.created_at.slice(0, 10)
            const showDateSep = !date && evDate !== lastDate
            if (showDateSep) lastDate = evDate
            const meta = TYPE_META[ev.type] ?? { label: ev.type, color: 'var(--text-dim)', icon: '•' }

            return (
              <React.Fragment key={ev.id}>
                {showDateSep && (
                  <div style={{
                    padding: '8px 16px', background: 'var(--surface2)',
                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {fmtDate(ev.created_at)}
                  </div>
                )}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr auto',
                  gap: '0 16px',
                  alignItems: 'start',
                  padding: '12px 16px',
                  borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Time */}
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', paddingTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtTime(ev.created_at)}
                  </div>

                  {/* Description */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ color: meta.color, fontSize: '0.8rem', fontWeight: 700 }}>
                        {meta.icon} {meta.label}
                      </span>
                      {ev.tab_name && (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>· {ev.tab_name}</span>
                      )}
                      {ev.user_name && (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginLeft: 'auto' }}>
                          {ev.user_name}
                        </span>
                      )}
                    </div>
                    {ev.product_name && (
                      <div style={{ fontSize: '0.875rem' }}>
                        {ev.product_name}
                        {ev.quantity && ev.quantity > 1 && (
                          <span style={{ color: 'var(--text-dim)' }}> ×{ev.quantity}</span>
                        )}
                      </div>
                    )}
                    {ev.note && (
                      <div style={{ fontSize: '0.8rem', color: ev.type === 'login_failed' ? 'var(--danger)' : 'var(--text-dim)', marginTop: 2 }}>
                        {ev.type === 'login_failed' ? `Attempted: ${ev.note}` : ev.note}
                      </div>
                    )}
                  </div>

                  {/* Amount / payment */}
                  <div style={{ textAlign: 'right' }}>
                    {ev.amount_pence != null && (
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{fmt(ev.amount_pence)}</div>
                    )}
                    {ev.payment_method && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>{ev.payment_method}</div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      )}

      {!loading && events.length > 0 && (
        <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'right' }}>
          {events.length} event{events.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
