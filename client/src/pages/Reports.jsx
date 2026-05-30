import React, { useState, useEffect } from 'react'
import { api } from '../api/index.js'

function fmt(pence) { return `£${(pence / 100).toFixed(2)}` }

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
          <div className="section">
            <div className="section-title">Daily summary — {date}</div>
            <div className="stats-grid">
              <div className="card stat-card">
                <div className="stat-label">Total takings</div>
                <div className="stat-value">{fmt(s.total_pence || 0)}</div>
                <div className="stat-sub">{s.tab_count} tabs closed</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Card</div>
                <div className="stat-value">{fmt(s.card_pence || 0)}</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Cash</div>
                <div className="stat-value">{fmt(s.cash_pence || 0)}</div>
              </div>
            </div>
          </div>

          {report.topItems.length > 0 && (
            <div className="section">
              <div className="section-title">Top sellers</div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="top-items">
                  <thead>
                    <tr><th>#</th><th>Product</th><th>Qty sold</th><th>Revenue</th></tr>
                  </thead>
                  <tbody>
                    {report.topItems.map((item, i) => (
                      <tr key={item.product_name}>
                        <td style={{ color: 'var(--text-dim)' }}>{i + 1}</td>
                        <td>{item.product_name}</td>
                        <td>{item.qty}</td>
                        <td>{fmt(item.revenue_pence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.byHour.length > 0 && (
            <div className="section">
              <div className="section-title">Revenue by hour</div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="top-items">
                  <thead><tr><th>Hour</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {report.byHour.map(row => (
                      <tr key={row.hour}>
                        <td>{row.hour}:00 – {row.hour}:59</td>
                        <td>{fmt(row.revenue_pence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {s.total_pence === 0 && (
            <div className="empty-state">No closed tabs on this date</div>
          )}
        </>
      )}

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
