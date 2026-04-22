import { useMemo, useRef } from 'react'

// Columns match the xlsx template schema 1:1 so what coaches see here is what
// they'd see in Excel. Each row = one exercise on one day.
const ALL_COLUMNS = [
  { key: 'week', label: 'Week', width: '4rem' },
  { key: 'day', label: 'Day', width: '9rem' },
  { key: 'name', label: 'Exercise', width: '14rem' },
  { key: 'sets', label: 'Sets', width: '4rem' },
  { key: 'reps', label: 'Reps', width: '6rem' },
  { key: 'percent_1rm', label: '% 1RM', width: '5rem' },
  { key: 'rpe', label: 'RPE', width: '4rem' },
  { key: 'weight', label: 'Weight', width: '6rem' },
  { key: 'tempo', label: 'Tempo', width: '6rem' },
  { key: 'rest', label: 'Rest', width: '5rem' },
  { key: 'notes', label: 'Notes', width: '16rem' },
]

// Match the Card View behavior: when an intensity mode is chosen, hide the
// other two intensity columns. Hidden cells keep their data (only the coach's
// display preference filters), so switching modes never loses input.
const columnsForMode = (mode) => {
  const hide = new Set()
  if (mode === 'percent_1rm') { hide.add('rpe'); hide.add('weight') }
  if (mode === 'rpe')         { hide.add('percent_1rm'); hide.add('weight') }
  if (mode === 'weight')      { hide.add('percent_1rm'); hide.add('rpe') }
  return ALL_COLUMNS.filter((c) => !hide.has(c.key))
}

const EMPTY_ROW_PAD = 3 // always render this many blank rows at the bottom for quick entry

const programDataToRows = (programData) => {
  if (!programData?.days) return []
  const rows = []
  programData.days.forEach((day) => {
    if (!day.exercises || day.exercises.length === 0) {
      rows.push({
        week: '', day: day.day, name: '', sets: '', reps: '',
        percent_1rm: '', rpe: '', weight: '', tempo: '', rest: '', notes: '',
      })
    } else {
      day.exercises.forEach((exercise) => {
        rows.push({
          week: exercise.week || '',
          day: day.day,
          name: exercise.name || '',
          sets: exercise.sets || '',
          reps: exercise.reps || '',
          percent_1rm: exercise.percent_1rm || '',
          rpe: exercise.rpe || '',
          weight: exercise.weight || '',
          tempo: exercise.tempo || '',
          rest: exercise.rest || '',
          notes: exercise.notes || '',
        })
      })
    }
  })
  return rows
}

const rowsToProgramData = (rows, weekStartDate) => {
  const dayOrder = []
  const grouped = new Map()
  rows.forEach((row) => {
    const day = String(row.day || '').trim()
    const exerciseName = String(row.name || '').trim()
    if (!day) return
    if (!grouped.has(day)) {
      grouped.set(day, [])
      dayOrder.push(day)
    }
    // Only persist rows with an actual exercise name; fully-empty rows are
    // UI padding. But preserve empty day shells so coaches can leave rest
    // days in the plan.
    if (!exerciseName) return
    const percent = String(row.percent_1rm ?? '').trim()
    const rpe = String(row.rpe ?? '').trim()
    const weight = String(row.weight ?? '').trim()
    grouped.get(day).push({
      name: exerciseName,
      sets: String(row.sets ?? '').trim(),
      reps: String(row.reps ?? '').trim(),
      percent_1rm: percent,
      rpe,
      weight,
      tempo: String(row.tempo ?? '').trim(),
      rest: String(row.rest ?? '').trim(),
      // Legacy field preserved for backwards-compat with any consumer that
      // still keys on `intensity`. Prefer % 1RM, then RPE, then weight.
      intensity: percent || rpe || weight,
      notes: String(row.notes ?? '').trim(),
      week: String(row.week ?? '').trim(),
    })
  })
  return {
    week_start_date: weekStartDate || new Date().toISOString().split('T')[0],
    days: dayOrder.map((day) => ({ day, exercises: grouped.get(day) || [] })),
  }
}

const SpreadsheetEditor = ({ programData, onChange, intensityMode = 'percent_1rm' }) => {
  const weekStartDate = programData?.week_start_date
  const baseRows = useMemo(() => programDataToRows(programData), [programData])
  const columns = useMemo(() => columnsForMode(intensityMode), [intensityMode])

  // Always show a buffer of empty rows for quick entry. They get filtered out
  // on serialize so they never corrupt the program_data shape.
  const displayRows = useMemo(() => {
    const padded = [...baseRows]
    for (let i = 0; i < EMPTY_ROW_PAD; i += 1) {
      padded.push({
        week: '', day: '', name: '', sets: '', reps: '',
        percent_1rm: '', rpe: '', weight: '', tempo: '', rest: '', notes: '',
      })
    }
    return padded
  }, [baseRows])

  const tableRef = useRef(null)

  const handleCellChange = (rowIndex, columnKey, value) => {
    const next = displayRows.map((row, i) =>
      i === rowIndex ? { ...row, [columnKey]: value } : row
    )
    onChange(rowsToProgramData(next, weekStartDate))
  }

  // Arrow/enter navigation to move between cells like Excel.
  const handleKeyDown = (event, rowIndex, columnIndex) => {
    const key = event.key
    const shouldMove = ['ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(key)
    if (!shouldMove) return
    let targetRow = rowIndex
    let targetCol = columnIndex
    if (key === 'ArrowUp') targetRow -= 1
    else if (key === 'ArrowDown' || key === 'Enter') targetRow += 1
    else if (key === 'Tab') {
      event.preventDefault()
      targetCol = event.shiftKey ? columnIndex - 1 : columnIndex + 1
      if (targetCol < 0) {
        targetCol = columns.length - 1
        targetRow -= 1
      } else if (targetCol >= columns.length) {
        targetCol = 0
        targetRow += 1
      }
    }
    const inputs = tableRef.current?.querySelectorAll('input[data-cell]')
    if (!inputs) return
    const targetIndex = targetRow * columns.length + targetCol
    const nextInput = inputs[targetIndex]
    if (nextInput) {
      event.preventDefault()
      nextInput.focus()
      nextInput.select?.()
    }
  }

  return (
    <div className="spreadsheet-editor section-card">
      <div className="spreadsheet-editor-hint section-subtitle">
        Spreadsheet view: keyboard nav with Tab / Enter / arrows. Rows without a day or exercise are ignored on save.
      </div>
      <div className="spreadsheet-editor-scroll">
        <table ref={tableRef} className="spreadsheet-editor-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col, columnIndex) => (
                  <td key={col.key}>
                    <input
                      data-cell
                      type="text"
                      value={row[col.key] ?? ''}
                      onChange={(event) => handleCellChange(rowIndex, col.key, event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, rowIndex, columnIndex)}
                      placeholder={col.key === 'day' && rowIndex >= baseRows.length ? 'Monday' : ''}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SpreadsheetEditor
