import React, { useState, useEffect } from 'react'
import { api } from '../api/index.js'

function fmt(pence) { return `£${(pence / 100).toFixed(2)}` }

function pct(part, total) {
  if (!total || !part || isNaN(part)) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export default function Reports() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)

  async function loadReport() {
    setLoading(true)
    try {
      const [r, a] = await Promise.all([api.getDailyReport(date), api.getStockAlerts()])
      setReport(r)
      setAlerts(a)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadReport() }, [date])

  const s = report?.summary

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Reports</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
      </div>

      {loading && <div className="empty-state">Loading...</div>}

      {report && !loading && (
        <>
          {/* ── Overall summary ─────────────────────────────── */}
          <div className="section">
            <div className="section-title">Daily summary — {date}</div>
            <div className="stats-grid">
              <StatCard
                label="Total takings"
                value={fmt(s.total_pence || 0)}
                sub={`${s.tab_count} bill${s.tab_count !== 1 ? 's' : ''} settled`}
              />
              <StatCard label="Card" value={fmt(s.card_pence || 0)} sub={pct(s.card_pence, s.total_pence)} />
              <StatCard label="Cash" value={fmt(s.cash_pence || 0)} sub={pct(s.cash_pence, s.total_pence)} />
            </div>
          </div>

          {/* ── Member vs non-member ─────────────────────────── */}
          {s.total_pence > 0 && (
            <div className="section">
              <div className="section-title">Member vs non-member</div>
              <div className="stats-grid">
                <StatCard
                  label="Member revenue"
                  value={fmt(s.member_pence || 0)}
                  sub={`${s.member_items || 0} item${s.member_items !== 1 ? 's' : ''} · ${pct(s.member_pence, s.total_pence)}`}
                  accent="var(--success)"
                />
                <StatCard
                  label="Non-member revenue"
                  value={fmt(s.non_member_pence || 0)}
                  sub={`${s.non_member_items || 0} item${s.non_member_items !== 1 ? 's' : ''} · ${pct(s.non_member_pence, s.total_pence)}`}
                />
              </div>

              {/* Visual split bar */}
              {(s.member_pence > 0 || s.non_member_pence > 0) && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--surface2)' }}>
                    <div style={{
                      width: pct(s.member_pence, s.total_pence),
                      background: 'var(--success)',
                      transition: 'width .3s',
                    }} />
                    <div style={{
                      width: pct(s.non_member_pence, s.total_pence),
                      background: 'var(--border)',
                      transition: 'width .3s',
                    }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    <span style={{ color: 'var(--success)' }}>■ Member {pct(s.member_pence, s.total_pence)}</span>
                    <span>■ Non-member {pct(s.non_member_pence, s.total_pence)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Top sellers ──────────────────────────────────── */}
          {report.topItems.length > 0 && (
            <div className="section">
              <div className="section-title">Top sellers</div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="top-items">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right', color: 'var(--success)' }}>Member</th>
                      <th style={{ textAlign: 'right', color: 'var(--text-dim)' }}>Non-mbr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topItems.map((item, i) => (
                      <tr key={item.product_name}>
                        <td style={{ color: 'var(--text-dim)' }}>{i + 1}</td>
                        <td>{item.product_name}</td>
                        <td style={{ textAlign: 'right' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(item.revenue_pence)}</td>
                        <td style={{ textAlign: 'right', color: item.member_qty > 0 ? 'var(--success)' : 'var(--text-dim)' }}>
                          {item.member_qty > 0 ? `${item.member_qty} (${fmt(item.member_revenue_pence)})` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-dim)' }}>
                          {item.non_member_qty > 0 ? `${item.non_member_qty} (${fmt(item.non_member_revenue_pence)})` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Revenue by hour ──────────────────────────────── */}
          {report.byHour.length > 0 && (
            <div className="section">
              <div className="section-title">Revenue by hour</div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="top-items">
                  <thead><tr><th>Hour</th><th style={{ textAlign: 'right' }}>Revenue</th></tr></thead>
                  <tbody>
                    {report.byHour.map(row => (
                      <tr key={row.hour}>
                        <td>{row.hour}:00 – {row.hour}:59</td>
                        <td style={{ textAlign: 'right' }}>{fmt(row.revenue_pence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {s.total_pence === 0 && (
            <div className="empty-state">No closed bills on this date</div>
          )}
        </>
      )}

      {/* ── Stock alerts ─────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="section">
          <div className="section-title" style={{ color: 'var(--danger)' }}>Stock alerts</div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="top-items">
              <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Min</th></tr></thead>
              <tbody>
                {alerts.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{p.category_name}</td>
                    <td><span className="badge badge-danger">{p.stock_qty}</span></td>
                    <td style={{ color: 'var(--text-dim)' }}>{p.min_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
