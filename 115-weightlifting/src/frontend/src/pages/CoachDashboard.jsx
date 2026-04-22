import { useEffect, useMemo, useRef, useState } from 'react'
import WorkoutDay from '../components/WorkoutDay'
import SpreadsheetEditor from '../components/SpreadsheetEditor'
import { assignProgram, createProgram, getAthletes, getProgramsFromBackend, updateProgram } from '../services/api'
import { countExercises, createEmptyDay, createEmptyWeek, normalizeProgramData } from '../utils/dataStructure'
import { formatApiError } from '../utils/errors'
import { downloadTemplateXlsx, parseProgramFile } from '../utils/programTemplate'

const getDefaultForm = () => ({
  name: '',
  description: '',
  athlete_id: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: ''
})

const CoachDashboard = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [apiError, setApiError] = useState(null)
  const [programs, setPrograms] = useState([])
  const [athletes, setAthletes] = useState([])
  const [athleteSearch, setAthleteSearch] = useState('')
  const [athleteTotal, setAthleteTotal] = useState(0)
  const [editingProgramId, setEditingProgramId] = useState(null)
  const [assignmentDrafts, setAssignmentDrafts] = useState({})
  const [formData, setFormData] = useState(getDefaultForm())
  const [programData, setProgramData] = useState(createEmptyWeek())
  const [editorMode, setEditorMode] = useState('form') // 'form' | 'spreadsheet'
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      refreshAthletes(athleteSearch)
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteSearch])

  const upcomingSummary = useMemo(() => ({
    dayCount: programData.days.length,
    exerciseCount: countExercises(programData)
  }), [programData])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const programDataResponse = await getProgramsFromBackend()
      setPrograms(programDataResponse)
      await refreshAthletes(athleteSearch)
      setApiError(null)
    } catch (error) {
      console.error('Error loading coach dashboard:', error)
      setApiError(formatApiError(error, 'Could not load dashboard.'))
    } finally {
      setLoading(false)
    }
  }

  const refreshAthletes = async (term = '') => {
    try {
      const { results, count } = await getAthletes({ scope: 'all', q: term })
      setAthletes(results)
      setAthleteTotal(count ?? results.length)
    } catch (error) {
      console.error('Error fetching athletes:', error)
    }
  }

  const resetEditor = () => {
    const freshForm = getDefaultForm()
    setEditingProgramId(null)
    setFormData(freshForm)
    setProgramData(createEmptyWeek(freshForm.start_date))
  }

  const handleFormChange = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    if (field === 'start_date') {
      setProgramData((current) => ({ ...current, week_start_date: value }))
    }
  }

  const handleDayChange = (dayIndex, nextDayName) => {
    setProgramData((current) => ({
      ...current,
      days: current.days.map((day, index) => index === dayIndex ? { ...day, day: nextDayName } : day)
    }))
  }

  const handleExercisesChange = (dayIndex, nextExercises) => {
    setProgramData((current) => ({
      ...current,
      days: current.days.map((day, index) => index === dayIndex ? { ...day, exercises: nextExercises } : day)
    }))
  }

  const handleAddDay = () => {
    setProgramData((current) => ({
      ...current,
      days: [...current.days, createEmptyDay(`Day ${current.days.length + 1}`)]
    }))
  }

  const handleRemoveDay = (dayIndex) => {
    setProgramData((current) => ({
      ...current,
      days: current.days.filter((_, index) => index !== dayIndex)
    }))
  }

  const handleDownloadTemplate = () => {
    downloadTemplateXlsx()
    setSaveMessage('Template downloaded. Fill it in and re-upload to autofill a new program.')
    setTimeout(() => setSaveMessage(''), 4000)
  }

  const handleTemplateUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleTemplateFileChosen = async (event) => {
    const file = event.target.files?.[0]
    // Reset the input so re-uploading the same filename still triggers change.
    event.target.value = ''
    if (!file) return
    try {
      setSaveMessage('')
      const nextProgramData = await parseProgramFile(file)
      setProgramData(nextProgramData)
      const exercises = nextProgramData.days.reduce((t, d) => t + d.exercises.length, 0)
      setSaveMessage(
        `Loaded ${nextProgramData.days.length} day(s) / ${exercises} exercise(s) from ${file.name}. Review and hit Create Program.`
      )
      setTimeout(() => setSaveMessage(''), 6000)
    } catch (error) {
      console.error('Template upload failed:', error)
      setSaveMessage(`Could not read ${file.name}: ${error.message || 'unknown error'}`)
    }
  }

  const toggleEditorMode = () => {
    setEditorMode((current) => (current === 'form' ? 'spreadsheet' : 'form'))
  }

  const handleEditProgram = (program) => {
    setEditingProgramId(program.id)
    setFormData({
      name: program.name,
      description: program.description || '',
      athlete_id: String(program.athlete_id || ''),
      start_date: program.start_date,
      end_date: program.end_date || ''
    })
    setProgramData(normalizeProgramData(program.program_data, program.start_date))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async () => {
    if (!formData.name || !formData.athlete_id) {
      setSaveMessage('Program name and athlete assignment are required.')
      return
    }

    const payload = {
      ...formData,
      athlete_id: Number(formData.athlete_id),
      end_date: formData.end_date || null,
      program_data: {
        ...programData,
        week_start_date: formData.start_date
      }
    }

    try {
      setSaving(true)
      setSaveMessage('')
      if (editingProgramId) {
        await updateProgram(editingProgramId, payload)
        setSaveMessage('Program updated successfully.')
      } else {
        await createProgram(payload)
        setSaveMessage('Program created successfully.')
      }
      resetEditor()
      await loadDashboardData()
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error saving program:', error)
      setSaveMessage(formatApiError(error, 'Error saving program. Check the fields and try again.'))
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = async (programId) => {
    const athleteId = assignmentDrafts[programId]
    if (!athleteId) {
      setSaveMessage('Select an athlete before reassigning the program.')
      return
    }

    try {
      await assignProgram(programId, Number(athleteId))
      setSaveMessage('Program reassigned successfully.')
      await loadDashboardData()
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error reassigning program:', error)
      setSaveMessage(formatApiError(error, 'Error reassigning program. Please try again.'))
    }
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading coach workspace...</div>
      </div>
    )
  }

  return (
    <div className="dashboard-container coach-dashboard">
      <div className="api-status">
        {apiError ? <span className="api-error">API: {apiError}</span> : <span className="api-ok">Programs from API: {programs.length}</span>}
      </div>

      <div className="dashboard-header">
        <div className="dashboard-kicker-row">
          <span className="dashboard-kicker">Coach command surface</span>
          <span className="status-pill">Structured programming active</span>
        </div>
        <h1>Coach Dashboard</h1>
        <p className="dashboard-description">
          Build structured weekly plans with real exercise prescription data, then assign or revise them for each athlete.
        </p>
        <div className="summary-grid">
          <div className="detail-item">
            <span className="label">Days in draft</span>
            <span className="value">{upcomingSummary.dayCount}</span>
          </div>
          <div className="detail-item">
            <span className="label">Exercises in draft</span>
            <span className="value">{upcomingSummary.exerciseCount}</span>
          </div>
          <div className="detail-item">
            <span className="label">Assigned athletes</span>
            <span className="value">{athletes.length}</span>
          </div>
        </div>
        {saveMessage && (
          <div className={`save-message ${saveMessage.includes('Error') ? 'error' : 'success'}`}>
            {saveMessage}
          </div>
        )}
      </div>

      <div className="program-content">
        <div className="section-card">
          <div className="section-title-row">
            <h3>{editingProgramId ? 'Edit Program' : 'Create Program'}</h3>
            {editingProgramId && <button type="button" className="text-btn" onClick={resetEditor}>Start new draft</button>}
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder="Program name"
              value={formData.name}
              onChange={(event) => handleFormChange('name', event.target.value)}
              className="exercise-input"
            />
            <input
              type="search"
              placeholder={`Filter athletes (${athleteTotal} total)`}
              value={athleteSearch}
              onChange={(event) => setAthleteSearch(event.target.value)}
              className="form-input"
              aria-label="Search athletes"
            />
            <select
              value={formData.athlete_id}
              onChange={(event) => handleFormChange('athlete_id', event.target.value)}
              className="form-input"
            >
              <option value="">Select athlete</option>
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>{athlete.username}</option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Program description"
            value={formData.description}
            onChange={(event) => handleFormChange('description', event.target.value)}
            className="notes-textarea"
            rows="3"
          />
          <div className="form-grid compact-grid">
            <input
              type="date"
              value={formData.start_date}
              onChange={(event) => handleFormChange('start_date', event.target.value)}
              className="form-input"
            />
            <input
              type="date"
              value={formData.end_date}
              onChange={(event) => handleFormChange('end_date', event.target.value)}
              className="form-input"
            />
            <div className="detail-item">
              <span className="label">Week start</span>
              <span className="value">{programData.week_start_date || formData.start_date}</span>
            </div>
          </div>
        </div>

        <div className="section-card builder-toolbar">
          <div>
            <h3>Weekly Structure</h3>
            <p className="section-subtitle">
              Add or trim days, then prescribe exercises with sets, reps, intensity, and notes. Coaches who live
              in Excel can download the template, fill it in, and upload it to autofill this view.
            </p>
          </div>
          <div className="toolbar-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={handleTemplateFileChosen}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
            <button type="button" className="text-btn" onClick={handleDownloadTemplate}>
              ⬇ Download template
            </button>
            <button type="button" className="text-btn" onClick={handleTemplateUploadClick}>
              ⬆ Upload .xlsx
            </button>
            <button type="button" className="text-btn" onClick={toggleEditorMode}>
              {editorMode === 'form' ? '⊞ Spreadsheet view' : '☰ Structured view'}
            </button>
            {editorMode === 'form' && (
              <button type="button" className="text-btn" onClick={handleAddDay}>+ Add day</button>
            )}
            <button type="button" className="save-btn" onClick={handleSave} disabled={saving || !formData.name || !formData.athlete_id}>
              {saving ? 'Saving...' : editingProgramId ? 'Update Program' : 'Create Program'}
            </button>
          </div>
        </div>

        {editorMode === 'spreadsheet' ? (
          <SpreadsheetEditor programData={programData} onChange={setProgramData} />
        ) : (
        <div className="day-stack">
          {programData.days.map((day, dayIndex) => (
            <WorkoutDay
              key={`${day.day}-${dayIndex}`}
              day={day}
              dayIndex={dayIndex}
              exercises={day.exercises}
              onExercisesChange={(nextExercises) => handleExercisesChange(dayIndex, nextExercises)}
              onDayChange={(nextDayName) => handleDayChange(dayIndex, nextDayName)}
              onRemoveDay={() => handleRemoveDay(dayIndex)}
              canRemoveDay={programData.days.length > 1}
              isCoach
            />
          ))}
        </div>
        )}

        <div className="section-title-row">
          <h3>Existing Programs</h3>
          <span className="section-subtitle">Edit structure or reassign an existing program.</span>
        </div>

        {programs.length === 0 ? (
          <div className="section-card empty-inline">No programs created yet.</div>
        ) : (
          programs.map((program) => {
            const normalizedProgram = normalizeProgramData(program.program_data, program.start_date)
            return (
              <div key={program.id} className="section-card">
                <div className="exercise-header">
                  <div>
                    <h4>{program.name}</h4>
                    <p>Assigned to <strong>{program.athlete_username}</strong></p>
                  </div>
                  <button type="button" className="text-btn" onClick={() => handleEditProgram(program)}>Edit</button>
                </div>
                <p>{program.description || 'No description provided.'}</p>
                <div className="summary-grid">
                  <div className="detail-item">
                    <span className="label">Start</span>
                    <span className="value">{program.start_date}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">End</span>
                    <span className="value">{program.end_date || 'n/a'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Days / exercises</span>
                    <span className="value">{normalizedProgram.days.length} / {countExercises(normalizedProgram)}</span>
                  </div>
                </div>
                <div className="form-row assignment-row">
                  <select
                    value={assignmentDrafts[program.id] ?? ''}
                    onChange={(event) => setAssignmentDrafts((current) => ({ ...current, [program.id]: event.target.value }))}
                    className="form-input"
                  >
                    <option value="">Reassign athlete</option>
                    {athletes.map((athlete) => (
                      <option key={athlete.id} value={athlete.id}>{athlete.username}</option>
                    ))}
                  </select>
                  <button type="button" className="save-btn" onClick={() => handleAssign(program.id)}>Reassign</button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default CoachDashboard
