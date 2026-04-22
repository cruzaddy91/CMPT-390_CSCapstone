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
  end_date: '',
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
  const [view, setView] = useState('list') // 'list' | 'editor'
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
    exerciseCount: countExercises(programData),
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

  const openNewProgram = () => {
    resetEditor()
    setView('editor')
    setSaveMessage('')
  }

  const openExistingProgram = (program) => {
    setEditingProgramId(program.id)
    setFormData({
      name: program.name,
      description: program.description || '',
      athlete_id: String(program.athlete_id || ''),
      start_date: program.start_date,
      end_date: program.end_date || '',
    })
    setProgramData(normalizeProgramData(program.program_data, program.start_date))
    setView('editor')
    setSaveMessage('')
  }

  const backToList = () => {
    setView('list')
    setSaveMessage('')
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
      days: current.days.map((day, index) => (index === dayIndex ? { ...day, day: nextDayName } : day)),
    }))
  }

  const handleExercisesChange = (dayIndex, nextExercises) => {
    setProgramData((current) => ({
      ...current,
      days: current.days.map((day, index) => (index === dayIndex ? { ...day, exercises: nextExercises } : day)),
    }))
  }

  const handleAddDay = () => {
    setProgramData((current) => ({
      ...current,
      days: [...current.days, createEmptyDay(`Day ${current.days.length + 1}`)],
    }))
  }

  const handleRemoveDay = (dayIndex) => {
    setProgramData((current) => ({
      ...current,
      days: current.days.filter((_, index) => index !== dayIndex),
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
    event.target.value = ''
    if (!file) return
    try {
      setSaveMessage('')
      const nextProgramData = await parseProgramFile(file)
      setProgramData(nextProgramData)
      const exercises = nextProgramData.days.reduce((t, d) => t + d.exercises.length, 0)
      setSaveMessage(
        `Loaded ${nextProgramData.days.length} day(s) / ${exercises} exercise(s) from ${file.name}. Review and hit Save.`
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
        week_start_date: formData.start_date,
      },
    }

    try {
      setSaving(true)
      setSaveMessage('')
      if (editingProgramId) {
        await updateProgram(editingProgramId, payload)
        setSaveMessage('Program updated.')
      } else {
        await createProgram(payload)
        setSaveMessage('Program created.')
      }
      await loadDashboardData()
      // Return to list after a successful save; coaches usually want to see
      // the program on the roster, not stay in the editor.
      setTimeout(() => {
        setSaveMessage('')
        backToList()
      }, 900)
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
      setSaveMessage('Program reassigned.')
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
        <div className="loading">Loading coach workspace…</div>
      </div>
    )
  }

  return (
    <div className="dashboard-container coach-dashboard">
      {apiError && (
        <div className="api-status">
          <span className="api-error">API: {apiError}</span>
        </div>
      )}

      {view === 'list' ? (
        <ListView
          programs={programs}
          athletes={athletes}
          assignmentDrafts={assignmentDrafts}
          onAssignDraftChange={(programId, value) =>
            setAssignmentDrafts((current) => ({ ...current, [programId]: value }))
          }
          onAssignSubmit={handleAssign}
          onNewProgram={openNewProgram}
          onEditProgram={openExistingProgram}
          saveMessage={saveMessage}
        />
      ) : (
        <EditorView
          editingProgramId={editingProgramId}
          formData={formData}
          programData={programData}
          athletes={athletes}
          athleteSearch={athleteSearch}
          athleteTotal={athleteTotal}
          editorMode={editorMode}
          saving={saving}
          saveMessage={saveMessage}
          upcomingSummary={upcomingSummary}
          fileInputRef={fileInputRef}
          onBack={backToList}
          onFormChange={handleFormChange}
          onAthleteSearch={setAthleteSearch}
          onDayChange={handleDayChange}
          onExercisesChange={handleExercisesChange}
          onAddDay={handleAddDay}
          onRemoveDay={handleRemoveDay}
          onDownloadTemplate={handleDownloadTemplate}
          onUploadClick={handleTemplateUploadClick}
          onUploadChosen={handleTemplateFileChosen}
          onToggleEditorMode={toggleEditorMode}
          onProgramDataChange={setProgramData}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// List view -- sparse rows instead of full cards, one primary CTA.
// --------------------------------------------------------------------------
const ListView = ({
  programs,
  athletes,
  assignmentDrafts,
  onAssignDraftChange,
  onAssignSubmit,
  onNewProgram,
  onEditProgram,
  saveMessage,
}) => {
  return (
    <>
      <div className="dashboard-header">
        <div className="dashboard-kicker-row">
          <span className="dashboard-kicker">Coach</span>
          <button type="button" className="save-btn" onClick={onNewProgram}>
            + New program
          </button>
        </div>
        <h1>Your programs</h1>
        <p className="dashboard-description">
          Structured weekly plans, assignments, and reassignments. Click a program to edit, or start a new one.
        </p>
        {saveMessage && (
          <div className={`save-message ${saveMessage.toLowerCase().includes('error') || saveMessage.toLowerCase().includes('could') ? 'error' : 'success'}`}>
            {saveMessage}
          </div>
        )}
      </div>

      {programs.length === 0 ? (
        <div className="empty-state">
          <p>No programs yet.</p>
          <p className="section-subtitle">Click <strong>+ New program</strong> to build your first one, or download the Excel template to import from a spreadsheet.</p>
        </div>
      ) : (
        <div className="programs-list">
          {programs.map((program) => {
            const normalized = normalizeProgramData(program.program_data, program.start_date)
            const exerciseCount = countExercises(normalized)
            return (
              <div key={program.id} className="program-row">
                <div className="program-row-main" onClick={() => onEditProgram(program)} role="button" tabIndex={0}
                     onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && onEditProgram(program)}>
                  <div className="program-row-title">{program.name}</div>
                  <div className="program-row-meta">
                    <span>{program.athlete_username}</span>
                    <span className="program-row-dot">·</span>
                    <span className="data">{normalized.days.length}</span> <span>days</span>
                    <span className="program-row-dot">·</span>
                    <span className="data">{exerciseCount}</span> <span>exercises</span>
                    <span className="program-row-dot">·</span>
                    <span>starts {program.start_date}</span>
                  </div>
                </div>
                <div className="program-row-actions">
                  <button type="button" className="text-btn" onClick={() => onEditProgram(program)}>Edit</button>
                  <select
                    value={assignmentDrafts[program.id] ?? ''}
                    onChange={(event) => onAssignDraftChange(program.id, event.target.value)}
                    className="form-input program-row-reassign-select"
                    aria-label="Reassign athlete"
                  >
                    <option value="">Reassign…</option>
                    {athletes.map((athlete) => (
                      <option key={athlete.id} value={athlete.id}>{athlete.username}</option>
                    ))}
                  </select>
                  {assignmentDrafts[program.id] && (
                    <button type="button" className="save-btn program-row-reassign-go" onClick={() => onAssignSubmit(program.id)}>
                      Go
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// --------------------------------------------------------------------------
// Editor view -- clean focused program builder.
// Import / spreadsheet / add-day collapse into a single compact icon group.
// --------------------------------------------------------------------------
const EditorView = ({
  editingProgramId,
  formData,
  programData,
  athletes,
  athleteSearch,
  athleteTotal,
  editorMode,
  saving,
  saveMessage,
  upcomingSummary,
  fileInputRef,
  onBack,
  onFormChange,
  onAthleteSearch,
  onDayChange,
  onExercisesChange,
  onAddDay,
  onRemoveDay,
  onDownloadTemplate,
  onUploadClick,
  onUploadChosen,
  onToggleEditorMode,
  onProgramDataChange,
  onSave,
}) => {
  return (
    <>
      <div className="editor-topbar">
        <button type="button" className="text-btn editor-back-btn" onClick={onBack} aria-label="Back to programs">
          ← Programs
        </button>
        <div className="editor-tool-group">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={onUploadChosen}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
          <button type="button" className="tool-btn" onClick={onDownloadTemplate} title="Download the .xlsx template to fill in your program offline">
            <span className="tool-btn-icon">⬇</span>
            <span className="tool-btn-label">Download Template</span>
          </button>
          <button type="button" className="tool-btn" onClick={onUploadClick} title="Upload a filled-in .xlsx to autofill this program">
            <span className="tool-btn-icon">⬆</span>
            <span className="tool-btn-label">Upload Program</span>
          </button>
          <button type="button" className="tool-btn" onClick={onToggleEditorMode}
                  title={editorMode === 'form' ? 'Switch to spreadsheet view (Excel-like grid)' : 'Switch to card view (day-by-day cards)'}>
            <span className="tool-btn-icon">{editorMode === 'form' ? '⊞' : '☰'}</span>
            <span className="tool-btn-label">{editorMode === 'form' ? 'Spreadsheet View' : 'Card View'}</span>
          </button>
        </div>
        <button type="button" className="save-btn editor-save-btn" onClick={onSave}
                disabled={saving || !formData.name || !formData.athlete_id}>
          {saving ? 'Saving…' : editingProgramId ? 'Save changes' : 'Create program'}
        </button>
      </div>

      <div className="editor-header">
        <input
          type="text"
          placeholder="Program name"
          value={formData.name}
          onChange={(event) => onFormChange('name', event.target.value)}
          className="editor-title-input"
          aria-label="Program name"
        />
        <div className="editor-summary">
          <span className="data">{upcomingSummary.dayCount}</span> days
          <span className="program-row-dot">·</span>
          <span className="data">{upcomingSummary.exerciseCount}</span> exercises
        </div>
      </div>

      {saveMessage && (
        <div className={`save-message ${saveMessage.toLowerCase().includes('error') || saveMessage.toLowerCase().includes('could') ? 'error' : 'success'}`}>
          {saveMessage}
        </div>
      )}

      <div className="section-card editor-meta-card">
        <div className="form-row">
          <input
            type="search"
            placeholder={`Filter athletes (${athleteTotal} total)`}
            value={athleteSearch}
            onChange={(event) => onAthleteSearch(event.target.value)}
            className="form-input"
            aria-label="Search athletes"
          />
          <select
            value={formData.athlete_id}
            onChange={(event) => onFormChange('athlete_id', event.target.value)}
            className="form-input"
            aria-label="Assign athlete"
          >
            <option value="">Assign athlete…</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>{athlete.username}</option>
            ))}
          </select>
        </div>
        <textarea
          placeholder="Program description (optional)"
          value={formData.description}
          onChange={(event) => onFormChange('description', event.target.value)}
          className="notes-textarea"
          rows="2"
        />
        <div className="form-grid compact-grid">
          <label className="field-stacked">
            <span>Start</span>
            <input
              type="date"
              value={formData.start_date}
              onChange={(event) => onFormChange('start_date', event.target.value)}
              className="form-input"
            />
          </label>
          <label className="field-stacked">
            <span>End</span>
            <input
              type="date"
              value={formData.end_date}
              onChange={(event) => onFormChange('end_date', event.target.value)}
              className="form-input"
            />
          </label>
          <div className="field-stacked">
            <span>Week of</span>
            <span className="data field-value">{programData.week_start_date || formData.start_date}</span>
          </div>
        </div>
      </div>

      <div className="section-title-row">
        <h3>Weekly structure</h3>
        {editorMode === 'form' && (
          <button type="button" className="text-btn" onClick={onAddDay}>+ Add day</button>
        )}
      </div>

      {editorMode === 'spreadsheet' ? (
        <SpreadsheetEditor programData={programData} onChange={onProgramDataChange} />
      ) : (
        <div className="day-stack">
          {programData.days.map((day, dayIndex) => (
            <WorkoutDay
              key={`${day.day}-${dayIndex}`}
              day={day}
              dayIndex={dayIndex}
              exercises={day.exercises}
              onExercisesChange={(nextExercises) => onExercisesChange(dayIndex, nextExercises)}
              onDayChange={(nextDayName) => onDayChange(dayIndex, nextDayName)}
              onRemoveDay={() => onRemoveDay(dayIndex)}
              canRemoveDay={programData.days.length > 1}
              isCoach
            />
          ))}
        </div>
      )}
    </>
  )
}

export default CoachDashboard
