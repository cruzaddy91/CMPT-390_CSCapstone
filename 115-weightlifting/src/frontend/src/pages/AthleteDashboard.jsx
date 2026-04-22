import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import AthleteExerciseCard from '../components/AthleteExerciseCard'
import WeekStrip from '../components/WeekStrip'
import {
  calculateSinclair,
  createPersonalRecord,
  createWorkoutLog,
  getPersonalRecords,
  getProgramsFromBackend,
  getWorkoutLogs,
  updateProgramCompletion,
} from '../services/api'
import { getCurrentUser } from '../utils/auth'
import { getDayCompletionKey, normalizeProgramData } from '../utils/dataStructure'
import { formatApiError } from '../utils/errors'
import {
  computeLifetimeCompletions,
  computeStreak,
  crossedCompletionMilestone,
  crossedStreakMilestone,
  hasMilestoneFired,
  markMilestoneFired,
} from '../utils/streaks'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const chartTickColor = '#b3d4ee'
const chartGridColor = 'rgba(95, 228, 255, 0.14)'
const chartBorderColor = 'rgba(95, 228, 255, 0.34)'

const liftLabels = { snatch: 'Snatch', clean_jerk: 'Clean & Jerk', total: 'Total' }

const getWeekBucket = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day)
  return date.toISOString().split('T')[0]
}

// Default-day selection: match today's weekday name first, else fall back to
// the earliest day that still has work left. Keeps the athlete on 'what's next'
// without forcing them to hunt for their day each visit.
const pickDefaultDayId = (days, entriesByDayId) => {
  if (!days || days.length === 0) return null
  const todayName = WEEKDAY_NAMES[new Date().getDay()]
  const todayMatch = days.find((d) => (d.day || '').trim().toLowerCase() === todayName.toLowerCase())
  if (todayMatch) return todayMatch.id
  const firstIncomplete = days.find((d) => {
    const entries = entriesByDayId[d.id] || {}
    const completed = Object.values(entries).filter((e) => e?.completed).length
    return completed < (d.exercises?.length || 0)
  })
  return (firstIncomplete || days[0]).id
}

const AthleteDashboard = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [programs, setPrograms] = useState([])
  const [completions, setCompletions] = useState({})
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [personalRecords, setPersonalRecords] = useState([])
  const [activeProgramId, setActiveProgramId] = useState(null)
  const [selectedDayId, setSelectedDayId] = useState(null)
  const [drawerSection, setDrawerSection] = useState(null) // 'workout' | 'pr' | 'stats' | null
  // Encouragement toast is separate from saveMessage so the technical 'Logged'
  // status and the emotional milestone humor don't overwrite each other when
  // both fire in the same save cycle.
  const [encouragement, setEncouragement] = useState('')

  // completionsRef holds the latest completions synchronously so rapid-tap
  // handleSaveResult calls don't each read a stale closure-captured copy.
  // saveChainRef serializes PATCHes per program: each save awaits the
  // previous one, so server-side state stays consistent even if responses
  // would otherwise arrive out of order.
  const completionsRef = useRef(completions)
  const saveChainRef = useRef(Promise.resolve())
  useEffect(() => { completionsRef.current = completions }, [completions])

  const [logForm, setLogForm] = useState({
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [prForm, setPrForm] = useState({
    lift_type: 'snatch',
    weight: '',
    date: new Date().toISOString().split('T')[0],
  })
  const [sinclairForm, setSinclairForm] = useState({ bodyweight_kg: '', total_kg: '', gender: 'M' })
  const [sinclairResult, setSinclairResult] = useState(null)
  const [sinclairLoading, setSinclairLoading] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const [programResponse, workoutResponse, prResponse] = await Promise.all([
        getProgramsFromBackend(),
        getWorkoutLogs(),
        getPersonalRecords(),
      ])

      const completionEntries = programResponse.map((program) => [
        program.id,
        program.completion_data || { entries: {} },
      ])

      setPrograms(programResponse)
      setWorkoutLogs(workoutResponse)
      setPersonalRecords(prResponse)
      setCompletions(Object.fromEntries(completionEntries))
      setSaveMessage('')

      // Default active program = first one assigned. Most athletes have only
      // one program; the chip row (rendered only when length > 1) lets them
      // swap if they have several.
      if (programResponse.length > 0 && !activeProgramId) {
        setActiveProgramId(programResponse[0].id)
      }
    } catch (error) {
      console.error('Error loading athlete dashboard:', error)
      setSaveMessage(formatApiError(error, 'Could not load dashboard data.'))
    } finally {
      setLoading(false)
    }
  }

  // Seed the selected-day on first load once we know the active program's days
  // and their completion state.
  const activeProgram = useMemo(
    () => programs.find((p) => p.id === activeProgramId) || programs[0],
    [programs, activeProgramId],
  )

  const activeProgramNormalized = useMemo(
    () => (activeProgram ? normalizeProgramData(activeProgram.program_data, activeProgram.start_date) : null),
    [activeProgram],
  )

  const activeCompletionEntries = completions[activeProgram?.id]?.entries || {}

  useEffect(() => {
    if (!activeProgramNormalized) return
    if (selectedDayId) {
      const stillValid = activeProgramNormalized.days.some((d) => d.id === selectedDayId)
      if (stillValid) return
    }
    const defaultId = pickDefaultDayId(activeProgramNormalized.days, activeCompletionEntries)
    if (defaultId) setSelectedDayId(defaultId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProgramNormalized, activeCompletionEntries])

  const completionCounts = useMemo(() => {
    if (!activeProgramNormalized) return {}
    const out = {}
    activeProgramNormalized.days.forEach((day) => {
      const entries = activeCompletionEntries[day.id] || {}
      const total = day.exercises?.length || 0
      const completed = Object.values(entries).filter((e) => e?.completed).length
      out[day.id] = { completed, total }
    })
    return out
  }, [activeProgramNormalized, activeCompletionEntries])

  const selectedDay = useMemo(
    () => activeProgramNormalized?.days.find((d) => d.id === selectedDayId),
    [activeProgramNormalized, selectedDayId],
  )

  const selectedDayCounts = completionCounts[selectedDayId] || { completed: 0, total: 0 }
  const todayName = WEEKDAY_NAMES[new Date().getDay()]
  const todayDate = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  // Encouragement math. Streak comes from workout logs (explicit date), lifetime
  // comes from every completed: true flag across every program.
  const streak = useMemo(() => computeStreak(workoutLogs), [workoutLogs])
  const lifetimeCompleted = useMemo(() => computeLifetimeCompletions(completions), [completions])

  // Milestone crossings become one-time humor toasts. The refs are seeded on
  // first render so page-load doesn't fire a celebration for counts the athlete
  // already had before opening the dashboard.
  const prevLifetimeRef = useRef(null)
  const prevStreakRef = useRef(null)

  // Get the current athlete id once so we can key milestone persistence by
  // user. Anonymous fallback keeps local dev / unauthenticated paths sane.
  const currentUserId = useMemo(() => getCurrentUser()?.id ?? 'anon', [])

  // Fire a milestone at most once per athlete per threshold -- persisting the
  // set in localStorage so unmark/remark (lifetime 1 -> 0 -> 1) can't trigger
  // the same celebration twice.
  const fireMilestoneOnce = (kind, crossed) => {
    if (!crossed) return
    if (hasMilestoneFired(currentUserId, kind, crossed.count)) return
    markMilestoneFired(currentUserId, kind, crossed.count)
    setEncouragement(crossed.message)
    setTimeout(() => setEncouragement(''), 5000)
  }

  useEffect(() => {
    if (loading) return
    if (prevLifetimeRef.current === null) { prevLifetimeRef.current = lifetimeCompleted; return }
    const crossed = crossedCompletionMilestone(prevLifetimeRef.current, lifetimeCompleted)
    prevLifetimeRef.current = lifetimeCompleted
    fireMilestoneOnce('completion', crossed)
  }, [lifetimeCompleted, loading])

  useEffect(() => {
    if (loading) return
    if (prevStreakRef.current === null) { prevStreakRef.current = streak; return }
    const crossed = crossedStreakMilestone(prevStreakRef.current, streak)
    prevStreakRef.current = streak
    fireMilestoneOnce('streak', crossed)
  }, [streak, loading])

  // Persist a single exercise's result. Writes locally (optimistic), then
  // PATCHes to the backend. Two safeguards against rapid-tap data loss:
  //
  //   1. Read from completionsRef, not from the closure-captured state, so
  //      a second save fired in the same render cycle sees the first save's
  //      optimistic update.
  //   2. Chain the PATCH onto saveChainRef so PATCHes are serialized per
  //      the order they were issued. If PATCH N finishes after PATCH N+1,
  //      the server wouldn't otherwise see N+1's work; serializing guarantees
  //      each request lands after the previous response has been applied.
  const handleSaveResult = async (programId, day, dayIndex, exerciseIndex, newResult) => {
    if (!programId) return
    const dayKey = getDayCompletionKey(day, dayIndex)
    const program = programs.find((p) => p.id === programId)

    // Optimistic local update, computed against the freshest state.
    const currentCompletion = completionsRef.current[programId] || { entries: {} }
    const nextEntries = {
      ...(currentCompletion.entries || {}),
      [dayKey]: {
        ...(currentCompletion.entries?.[dayKey] || {}),
        [String(exerciseIndex)]: newResult,
      },
    }
    const nextCompletion = { entries: nextEntries }
    completionsRef.current = { ...completionsRef.current, [programId]: nextCompletion }
    setCompletions(completionsRef.current)

    setSaving(true)
    const exName = program?.program_data?.days?.[dayIndex]?.exercises?.[exerciseIndex]?.name || 'Exercise'

    // Reference identity of the optimistic state at submit time. If a later
    // save has replaced completionsRef.current[programId] before the response
    // arrives, we leave local state alone so we don't overwrite newer work
    // with stale server data.
    const submittedSnapshot = completionsRef.current[programId]

    // Streak is derived from workoutLogs, so marking an exercise done without
    // also logging a workout means the athlete's streak silently breaks even
    // though they trained. On the first completed=true of today, auto-POST a
    // minimal workout log so the streak stays true to behavior. No-ops if a
    // log for today already exists, or if we're merely unmarking done.
    const shouldAutoLogToday = newResult.completed && !workoutLogs.some(
      (log) => String(log.date).slice(0, 10) === new Date().toISOString().slice(0, 10),
    )

    // Queue the PATCH behind any in-flight save so responses can't arrive
    // out of order relative to their requests.
    saveChainRef.current = saveChainRef.current
      .catch(() => {}) // don't let a prior failure stop this save
      .then(async () => {
        try {
          const response = await updateProgramCompletion(programId, nextCompletion)
          if (completionsRef.current[programId] === submittedSnapshot) {
            completionsRef.current = { ...completionsRef.current, [programId]: response.completion_data }
            setCompletions(completionsRef.current)
          }
          if (shouldAutoLogToday) {
            try {
              const created = await createWorkoutLog({
                date: new Date().toISOString().slice(0, 10),
                notes: '',
              })
              setWorkoutLogs((prev) => [created, ...prev])
            } catch (e) {
              // Don't fail the save just because the auto-log write failed.
              console.warn('auto-log skipped:', e?.message)
            }
          }
          setSaveMessage(newResult.completed ? `Logged — ${exName}` : `Updated — ${exName}`)
          setTimeout(() => setSaveMessage(''), 2200)
        } catch (error) {
          console.error('Error saving exercise result:', error)
          setSaveMessage(formatApiError(error, 'Could not save result.'))
        }
      })

    try {
      await saveChainRef.current
    } finally {
      setSaving(false)
    }
  }

  const handleWorkoutSave = async () => {
    try {
      setSaving(true)
      await createWorkoutLog({ date: logForm.date, notes: logForm.notes })
      setLogForm((current) => ({ ...current, notes: '' }))
      await loadDashboardData()
      setSaveMessage('Workout log saved.')
      setTimeout(() => setSaveMessage(''), 2500)
      setDrawerSection(null)
    } catch (error) {
      console.error('Error saving workout log:', error)
      setSaveMessage(formatApiError(error, 'Could not save workout log.'))
    } finally {
      setSaving(false)
    }
  }

  const handlePrSave = async () => {
    if (!prForm.weight) {
      setSaveMessage('Enter a PR weight before saving.')
      return
    }
    try {
      setSaving(true)
      await createPersonalRecord(prForm)
      setPrForm((current) => ({ ...current, weight: '' }))
      await loadDashboardData()
      setSaveMessage('Personal record saved.')
      setTimeout(() => setSaveMessage(''), 2500)
      setDrawerSection(null)
    } catch (error) {
      console.error('Error saving personal record:', error)
      setSaveMessage(formatApiError(error, 'Could not save PR.'))
    } finally {
      setSaving(false)
    }
  }

  const handleSinclairSubmit = async () => {
    if (!sinclairForm.bodyweight_kg || !sinclairForm.total_kg) {
      setSaveMessage('Enter both bodyweight and total.')
      return
    }
    try {
      setSinclairLoading(true)
      const result = await calculateSinclair({
        bodyweight_kg: Number(sinclairForm.bodyweight_kg),
        total_kg: Number(sinclairForm.total_kg),
        gender: sinclairForm.gender,
      })
      setSinclairResult(result)
      setSaveMessage('Sinclair calculated.')
      setTimeout(() => setSaveMessage(''), 2000)
    } catch (error) {
      console.error('Error calculating Sinclair:', error)
      setSaveMessage('Could not calculate Sinclair. Check inputs.')
    } finally {
      setSinclairLoading(false)
    }
  }

  const workoutFrequencyChart = useMemo(() => {
    const grouped = workoutLogs.reduce((acc, log) => {
      const bucket = getWeekBucket(log.date)
      acc[bucket] = (acc[bucket] || 0) + 1
      return acc
    }, {})
    const labels = Object.keys(grouped).sort()
    return {
      labels,
      datasets: [{
        label: 'Workouts per week',
        data: labels.map((l) => grouped[l]),
        backgroundColor: 'rgba(95, 228, 255, 0.5)',
        borderColor: 'rgba(95, 228, 255, 0.95)',
        borderWidth: 1,
        borderRadius: 4,
      }],
    }
  }, [workoutLogs])

  const prHistoryChart = useMemo(() => {
    const sorted = [...personalRecords].sort((a, b) => a.date.localeCompare(b.date))
    const labels = sorted.map((r) => r.date)
    return {
      labels,
      datasets: ['snatch', 'clean_jerk', 'total'].map((lift, i) => ({
        label: liftLabels[lift],
        data: sorted.map((r) => (r.lift_type === lift ? Number(r.weight) : null)),
        borderColor: ['#5fe4ff', '#36f0c5', '#ffb23f'][i],
        backgroundColor: ['rgba(95,228,255,0.14)', 'rgba(54,240,197,0.14)', 'rgba(255,178,63,0.14)'][i],
        pointBackgroundColor: ['#a5ecff', '#7ff7dd', '#ffd489'][i],
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.28,
        spanGaps: true,
      })),
    }
  }, [personalRecords])

  const sharedChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#f4f7fb', usePointStyle: true, boxWidth: 10, padding: 14, font: { size: 11, family: 'Inter, sans-serif' } } },
      tooltip: { backgroundColor: 'rgba(4, 10, 20, 0.96)', titleColor: '#f4f7fb', bodyColor: '#c9d6e3', borderColor: 'rgba(95,228,255,0.28)', borderWidth: 1, padding: 10, cornerRadius: 6 },
    },
    scales: {
      x: { ticks: { color: chartTickColor }, grid: { color: chartGridColor }, border: { color: chartBorderColor } },
      y: { beginAtZero: true, ticks: { color: chartTickColor }, grid: { color: chartGridColor }, border: { color: chartBorderColor } },
    },
  }), [])

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading athlete workspace…</div>
      </div>
    )
  }

  if (!activeProgram) {
    return (
      <div className="dashboard-container athlete-dashboard">
        <div className="dashboard-header">
          <div className="dashboard-kicker">Athlete</div>
          <h1>No program yet.</h1>
          <p className="dashboard-description">
            Your coach hasn't assigned a program. Check back after they build one for you.
          </p>
        </div>
      </div>
    )
  }

  const programsAssigned = programs.length

  return (
    <div className="dashboard-container athlete-dashboard">
      <div className="athlete-hero">
        <div className="dashboard-kicker-row">
          <span className="dashboard-kicker">Athlete · {activeProgram.athlete_username}</span>
          {saving && <span className="status-pill">Saving…</span>}
        </div>
        <h1 className="athlete-hero-title">
          {todayName}, {todayDate}
        </h1>
        <p className="athlete-hero-meta">
          <span className="data">{selectedDayCounts.completed}</span> of{' '}
          <span className="data">{selectedDayCounts.total}</span>
          {' exercises done on '}
          <span className="athlete-hero-dayname">{selectedDay?.day || '—'}</span>
        </p>
        {(streak > 0 || lifetimeCompleted > 0) && (
          <div className="athlete-hero-stats" aria-label="Athlete streak and lifetime completions">
            {streak > 0 && (
              <span className="athlete-hero-stat">
                <span className="athlete-hero-stat-label">Streak</span>
                <span className="athlete-hero-stat-value data">{streak}</span>
                <span className="athlete-hero-stat-unit">day{streak === 1 ? '' : 's'}</span>
              </span>
            )}
            {lifetimeCompleted > 0 && (
              <span className="athlete-hero-stat">
                <span className="athlete-hero-stat-label">Lifetime</span>
                <span className="athlete-hero-stat-value data">{lifetimeCompleted}</span>
                <span className="athlete-hero-stat-unit">lifts logged</span>
              </span>
            )}
          </div>
        )}
        {saveMessage && (
          <div className={`save-message ${saveMessage.toLowerCase().includes('error') || saveMessage.toLowerCase().includes('could') ? 'error' : 'success'}`}>
            {saveMessage}
          </div>
        )}
        {encouragement && (
          <div className="encouragement-toast" role="status" aria-live="polite">
            <span className="encouragement-toast-kicker">Milestone</span>
            <span className="encouragement-toast-body">{encouragement}</span>
          </div>
        )}
      </div>

      {programsAssigned > 1 && (
        <div className="program-chip-row" role="tablist" aria-label="Programs">
          {programs.map((program) => (
            <button
              key={program.id}
              type="button"
              role="tab"
              aria-selected={program.id === activeProgram.id}
              className={`program-chip ${program.id === activeProgram.id ? 'is-active' : ''}`}
              onClick={() => { setActiveProgramId(program.id); setSelectedDayId(null) }}
            >
              {program.name}
            </button>
          ))}
        </div>
      )}

      <WeekStrip
        days={activeProgramNormalized.days}
        completionCounts={completionCounts}
        selectedDayId={selectedDayId}
        onSelectDay={setSelectedDayId}
      />

      <section className="athlete-day-section">
        <h2 className="athlete-day-title">{selectedDay?.day || 'Day'}</h2>

        {(selectedDay?.exercises || []).length === 0 ? (
          <div className="empty-inline">Nothing programmed for this day — rest or accessory work.</div>
        ) : (
          <div className="athlete-exercise-list">
            {selectedDay.exercises.map((exercise, exerciseIndex) => {
              const dayKey = getDayCompletionKey(selectedDay, 0 /* idx unused once id exists */)
              const entryBag = activeCompletionEntries[dayKey] || activeCompletionEntries[selectedDay.id] || {}
              const result = entryBag[String(exerciseIndex)] || { completed: false, result: '', athlete_notes: '' }
              // Resolve the source day's original index on the program (needed
              // by the save handler's legacy fallback key).
              const originalDayIndex = activeProgramNormalized.days.findIndex((d) => d.id === selectedDay.id)
              return (
                <AthleteExerciseCard
                  key={`${selectedDay.id}-${exerciseIndex}`}
                  exercise={exercise}
                  result={result}
                  onSaveResult={(newResult) => handleSaveResult(activeProgram.id, selectedDay, originalDayIndex, exerciseIndex, newResult)}
                />
              )
            })}
          </div>
        )}
      </section>

      <div className="athlete-bottom-bar">
        <button
          type="button"
          className={`athlete-bottom-btn ${drawerSection === 'workout' ? 'is-active' : ''}`}
          onClick={() => setDrawerSection(drawerSection === 'workout' ? null : 'workout')}
        >
          + Log workout
        </button>
        <button
          type="button"
          className={`athlete-bottom-btn ${drawerSection === 'pr' ? 'is-active' : ''}`}
          onClick={() => setDrawerSection(drawerSection === 'pr' ? null : 'pr')}
        >
          + Log PR
        </button>
        <button
          type="button"
          className={`athlete-bottom-btn ${drawerSection === 'stats' ? 'is-active' : ''}`}
          onClick={() => setDrawerSection(drawerSection === 'stats' ? null : 'stats')}
        >
          Stats &amp; tools
        </button>
      </div>

      {drawerSection === 'workout' && (
        <section className="athlete-drawer section-card">
          <h3>Log workout</h3>
          <label className="field-stacked">
            <span>Date</span>
            <input type="date" className="form-input" value={logForm.date} onChange={(e) => setLogForm((c) => ({ ...c, date: e.target.value }))} />
          </label>
          <label className="field-stacked">
            <span>Notes</span>
            <textarea rows="2" className="notes-textarea" placeholder="how did it go"
                      value={logForm.notes} onChange={(e) => setLogForm((c) => ({ ...c, notes: e.target.value }))} />
          </label>
          <div className="athlete-drawer-actions">
            <button type="button" className="text-btn" onClick={() => setDrawerSection(null)}>Cancel</button>
            <button type="button" className="save-btn" onClick={handleWorkoutSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save log'}
            </button>
          </div>
          {workoutLogs.length > 0 && (
            <div className="athlete-drawer-history">
              <h4>Recent</h4>
              <ul>
                {workoutLogs.slice(0, 8).map((log) => (
                  <li key={log.id}>
                    <span className="data">{log.date}</span>
                    {log.notes && <span> — {log.notes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {drawerSection === 'pr' && (
        <section className="athlete-drawer section-card">
          <h3>Log PR</h3>
          <div className="form-grid compact-grid">
            <label className="field-stacked">
              <span>Lift</span>
              <select className="form-input" value={prForm.lift_type}
                      onChange={(e) => setPrForm((c) => ({ ...c, lift_type: e.target.value }))}>
                <option value="snatch">Snatch</option>
                <option value="clean_jerk">Clean &amp; Jerk</option>
                <option value="total">Total</option>
              </select>
            </label>
            <label className="field-stacked">
              <span>Weight (kg)</span>
              <input type="number" inputMode="decimal" className="form-input data" value={prForm.weight}
                     onChange={(e) => setPrForm((c) => ({ ...c, weight: e.target.value }))} />
            </label>
            <label className="field-stacked">
              <span>Date</span>
              <input type="date" className="form-input" value={prForm.date}
                     onChange={(e) => setPrForm((c) => ({ ...c, date: e.target.value }))} />
            </label>
          </div>
          <div className="athlete-drawer-actions">
            <button type="button" className="text-btn" onClick={() => setDrawerSection(null)}>Cancel</button>
            <button type="button" className="save-btn" onClick={handlePrSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save PR'}
            </button>
          </div>
          {personalRecords.length > 0 && (
            <div className="athlete-drawer-history">
              <h4>Recent PRs</h4>
              <ul>
                {personalRecords.slice(0, 8).map((record) => (
                  <li key={record.id}>
                    <span className="data">{record.weight}kg</span>{' '}
                    {liftLabels[record.lift_type] || record.lift_type}{' · '}
                    <span>{record.date}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {drawerSection === 'stats' && (
        <section className="athlete-drawer section-card">
          <h3>Stats &amp; tools</h3>

          <div className="athlete-drawer-stats-grid">
            <div className="chart-card">
              <h4>PR history</h4>
              {personalRecords.length === 0 ? (
                <div className="chart-empty">Log a PR to see your trend.</div>
              ) : (
                <Line data={prHistoryChart} options={sharedChartOptions} />
              )}
            </div>
            <div className="chart-card">
              <h4>Workouts per week</h4>
              {workoutLogs.length === 0 ? (
                <div className="chart-empty">Log a workout to see your cadence.</div>
              ) : (
                <Bar data={workoutFrequencyChart} options={sharedChartOptions} />
              )}
            </div>
          </div>

          <h4 className="athlete-drawer-subhead">Sinclair calculator</h4>
          <div className="form-grid compact-grid">
            <label className="field-stacked">
              <span>Bodyweight (kg)</span>
              <input type="number" inputMode="decimal" className="form-input data" value={sinclairForm.bodyweight_kg}
                     onChange={(e) => setSinclairForm((c) => ({ ...c, bodyweight_kg: e.target.value }))} />
            </label>
            <label className="field-stacked">
              <span>Total (kg)</span>
              <input type="number" inputMode="decimal" className="form-input data" value={sinclairForm.total_kg}
                     onChange={(e) => setSinclairForm((c) => ({ ...c, total_kg: e.target.value }))} />
            </label>
            <label className="field-stacked">
              <span>Gender</span>
              <select className="form-input" value={sinclairForm.gender}
                      onChange={(e) => setSinclairForm((c) => ({ ...c, gender: e.target.value }))}>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </label>
          </div>
          <div className="athlete-drawer-actions">
            <button type="button" className="save-btn" onClick={handleSinclairSubmit} disabled={sinclairLoading}>
              {sinclairLoading ? 'Calculating…' : 'Calculate Sinclair'}
            </button>
          </div>
          {sinclairResult && (
            <div className="sinclair-result">
              <span>Sinclair total: <span className="data">{sinclairResult.sinclair_total}</span></span>
              <span>Coefficient: <span className="data">{sinclairResult.coefficient}</span></span>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default AthleteDashboard
