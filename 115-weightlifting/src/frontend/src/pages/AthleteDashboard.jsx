import { useEffect, useMemo, useState } from 'react'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import WorkoutDay from '../components/WorkoutDay'
import {
  calculateSinclair,
  createPersonalRecord,
  createWorkoutLog,
  getPersonalRecords,
  getProgramsFromBackend,
  getWorkoutLogs,
  updateProgramCompletion
} from '../services/api'
import { getDayCompletionKey, normalizeProgramData, readDayCompletion } from '../utils/dataStructure'
import { formatApiError } from '../utils/errors'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)

const chartTickColor = '#b3d4ee'
const chartGridColor = 'rgba(167, 139, 250, 0.14)'
const chartBorderColor = 'rgba(82, 216, 255, 0.34)'

const liftLabels = {
  snatch: 'Snatch',
  clean_jerk: 'Clean & Jerk',
  total: 'Total'
}

const getWeekBucket = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day)
  return date.toISOString().split('T')[0]
}

const AthleteDashboard = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completionSavingId, setCompletionSavingId] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [programs, setPrograms] = useState([])
  const [completions, setCompletions] = useState({})
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [personalRecords, setPersonalRecords] = useState([])
  const [logForm, setLogForm] = useState({
    date: new Date().toISOString().split('T')[0],
    notes: ''
  })
  const [prForm, setPrForm] = useState({
    lift_type: 'snatch',
    weight: '',
    date: new Date().toISOString().split('T')[0]
  })
  const [sinclairForm, setSinclairForm] = useState({
    bodyweight_kg: '',
    total_kg: '',
    gender: 'M'
  })
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
        getPersonalRecords()
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
    } catch (error) {
      console.error('Error loading athlete dashboard:', error)
      setSaveMessage(formatApiError(error, 'Could not load dashboard data.'))
    } finally {
      setLoading(false)
    }
  }

  const workoutFrequencyChart = useMemo(() => {
    const grouped = workoutLogs.reduce((accumulator, log) => {
      const bucket = getWeekBucket(log.date)
      accumulator[bucket] = (accumulator[bucket] || 0) + 1
      return accumulator
    }, {})

    const labels = Object.keys(grouped).sort()
    return {
      labels,
      datasets: [
        {
          label: 'Workout logs per week',
          data: labels.map((label) => grouped[label]),
          backgroundColor: 'rgba(82, 216, 255, 0.56)',
          borderColor: 'rgba(82, 216, 255, 0.96)',
          borderWidth: 1,
          borderRadius: 4,
          hoverBackgroundColor: 'rgba(139, 233, 255, 0.72)',
          hoverBorderColor: 'rgba(139, 233, 255, 1)'
        }
      ]
    }
  }, [workoutLogs])

  const prHistoryChart = useMemo(() => {
    const sortedRecords = [...personalRecords].sort((left, right) => left.date.localeCompare(right.date))
    const labels = sortedRecords.map((record) => record.date)

    return {
      labels,
      datasets: ['snatch', 'clean_jerk', 'total'].map((liftType, index) => ({
        label: liftLabels[liftType],
        data: sortedRecords.map((record) => record.lift_type === liftType ? Number(record.weight) : null),
        borderColor: ['#52d8ff', '#36f0c5', '#a78bfa'][index],
        backgroundColor: ['rgba(82, 216, 255, 0.16)', 'rgba(54, 240, 197, 0.16)', 'rgba(167, 139, 250, 0.18)'][index],
        pointBackgroundColor: ['#8be9ff', '#7ff7dd', '#d4c6ff'][index],
        pointBorderColor: '#08111d',
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.28,
        spanGaps: true
      }))
    }
  }, [personalRecords])

  const sharedChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#e6f7ff',
          usePointStyle: true,
          boxWidth: 10,
          padding: 16,
          font: {
            size: 11,
            family: 'Inter, sans-serif'
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(4, 10, 20, 0.96)',
        titleColor: '#f6fbff',
        bodyColor: '#d8e7f5',
        borderColor: 'rgba(167, 139, 250, 0.28)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10
      }
    },
    scales: {
      x: {
        ticks: { color: chartTickColor },
        grid: { color: chartGridColor },
        border: { color: chartBorderColor }
      },
      y: {
        beginAtZero: true,
        ticks: { color: chartTickColor },
        grid: { color: chartGridColor },
        border: { color: chartBorderColor }
      }
    }
  }), [])

  const handleProgramResultChange = (programId, day, dayIndex, exerciseIndex, field, value) => {
    // Key by the day's stable id so reordering days on the coach side does
    // not remap the athlete's prior completion to the wrong day.
    const dayKey = getDayCompletionKey(day, dayIndex)
    setCompletions((current) => {
      const currentProgramData = current[programId] || { entries: {} }
      // Pick up legacy index-keyed entries once, then always write under dayKey.
      const currentDayData =
        currentProgramData.entries?.[dayKey] ||
        currentProgramData.entries?.[String(dayIndex)] ||
        {}
      const currentExerciseData = currentDayData[String(exerciseIndex)] || {
        completed: false,
        athlete_notes: '',
        result: '',
      }

      return {
        ...current,
        [programId]: {
          entries: {
            ...currentProgramData.entries,
            [dayKey]: {
              ...currentDayData,
              [String(exerciseIndex)]: {
                ...currentExerciseData,
                [field]: value,
              },
            },
          },
        },
      }
    })
  }

  const saveProgramProgress = async (programId) => {
    try {
      setCompletionSavingId(programId)
      const response = await updateProgramCompletion(programId, completions[programId] || { entries: {} })
      setCompletions((current) => ({
        ...current,
        [programId]: response.completion_data
      }))
      setSaveMessage('Program completion saved.')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error saving program completion:', error)
      setSaveMessage(formatApiError(error, 'Error saving program completion. Please try again.'))
    } finally {
      setCompletionSavingId(null)
    }
  }

  const handleWorkoutSave = async () => {
    try {
      setSaving(true)
      setSaveMessage('')
      await createWorkoutLog({
        date: logForm.date,
        notes: logForm.notes
      })
      setLogForm((current) => ({ ...current, notes: '' }))
      await loadDashboardData()
      setSaveMessage('Workout log saved successfully.')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error saving workout log:', error)
      setSaveMessage(formatApiError(error, 'Error saving workout log. Please try again.'))
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
      setSaveMessage('')
      await createPersonalRecord(prForm)
      setPrForm((current) => ({ ...current, weight: '' }))
      await loadDashboardData()
      setSaveMessage('Personal record saved successfully.')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error saving personal record:', error)
      setSaveMessage(formatApiError(error, 'Error saving personal record. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const handleSinclairSubmit = async () => {
    if (!sinclairForm.bodyweight_kg || !sinclairForm.total_kg) {
      setSaveMessage('Enter both bodyweight and total to calculate Sinclair.')
      return
    }

    try {
      setSinclairLoading(true)
      const result = await calculateSinclair({
        bodyweight_kg: Number(sinclairForm.bodyweight_kg),
        total_kg: Number(sinclairForm.total_kg),
        gender: sinclairForm.gender
      })
      setSinclairResult(result)
      setSaveMessage('Sinclair score calculated successfully.')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error calculating Sinclair score:', error)
      setSaveMessage('Error calculating Sinclair score. Please verify your inputs.')
    } finally {
      setSinclairLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading athlete workspace...</div>
      </div>
    )
  }

  return (
    <div className="dashboard-container athlete-dashboard">
      <div className="dashboard-header">
        <div className="dashboard-kicker-row">
          <span className="dashboard-kicker">Athlete execution view</span>
          <span className="status-pill">Progress tracking live</span>
        </div>
        <h1>Athlete Dashboard</h1>
        <p className="dashboard-description">
          Work through your assigned prescription, save actual results per exercise, and track progress across logs, PRs, and Sinclair scoring.
        </p>
        <div className="summary-grid">
          <div className="detail-item">
            <span className="label">Assigned programs</span>
            <span className="value">{programs.length}</span>
          </div>
          <div className="detail-item">
            <span className="label">Workout logs</span>
            <span className="value">{workoutLogs.length}</span>
          </div>
          <div className="detail-item">
            <span className="label">PR entries</span>
            <span className="value">{personalRecords.length}</span>
          </div>
        </div>
        {saveMessage && (
          <div className={`save-message ${saveMessage.includes('Error') || saveMessage.includes('Could not') ? 'error' : 'success'}`}>
            {saveMessage}
          </div>
        )}
      </div>

      <div className="program-content">
        <div className="section-title-row">
          <h3>Assigned Programs</h3>
          <span className="section-subtitle">Save exercise-by-exercise completion against your current program.</span>
        </div>

        {programs.length === 0 ? (
          <div className="section-card empty-inline">No program assigned yet.</div>
        ) : (
          programs.map((program) => {
            const normalizedProgram = normalizeProgramData(program.program_data, program.start_date)
            const completionData = completions[program.id] || { entries: {} }
            return (
              <div key={program.id} className="section-card section-stack">
                <div className="exercise-header">
                  <div>
                    <h4>{program.name}</h4>
                    <p>{program.description || 'No description provided.'}</p>
                  </div>
                  <div className="detail-chip-group">
                    <span className="completion-chip">Start {program.start_date}</span>
                    <span className="completion-chip">End {program.end_date || 'n/a'}</span>
                  </div>
                </div>
                {normalizedProgram.days.map((day, dayIndex) => (
                  <WorkoutDay
                    key={`${program.id}-${dayIndex}`}
                    day={day}
                    dayIndex={dayIndex}
                    exercises={day.exercises}
                    athleteResults={readDayCompletion(completionData, day, dayIndex)}
                    onResultChange={(exerciseIndex, field, value) => handleProgramResultChange(program.id, day, dayIndex, exerciseIndex, field, value)}
                  />
                ))}
                <div className="completion-actions">
                  <button
                    type="button"
                    className="save-btn"
                    onClick={() => saveProgramProgress(program.id)}
                    disabled={completionSavingId === program.id}
                  >
                    {completionSavingId === program.id ? 'Saving...' : 'Save Program Progress'}
                  </button>
                </div>
              </div>
            )
          })
        )}

        <div className="section-title-row">
          <h3>Performance Dashboard</h3>
          <span className="section-subtitle">Charts are built from your saved workout logs and PR entries.</span>
        </div>
        <div className="chart-grid">
          <div className="section-card chart-card">
            <h4>PR History by Lift</h4>
            {personalRecords.length === 0 ? (
              <div className="chart-empty">Add PR entries to populate this chart.</div>
            ) : (
              <Line data={prHistoryChart} options={sharedChartOptions} />
            )}
          </div>
          <div className="section-card chart-card">
            <h4>Workout Frequency</h4>
            {workoutLogs.length === 0 ? (
              <div className="chart-empty">Add workout logs to populate weekly frequency.</div>
            ) : (
              <Bar data={workoutFrequencyChart} options={sharedChartOptions} />
            )}
          </div>
        </div>

        <div className="section-title-row">
          <h3>Sinclair Calculator</h3>
          <span className="section-subtitle">Enter meet bodyweight and total for a quick Sinclair score.</span>
        </div>
        <div className="section-card">
          <div className="form-row">
            <input
              type="number"
              className="form-input"
              placeholder="Bodyweight (kg)"
              value={sinclairForm.bodyweight_kg}
              onChange={(event) => setSinclairForm((current) => ({ ...current, bodyweight_kg: event.target.value }))}
            />
            <input
              type="number"
              className="form-input"
              placeholder="Total (kg)"
              value={sinclairForm.total_kg}
              onChange={(event) => setSinclairForm((current) => ({ ...current, total_kg: event.target.value }))}
            />
            <select
              className="form-input"
              value={sinclairForm.gender}
              onChange={(event) => setSinclairForm((current) => ({ ...current, gender: event.target.value }))}
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
          <div className="completion-actions">
            <button type="button" className="save-btn" onClick={handleSinclairSubmit} disabled={sinclairLoading}>
              {sinclairLoading ? 'Calculating...' : 'Calculate Sinclair'}
            </button>
          </div>
          {sinclairResult && (
            <div className="summary-grid">
              <div className="detail-item">
                <span className="label">Coefficient</span>
                <span className="value">{sinclairResult.coefficient}</span>
              </div>
              <div className="detail-item">
                <span className="label">Sinclair total</span>
                <span className="value">{sinclairResult.sinclair_total}</span>
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-grid">
          <div className="section-card section-stack">
            <div className="section-title-row">
              <h3>Workout Log</h3>
              <span className="section-subtitle">Supplementary session notes outside the prescribed checklist.</span>
            </div>
            <input
              type="date"
              className="form-input"
              value={logForm.date}
              onChange={(event) => setLogForm((current) => ({ ...current, date: event.target.value }))}
            />
            <textarea
              className="notes-textarea"
              rows="4"
              placeholder="Workout notes, observations, and session summary"
              value={logForm.notes}
              onChange={(event) => setLogForm((current) => ({ ...current, notes: event.target.value }))}
            />
            <button type="button" onClick={handleWorkoutSave} disabled={saving || !logForm.notes} className="save-btn">
              {saving ? 'Saving...' : 'Save Workout Log'}
            </button>
            {workoutLogs.length === 0 ? (
              <div className="empty-inline">No workout logs yet.</div>
            ) : workoutLogs.map((log) => (
              <div key={log.id} className="exercise-card">
                <div className="exercise-header">
                  <h4>{log.date}</h4>
                </div>
                <p>{log.notes}</p>
              </div>
            ))}
          </div>

          <div className="section-card section-stack">
            <div className="section-title-row">
              <h3>Personal Records</h3>
              <span className="section-subtitle">Track lift milestones over time.</span>
            </div>
            <div className="form-row">
              <select
                className="form-input"
                value={prForm.lift_type}
                onChange={(event) => setPrForm((current) => ({ ...current, lift_type: event.target.value }))}
              >
                <option value="snatch">Snatch</option>
                <option value="clean_jerk">Clean &amp; Jerk</option>
                <option value="total">Total</option>
              </select>
              <input
                type="number"
                className="form-input"
                placeholder="Weight (kg)"
                value={prForm.weight}
                onChange={(event) => setPrForm((current) => ({ ...current, weight: event.target.value }))}
              />
              <input
                type="date"
                className="form-input"
                value={prForm.date}
                onChange={(event) => setPrForm((current) => ({ ...current, date: event.target.value }))}
              />
            </div>
            <button type="button" onClick={handlePrSave} disabled={saving} className="save-btn">
              {saving ? 'Saving...' : 'Save PR'}
            </button>
            {personalRecords.length === 0 ? (
              <div className="empty-inline">No PR entries yet.</div>
            ) : personalRecords.map((record) => (
              <div key={record.id} className="exercise-card">
                <div className="exercise-header">
                  <h4>{liftLabels[record.lift_type]}</h4>
                  <span>{record.weight} kg</span>
                </div>
                <p>Date: {record.date}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AthleteDashboard
