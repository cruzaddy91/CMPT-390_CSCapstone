const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export const createEmptyExercise = () => ({
  name: '',
  sets: '',
  reps: '',
  intensity: '',
  notes: ''
})

export const createEmptyDay = (day = `Day ${Date.now()}`) => ({
  day,
  exercises: []
})

export const createEmptyWeek = (weekStartDate = new Date().toISOString().split('T')[0]) => ({
  week_start_date: weekStartDate,
  days: WEEKDAY_LABELS.map((day) => createEmptyDay(day))
})

export const normalizeProgramData = (programData, fallbackWeekStartDate = new Date().toISOString().split('T')[0]) => {
  const base = createEmptyWeek(fallbackWeekStartDate)

  if (!programData || typeof programData !== 'object') {
    return base
  }

  return {
    week_start_date: programData.week_start_date || fallbackWeekStartDate,
    days: Array.isArray(programData.days) && programData.days.length > 0
      ? programData.days.map((day, index) => ({
          day: day?.day || `Day ${index + 1}`,
          exercises: Array.isArray(day?.exercises)
            ? day.exercises.map((exercise) => ({
                name: exercise?.name || '',
                sets: exercise?.sets || '',
                reps: exercise?.reps || '',
                intensity: exercise?.intensity || '',
                notes: exercise?.notes || ''
              }))
            : []
        }))
      : base.days
  }
}

export const countExercises = (programData) => {
  if (!programData?.days) return 0
  return programData.days.reduce((total, day) => total + (day.exercises?.length || 0), 0)
}
