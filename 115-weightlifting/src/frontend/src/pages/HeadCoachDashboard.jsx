import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getHeadOrgRoster,
  getHeadOrgSummary,
  patchHeadAthletePrimaryCoach,
  patchHeadStaffLink,
  postHeadStaffInvite,
} from '../services/api'
import { getCurrentUser } from '../utils/auth'
import { formatApiError } from '../utils/errors'
import './HeadCoachDashboard.css'

const HeadCoachDashboard = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [roster, setRoster] = useState({ staff: [], athletes: [] })
  const [rosterLoading, setRosterLoading] = useState(true)
  const [rosterError, setRosterError] = useState('')
  const [inviteUsername, setInviteUsername] = useState('')
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignMessage, setAssignMessage] = useState('')

  const headUser = getCurrentUser()
  const headId = headUser?.id

  const loadSummary = useCallback(() => {
    return getHeadOrgSummary()
      .then((data) => {
        setRows(data.coaches || [])
        setError('')
      })
      .catch((err) => {
        setError(formatApiError(err, 'Could not load org summary.'))
      })
  }, [])

  const loadRoster = useCallback(() => {
    return getHeadOrgRoster()
      .then((data) => {
        setRoster({
          staff: data.staff || [],
          athletes: data.athletes || [],
        })
        setRosterError('')
      })
      .catch((err) => {
        setRosterError(formatApiError(err, 'Could not load roster.'))
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setRosterLoading(true)
    Promise.all([loadSummary(), loadRoster()])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRosterLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [loadSummary, loadRoster])

  const coachOptions = () => {
    if (!headId) return []
    const opts = [{ id: headId, label: `@${headUser?.username || 'you'} (head)` }]
    roster.staff.forEach((s) => {
      opts.push({ id: s.id, label: `@${s.username} (line)` })
    })
    return opts
  }

  const refreshAll = () => Promise.all([loadSummary(), loadRoster()])

  const handleInvite = async (e) => {
    e.preventDefault()
    const u = inviteUsername.trim()
    if (!u) return
    setAssignBusy(true)
    setAssignMessage('')
    try {
      await postHeadStaffInvite(u)
      setInviteUsername('')
      setAssignMessage(`Linked @${u}.`)
      await refreshAll()
    } catch (err) {
      setAssignMessage(formatApiError(err, 'Could not add coach.'))
    } finally {
      setAssignBusy(false)
    }
  }

  const handleUnlinkStaff = async (userId, username) => {
    if (!window.confirm(`Remove @${username} from your org?`)) return
    setAssignBusy(true)
    setAssignMessage('')
    try {
      await patchHeadStaffLink(userId, false)
      setAssignMessage(`Removed @${username}.`)
      await refreshAll()
    } catch (err) {
      setAssignMessage(formatApiError(err, 'Could not remove coach.'))
    } finally {
      setAssignBusy(false)
    }
  }

  const handleAthleteCoachChange = async (athleteId, primaryCoachId) => {
    setAssignBusy(true)
    setAssignMessage('')
    try {
      await patchHeadAthletePrimaryCoach(athleteId, Number(primaryCoachId))
      setAssignMessage('Athlete coach updated.')
      await refreshAll()
    } catch (err) {
      setAssignMessage(formatApiError(err, 'Could not update athlete coach.'))
    } finally {
      setAssignBusy(false)
    }
  }

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

      {loading && <p className="head-dashboard-status">Loading summary…</p>}
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
                  <td><span className="username-highlight">@{row.username}</span></td>
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

      <section className="head-assign-section" aria-labelledby="head-assign-heading">
        <h2 id="head-assign-heading" className="head-assign-title">Assignments</h2>
        <p className="head-assign-lede">
          Add line coaches by username. Set each athlete&apos;s accountable coach (you or a line coach under you).
        </p>

        {rosterLoading && <p className="head-dashboard-status">Loading roster…</p>}
        {rosterError && <div className="save-message error">{rosterError}</div>}
        {assignMessage && (
          <div className={assignMessage.includes('Could not') ? 'save-message error' : 'save-message'}>
            {assignMessage}
          </div>
        )}

        {!rosterLoading && !rosterError && (
          <>
            <form className="head-invite-form" onSubmit={handleInvite}>
              <label htmlFor="head-invite-user" className="sr-only">Coach username</label>
              <input
                id="head-invite-user"
                type="text"
                autoComplete="username"
                placeholder="Line coach username"
                value={inviteUsername}
                onChange={(ev) => setInviteUsername(ev.target.value)}
                disabled={assignBusy}
              />
              <button type="submit" className="head-btn-primary" disabled={assignBusy}>
                Add to org
              </button>
            </form>

            <div className="head-assign-card">
              <h3>Line coaches</h3>
              {roster.staff.length === 0 ? (
                <p className="head-assign-empty">No line coaches yet.</p>
              ) : (
                <ul className="head-assign-list">
                  {roster.staff.map((s) => (
                    <li key={s.id}>
                      <span className="username-highlight">@{s.username}</span>
                      <button
                        type="button"
                        className="head-btn-danger"
                        disabled={assignBusy}
                        onClick={() => handleUnlinkStaff(s.id, s.username)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="head-assign-card">
              <h3>Athletes</h3>
              {roster.athletes.length === 0 ? (
                <p className="head-assign-empty">No athletes in your org yet (set primary coach).</p>
              ) : (
                <table className="head-table head-athlete-table">
                  <thead>
                    <tr>
                      <th>Athlete</th>
                      <th>Accountable coach</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.athletes.map((a) => (
                      <tr key={a.id}>
                        <td><span className="username-highlight">@{a.username}</span></td>
                        <td>
                          <select
                            className="head-coach-select"
                            value={a.primary_coach_id ?? ''}
                            disabled={assignBusy || !headId}
                            onChange={(ev) => handleAthleteCoachChange(a.id, ev.target.value)}
                          >
                            {coachOptions().map((opt) => (
                              <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default HeadCoachDashboard
