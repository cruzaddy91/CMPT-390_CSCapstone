import { useEffect, useMemo, useRef, useState } from 'react'
import WorkoutDay from '../components/WorkoutDay'
import SpreadsheetEditor from '../components/SpreadsheetEditor'
import ProgramPreview from '../components/ProgramPreview'
import { assignProgram, createProgram, getAthletes, getProgramsFromBackend, updateProgram } from '../services/api'
import { countExercises, createEmptyDay, createEmptyWeek, normalizeProgramData } from '../utils/dataStructure'
import { formatApiError } from '../utils/errors'
import { downloadTemplateXlsx, parseProgramFile } from '../utils/programTemplate'
import { clearDraft, readDraft, saveDraft } from '../utils/programDraft'
import { BLOCK_PRESETS, endDateForBlock, inferBlockKey } from '../utils/blockLength'

const getDefaultForm = () => ({
  name: '',
  description: '',
  athlete_id: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
})

const swap = (array, i, j) => {
  if (i < 0 || j < 0 || i >= array.length || j >= array.length) return array
  const next = [...array]
  const tmp = next[i]; next[i] = next[j]; next[j] = tmp
  return next
}

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
  const [intensityMode, setIntensityMode] = useState('percent_1rm') // 'percent_1rm' | 'rpe' | 'weight'
  const [showPreview, setShowPreview] = useState(false)
  const [draftBadge, setDraftBadge] = useState(false) // shows briefly when a saved draft is restored
  const fileInputRef = useRef(null)

  useEffect(() => { loadDashboardData() }, [])

  useEffect(() => {
    const handle = setTimeout(() => { refreshAthletes(athleteSearch) }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteSearch])

  // Autosave: persist form + programData to localStorage on every change
  // while the editor is open. Throttling is not necessary -- setItem is
  // synchronous and cheap at this payload size.
  useEffect(() => {
    if (view !== 'editor') return
    saveDraft(editingProgramId, {
      formData, programData, editorMode, intensityMode,
    })
  }, [view, editingProgramId, formData, programData, editorMode, intensityMode])

  const upcomingSummary = useMemo(() => ({
    dayCount: programData.days.length,
    exerciseCount: countExercises(programData),
  }), [programData])

  const currentBlockKey = useMemo(
    () => inferBlockKey(formData.start_date, formData.end_date),
    [formData.start_date, formData.end_date],
  )

  const assignedAthleteUsername = useMemo(() => {
    const athleteIdNum = Number(formData.athlete_id)
    if (!athleteIdNum) return ''
    const hit = athletes.find((a) => a.id === athleteIdNum)
    return hit ? hit.username : ''
  }, [formData.athlete_id, athletes])

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

  const applyDraftIfPresent = (programId, fallbackForm, fallbackProgramData) => {
    const storedDraft = readDraft(programId)
    if (!storedDraft || !storedDraft.draft) {
      return { form: fallbackForm, programData: fallbackProgramData, restored: false }
    }
    const { formData: df, programData: dp, editorMode: dem, intensityMode: dim } = storedDraft.draft
    if (dem === 'form' || dem === 'spreadsheet') setEditorMode(dem)
    if (dim === 'percent_1rm' || dim === 'rpe' || dim === 'weight') setIntensityMode(dim)
    return {
      form: df || fallbackForm,
      programData: dp || fallbackProgramData,
      restored: true,
    }
  }

  const openNewProgram = () => {
    const freshForm = getDefaultForm()
    const freshProgram = createEmptyWeek(freshForm.start_date)
    const { form, programData: prog, restored } = applyDraftIfPresent(null, freshForm, freshProgram)
    setEditingProgramId(null)
    setFormData(form)
    setProgramData(prog)
    setView('editor')
    setSaveMessage('')
    if (restored) {
      setDraftBadge(true)
      setTimeout(() => setDraftBadge(false), 3500)
    }
  }

  const openExistingProgram = (program) => {
    const fallbackForm = {
      name: program.name,
      description: program.description || '',
      athlete_id: String(program.athlete_id || ''),
      start_date: program.start_date,
      end_date: program.end_date || '',
    }
    const fallbackProgram = normalizeProgramData(program.program_data, program.start_date)
    const { form, programData: prog, restored } = applyDraftIfPresent(program.id, fallbackForm, fallbackProgram)
    setEditingProgramId(program.id)
    setFormData(form)
    setProgramData(prog)
    setView('editor')
    setSaveMessage('')
    if (restored) {
      setDraftBadge(true)
      setTimeout(() => setDraftBadge(false), 3500)
    }
  }

  const backToList = () => {
    setView('list')
    setSaveMessage('')
    setShowPreview(false)
  }

  const handleFormChange = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    if (field === 'start_date') {
      setProgramData((current) => ({ ...current, week_start_date: value }))
    }
  }

  const handleBlockPreset = (weeks) => {
    const end = endDateForBlock(formData.start_date, weeks)
    setFormData((current) => ({ ...current, end_date: end }))
  }

  // Program-data mutations (day-level)
  const handleDayChange = (dayIndex, nextDayName) => {
    setProgramData((current) => ({
      ...current,
      days: current.days.map((day, idx) => (idx === dayIndex ? { ...day, day: nextDayName } : day)),
    }))
  }

  const handleExercisesChange = (dayIndex, nextExercises) => {
    setProgramData((current) => ({
      ...current,
      days: current.days.map((day, idx) => (idx === dayIndex ? { ...day, exercises: nextExercises } : day)),
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
      days: current.days.filter((_, idx) => idx !== dayIndex),
    }))
  }

  const handleDuplicateDay = (dayIndex) => {
    setProgramData((current) => {
      const source = current.days[dayIndex]
      const cloned = {
        day: `${source.day} (copy)`,
        exercises: (source.exercises || []).map((ex) => ({ ...ex })),
      }
      const next = [...current.days]
      next.splice(dayIndex + 1, 0, cloned)
      return { ...current, days: next }
    })
  }

  const handleMoveDay = (dayIndex, delta) => {
    setProgramData((current) => ({ ...current, days: swap(current.days, dayIndex, dayIndex + delta) }))
  }

  const handleDownloadTemplate = () => {
    downloadTemplateXlsx()
    setSaveMessage('Template downloaded. Fill it in and re-upload to autofill a new program.')
    setTimeout(() => setSaveMessage(''), 4000)
  }

  const handleTemplateUploadClick = () => { fileInputRef.current?.click() }

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

  const toggleEditorMode = () => setEditorMode((c) => (c === 'form' ? 'spreadsheet' : 'form'))

  const handleSave = async () => {
    if (!formData.name || !formData.athlete_id) {
      setSaveMessage('Program name and athlete assignment are required.')
      return
    }
    const payload = {
      ...formData,
      athlete_id: Number(formData.athlete_id),
      end_date: formData.end_date || null,
      program_data: { ...programData, week_start_date: formData.start_date },
    }
    try {
      setSaving(true); setSaveMessage('')
      if (editingProgramId) {
        await updateProgram(editingProgramId, payload)
        setSaveMessage('Program updated.')
      } else {
        await createProgram(payload)
        setSaveMessage('Program created.')
      }
      clearDraft(editingProgramId) // discard autosave on successful commit
      await loadDashboardData()
      setTimeout(() => { setSaveMessage(''); backToList() }, 900)
    } catch (error) {
      console.error('Error saving program:', error)
      setSaveMessage(formatApiError(error, 'Error saving program. Check the fields and try again.'))
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = async (programId) => {
    const athleteId = assignmentDrafts[programId]
    if (!athleteId) { setSaveMessage('Select an athlete before reassigning the program.'); return }
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
        <>
          <EditorView
            editingProgramId={editingProgramId}
            formData={formData}
            programData={programData}
            athletes={athletes}
            athleteSearch={athleteSearch}
            athleteTotal={athleteTotal}
            editorMode={editorMode}
            intensityMode={intensityMode}
            saving={saving}
            saveMessage={saveMessage}
            upcomingSummary={upcomingSummary}
            currentBlockKey={currentBlockKey}
            fileInputRef={fileInputRef}
            draftBadge={draftBadge}
            onBack={backToList}
            onFormChange={handleFormChange}
            onBlockPreset={handleBlockPreset}
            onAthleteSearch={setAthleteSearch}
            onDayChange={handleDayChange}
            onExercisesChange={handleExercisesChange}
            onAddDay={handleAddDay}
            onRemoveDay={handleRemoveDay}
            onDuplicateDay={handleDuplicateDay}
            onMoveDay={handleMoveDay}
            onDownloadTemplate={handleDownloadTemplate}
            onUploadClick={handleTemplateUploadClick}
            onUploadChosen={handleTemplateFileChosen}
            onToggleEditorMode={toggleEditorMode}
            onIntensityModeChange={setIntensityMode}
            onProgramDataChange={setProgramData}
            onPreview={() => setShowPreview(true)}
            onSave={handleSave}
          />
          {showPreview && (
            <ProgramPreview
              programData={programData}
              programName={formData.name}
              athleteUsername={assignedAthleteUsername}
              onClose={() => setShowPreview(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// List view -- sparse rows instead of full cards, one primary CTA.
// --------------------------------------------------------------------------
const ListView = ({ programs, athletes, assignmentDrafts, onAssignDraftChange, onAssignSubmit,
  onNewProgram, onEditProgram, saveMessage }) => (
  <>
    <div className="dashboard-header">
      <div className="dashboard-kicker-row">
        <span className="dashboard-kicker">Coach</span>
        <button type="button" className="save-btn" onClick={onNewProgram}>+ New program</button>
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

// --------------------------------------------------------------------------
// Editor view -- clean focused program builder with all seven power features.
// --------------------------------------------------------------------------
const EditorView = ({
  editingProgramId, formData, programData, athletes, athleteSearch, athleteTotal,
  editorMode, intensityMode, saving, saveMessage, upcomingSummary, currentBlockKey,
  fileInputRef, draftBadge,
  onBack, onFormChange, onBlockPreset, onAthleteSearch, onDayChange, onExercisesChange,
  onAddDay, onRemoveDay, onDuplicateDay, onMoveDay,
  onDownloadTemplate, onUploadClick, onUploadChosen,
  onToggleEditorMode, onIntensityModeChange, onProgramDataChange, onPreview, onSave,
}) => {
  const dayCount = programData.days.length
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
          <button type="button" className="tool-btn" onClick={onPreview}
                  title="See this program from the athlete's perspective">
            <span className="tool-btn-label">Preview as Athlete</span>
          </button>
        </div>
        <button type="button" className="save-btn editor-save-btn" onClick={onSave}
                disabled={saving || !formData.name || !formData.athlete_id}>
          {saving ? 'Saving…' : editingProgramId ? 'Save changes' : 'Create program'}
        </button>
      </div>

      {draftBadge && (
        <div className="draft-badge">Restored unsaved draft from this browser.</div>
      )}

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

        <div className="form-grid compact-grid editor-date-grid">
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

        <div className="block-length-picker">
          <span className="block-length-label">Block length</span>
          <div className="block-length-options" role="radiogroup" aria-label="Block length preset">
            {BLOCK_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                role="radio"
                aria-checked={currentBlockKey === preset.key}
                className={`block-length-chip ${currentBlockKey === preset.key ? 'is-active' : ''}`}
                onClick={() => onBlockPreset(preset.weeks)}
              >
                {preset.label}
              </button>
            ))}
            <span className={`block-length-chip ${currentBlockKey === 'custom' ? 'is-active' : ''} block-length-chip-custom`}
                  aria-disabled="true">
              Custom
            </span>
          </div>
        </div>

        <div className="intensity-mode-picker">
          <span className="block-length-label">Intensity mode</span>
          <div className="block-length-options" role="radiogroup" aria-label="Intensity mode">
            {[
              { key: 'percent_1rm', label: '% 1RM' },
              { key: 'rpe',         label: 'RPE' },
              { key: 'weight',      label: 'Weight' },
            ].map((mode) => (
              <button
                key={mode.key}
                type="button"
                role="radio"
                aria-checked={intensityMode === mode.key}
                className={`block-length-chip ${intensityMode === mode.key ? 'is-active' : ''}`}
                onClick={() => onIntensityModeChange(mode.key)}
                title={`Show only ${mode.label} in the prescription grid (hidden data is preserved)`}
              >
                {mode.label}
              </button>
            ))}
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
              dayCount={dayCount}
              exercises={day.exercises}
              intensityMode={intensityMode}
              onExercisesChange={(nextExercises) => onExercisesChange(dayIndex, nextExercises)}
              onDayChange={(nextDayName) => onDayChange(dayIndex, nextDayName)}
              onRemoveDay={() => onRemoveDay(dayIndex)}
              onDuplicateDay={() => onDuplicateDay(dayIndex)}
              onMoveDayUp={() => onMoveDay(dayIndex, -1)}
              onMoveDayDown={() => onMoveDay(dayIndex, 1)}
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
