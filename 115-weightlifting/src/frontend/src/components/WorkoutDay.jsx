import { useState } from 'react'
import { createEmptyExercise } from '../utils/dataStructure'

// Column schema in the card view mirrors the xlsx template 1:1 so whatever a
// coach sees here round-trips to the uploaded / downloaded sheet without loss.
// Three intensity fields on purpose -- coach fills in whichever they prefer
// (% 1RM / RPE / Weight). The legacy `intensity` string is derived from the
// first non-empty of those three so older consumers keep working.

const syncIntensity = (exercise) => ({
  ...exercise,
  intensity: exercise.percent_1rm || exercise.rpe || exercise.weight || '',
})

const WorkoutDay = ({
  day,
  dayIndex,
  exercises,
  onExercisesChange,
  isCoach,
  athleteResults,
  onResultChange,
  onDayChange,
  onRemoveDay,
  canRemoveDay = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)

  const handleAddExercise = () => {
    onExercisesChange([...exercises, createEmptyExercise()])
  }

  const handleExerciseChange = (index, field, value) => {
    const nextExercises = [...exercises]
    const nextExercise = { ...nextExercises[index], [field]: value }
    // Intensity trio: keep the legacy single-field in sync when the coach
    // edits any of the explicit intensity columns.
    if (field === 'percent_1rm' || field === 'rpe' || field === 'weight') {
      nextExercises[index] = syncIntensity(nextExercise)
    } else {
      nextExercises[index] = nextExercise
    }
    onExercisesChange(nextExercises)
  }

  const handleRemoveExercise = (index) => {
    onExercisesChange(exercises.filter((_, exerciseIndex) => exerciseIndex !== index))
  }

  const getAthleteResult = (exerciseIndex) => {
    if (!athleteResults) return null
    return athleteResults[String(exerciseIndex)] || null
  }

  const handleAthleteResultChange = (exerciseIndex, field, value) => {
    if (onResultChange) {
      onResultChange(exerciseIndex, field, value)
    }
  }

  return (
    <div className="workout-day section-card">
      <div className="day-header">
        <div className="day-heading-group">
          <button type="button" className="text-btn day-collapse-btn" onClick={() => setIsExpanded((current) => !current)}>
            {isExpanded ? '▾' : '▸'}
          </button>
          {isCoach ? (
            <input
              type="text"
              value={day.day}
              onChange={(event) => onDayChange?.(event.target.value)}
              className="day-title-input"
              placeholder={`Day ${dayIndex + 1}`}
            />
          ) : (
            <h3>{day.day}</h3>
          )}
          <span className="day-exercise-count">
            <span className="data">{exercises.length}</span> {exercises.length === 1 ? 'exercise' : 'exercises'}
          </span>
        </div>
        {isCoach && canRemoveDay && (
          <button type="button" className="text-btn" onClick={onRemoveDay}>
            Remove day
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="day-content">
          {exercises.length === 0 && (
            <div className="empty-inline day-empty">No exercises for this day yet.</div>
          )}

          {exercises.map((exercise, index) => {
            const athleteResult = getAthleteResult(index)
            const isCompleted = athleteResult?.completed || false

            return isCoach ? (
              <CoachExerciseRow
                key={`coach-${index}`}
                exercise={exercise}
                isFirst={index === 0}
                onChange={(field, value) => handleExerciseChange(index, field, value)}
                onRemove={() => handleRemoveExercise(index)}
              />
            ) : (
              <AthleteExerciseRow
                key={`athlete-${index}`}
                exercise={exercise}
                isFirst={index === 0}
                isCompleted={isCompleted}
                result={athleteResult}
                onResultChange={(field, value) => handleAthleteResultChange(index, field, value)}
              />
            )
          })}

          {isCoach && (
            <button type="button" onClick={handleAddExercise} className="text-btn add-exercise-btn">
              + Add exercise
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Coach input row -- one exercise, all 11 xlsx columns available.
// --------------------------------------------------------------------------
const CoachExerciseRow = ({ exercise, isFirst, onChange, onRemove }) => (
  <div className={`exercise-row ${isFirst ? 'exercise-row-first' : ''}`}>
    <div className="exercise-row-header">
      <input
        type="text"
        placeholder="Exercise name (e.g. Snatch, Clean & Jerk + OHS)"
        value={exercise.name || ''}
        onChange={(event) => onChange('name', event.target.value)}
        className="exercise-name-input"
        aria-label="Exercise name"
      />
      <button type="button" onClick={onRemove} className="exercise-remove-btn" aria-label="Remove exercise" title="Remove exercise">
        ×
      </button>
    </div>

    <div className="exercise-prescription-grid">
      <Field label="Sets" value={exercise.sets} onChange={(v) => onChange('sets', v)} placeholder="5" width="5ch" />
      <Field label="Reps" value={exercise.reps} onChange={(v) => onChange('reps', v)} placeholder="2 or 1+1" width="8ch" />
      <Field label="% 1RM" value={exercise.percent_1rm} onChange={(v) => onChange('percent_1rm', v)} placeholder="75%" width="7ch" />
      <Field label="RPE" value={exercise.rpe} onChange={(v) => onChange('rpe', v)} placeholder="8" width="5ch" />
      <Field label="Weight" value={exercise.weight} onChange={(v) => onChange('weight', v)} placeholder="100kg" width="8ch" />
      <Field label="Tempo" value={exercise.tempo} onChange={(v) => onChange('tempo', v)} placeholder="3-1-X-1" width="8ch" />
      <Field label="Rest" value={exercise.rest} onChange={(v) => onChange('rest', v)} placeholder="2min" width="6ch" />
    </div>

    <textarea
      placeholder="Coach notes (cues, technique reminders, warmup detail)"
      value={exercise.notes || ''}
      onChange={(event) => onChange('notes', event.target.value)}
      className="notes-textarea exercise-notes"
      rows="2"
      aria-label="Coach notes"
    />
  </div>
)

// Small labeled field used inside the prescription grid. Tabular mono for
// data, quiet caps-label above, flexes to fit the grid.
const Field = ({ label, value, onChange, placeholder, width }) => (
  <label className="field-inline" style={{ minWidth: width }}>
    <span>{label}</span>
    <input
      type="text"
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="field-inline-input data"
    />
  </label>
)

// --------------------------------------------------------------------------
// Athlete view -- read-only prescription + actual-result + athlete notes.
// Shows all 11 fields so the athlete sees what was prescribed, not just 3.
// --------------------------------------------------------------------------
const AthleteExerciseRow = ({ exercise, isFirst, isCompleted, result, onResultChange }) => {
  // Combine intensity fields into a compact display: "75% · RPE 8 · 100kg"
  // (only showing what was actually prescribed).
  const intensityTokens = []
  if (exercise.percent_1rm) intensityTokens.push(exercise.percent_1rm)
  else if (exercise.intensity) intensityTokens.push(exercise.intensity)
  if (exercise.rpe) intensityTokens.push(`RPE ${exercise.rpe}`)
  if (exercise.weight) intensityTokens.push(exercise.weight)
  const intensityLabel = intensityTokens.length > 0 ? intensityTokens.join(' · ') : null

  return (
    <div className={`exercise-row athlete-row ${isFirst ? 'exercise-row-first' : ''} ${isCompleted ? 'exercise-row-completed' : ''}`}>
      <div className="exercise-row-header">
        <h4 className="athlete-exercise-title">{exercise.name || 'Exercise'}</h4>
        <label className="completed-checkbox">
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={(event) => onResultChange('completed', event.target.checked)}
          />
          <span>Done</span>
        </label>
      </div>

      <div className="athlete-prescription">
        <span className="prescription-cell">
          <span className="label">Sets × Reps</span>
          <span className="value data">{exercise.sets || '—'} × {exercise.reps || '—'}</span>
        </span>
        {intensityLabel && (
          <span className="prescription-cell">
            <span className="label">Intensity</span>
            <span className="value data">{intensityLabel}</span>
          </span>
        )}
        {exercise.tempo && (
          <span className="prescription-cell">
            <span className="label">Tempo</span>
            <span className="value data">{exercise.tempo}</span>
          </span>
        )}
        {exercise.rest && (
          <span className="prescription-cell">
            <span className="label">Rest</span>
            <span className="value data">{exercise.rest}</span>
          </span>
        )}
      </div>

      {exercise.notes && (
        <div className="coach-notes">
          <strong>Coach notes:</strong> {exercise.notes}
        </div>
      )}

      <div className="athlete-result">
        <input
          type="text"
          className="form-input"
          placeholder="Actual result (e.g. 75x2)"
          value={result?.result || ''}
          onChange={(event) => onResultChange('result', event.target.value)}
          aria-label="Actual result"
        />
        <textarea
          placeholder="How did it feel? (optional)"
          value={result?.athlete_notes || ''}
          onChange={(event) => onResultChange('athlete_notes', event.target.value)}
          className="athlete-notes"
          rows="1"
          aria-label="Athlete notes"
        />
      </div>
    </div>
  )
}

export default WorkoutDay
