import { useState } from 'react'
import { createEmptyExercise } from '../utils/dataStructure'

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
  canRemoveDay = false
}) => {
  const [isExpanded, setIsExpanded] = useState(true)

  const handleAddExercise = () => {
    onExercisesChange([...exercises, createEmptyExercise()])
  }

  const handleExerciseChange = (index, field, value) => {
    const nextExercises = [...exercises]
    nextExercises[index] = {
      ...nextExercises[index],
      [field]: value
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
          <button type="button" className="text-btn" onClick={() => setIsExpanded((current) => !current)}>
            {isExpanded ? 'Collapse' : 'Expand'}
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
        </div>
        {isCoach && canRemoveDay && (
          <button type="button" className="remove-btn" onClick={onRemoveDay}>
            Remove day
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="day-content">
          {exercises.length === 0 && (
            <div className="empty-inline">No exercises added for this day yet.</div>
          )}

          {exercises.map((exercise, index) => {
            const athleteResult = getAthleteResult(index)
            const isCompleted = athleteResult?.completed || false

            return (
              <div key={`${day.day}-${index}`} className={`exercise-card ${isCompleted ? 'completed' : ''}`}>
                {isCoach ? (
                  <div className="exercise-form">
                    <div className="form-row">
                      <input
                        type="text"
                        placeholder="Exercise name"
                        value={exercise.name}
                        onChange={(event) => handleExerciseChange(index, 'name', event.target.value)}
                        className="exercise-input"
                      />
                      <button type="button" onClick={() => handleRemoveExercise(index)} className="remove-btn">
                        Remove
                      </button>
                    </div>
                    <div className="form-grid">
                      <input
                        type="text"
                        placeholder="Sets"
                        value={exercise.sets}
                        onChange={(event) => handleExerciseChange(index, 'sets', event.target.value)}
                        className="form-input"
                      />
                      <input
                        type="text"
                        placeholder="Reps"
                        value={exercise.reps}
                        onChange={(event) => handleExerciseChange(index, 'reps', event.target.value)}
                        className="form-input"
                      />
                      <input
                        type="text"
                        placeholder="Intensity / RPE"
                        value={exercise.intensity}
                        onChange={(event) => handleExerciseChange(index, 'intensity', event.target.value)}
                        className="form-input"
                      />
                    </div>
                    <textarea
                      placeholder="Coach notes"
                      value={exercise.notes}
                      onChange={(event) => handleExerciseChange(index, 'notes', event.target.value)}
                      className="notes-textarea"
                      rows="2"
                    />
                  </div>
                ) : (
                  <div className="exercise-display">
                    <div className="exercise-header">
                      <h4>{exercise.name || 'Exercise'}</h4>
                      <label className="completed-checkbox">
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={(event) => handleAthleteResultChange(index, 'completed', event.target.checked)}
                        />
                        <span>Completed</span>
                      </label>
                    </div>
                    <div className="form-grid">
                      <div className="detail-item">
                        <span className="label">Sets</span>
                        <span className="value">{exercise.sets || 'n/a'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Reps</span>
                        <span className="value">{exercise.reps || 'n/a'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Intensity</span>
                        <span className="value">{exercise.intensity || 'n/a'}</span>
                      </div>
                    </div>
                    {exercise.notes && (
                      <div className="coach-notes">
                        <strong>Coach notes:</strong> {exercise.notes}
                      </div>
                    )}
                    <div className="form-row result-row">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Actual result (e.g. 75x2)"
                        value={athleteResult?.result || ''}
                        onChange={(event) => handleAthleteResultChange(index, 'result', event.target.value)}
                      />
                    </div>
                    <textarea
                      placeholder="Athlete notes"
                      value={athleteResult?.athlete_notes || ''}
                      onChange={(event) => handleAthleteResultChange(index, 'athlete_notes', event.target.value)}
                      className="athlete-notes"
                      rows="2"
                    />
                  </div>
                )}
              </div>
            )
          })}

          {isCoach && (
            <button type="button" onClick={handleAddExercise} className="add-exercise-btn">
              + Add Exercise
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default WorkoutDay
