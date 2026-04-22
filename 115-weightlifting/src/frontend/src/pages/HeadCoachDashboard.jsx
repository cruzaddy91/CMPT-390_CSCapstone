import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHeadOrgSummary } from '../services/api'
import { formatApiError } from '../utils/errors'
import './HeadCoachDashboard.css'

const HeadCoachDashboard = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getHeadOrgSummary()
      .then((data) => {
        if (!cancelled) setRows(data.coaches || [])
      })
      .catch((err) => {
        if (!cancelled) setError(formatApiError(err, 'Could not load org summary.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="head-dashboard">
      <header className="head-dashboard-header">
        <div>
          <p className="head-dashboard-eyebrow">Head coach</p>
          <h1>Organization summary</h1>
          <p className="head-dashboard-lede">
            Compare staff workload: roster size, programs, PRs, and workout logs per coach (including your own roster).
          </p>
        </div>
        <Link to="/coach" className="head-dashboard-link-coach">Open coach workspace</Link>
      </header>

      {loading && <p className="head-dashboard-status">Loading…</p>}
      {error && <div className="save-message error">{error}</div>}

      {!loading && !error && (
        <div className="head-table-wrap">
          <table className="head-table">
            <thead>
              <tr>
                <th>Coach</th>
                <th>Role</th>
                <th>Athletes</th>
                <th>Programs</th>
                <th>PRs</th>
                <th>Workout logs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>@{row.username}</td>
                  <td>{row.user_type === 'head_coach' ? 'Head' : 'Line'}</td>
                  <td>{row.athlete_count}</td>
                  <td>{row.program_count}</td>
                  <td>{row.personal_record_count}</td>
                  <td>{row.workout_log_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default HeadCoachDashboard
