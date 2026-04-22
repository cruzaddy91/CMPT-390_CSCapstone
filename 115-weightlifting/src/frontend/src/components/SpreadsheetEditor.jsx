import { useMemo, useRef } from 'react'

// Columns match the xlsx template schema 1:1 so what coaches see here is what
// they'd see in Excel. Each row = one exercise on one day.
const COLUMNS = [
  { key: 'day', label: 'Day', width: '10rem' },
  { key: 'name', label: 'Exercise', width: '14rem' },
  { key: 'sets', label: 'Sets', width: '5rem' },
  { key: 'reps', label: 'Reps', width: '6rem' },
  { key: 'intensity', label: 'Intensity', width: '7rem' },
  { key: 'notes', label: 'Notes', width: '16rem' },
]

const EMPTY_ROW_PAD = 3 // always render this many blank rows at the bottom for quick entry

const programDataToRows = (programData) => {
  if (!programData?.days) return []
  const rows = []
  programData.days.forEach((day) => {
    if (!day.exercises || day.exercises.length === 0) {
      rows.push({ day: day.day, name: '', sets: '', reps: '', intensity: '', notes: '' })
    } else {
      day.exercises.forEach((exercise) => {
        rows.push({
          day: day.day,
          name: exercise.name || '',
          sets: exercise.sets || '',
          reps: exercise.reps || '',
          intensity: exercise.intensity || '',
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
    grouped.get(day).push({
      name: exerciseName,
      sets: String(row.sets ?? '').trim(),
      reps: String(row.reps ?? '').trim(),
      intensity: String(row.intensity ?? '').trim(),
      notes: String(row.notes ?? '').trim(),
    })
  })
  return {
    week_start_date: weekStartDate || new Date().toISOString().split('T')[0],
    days: dayOrder.map((day) => ({ day, exercises: grouped.get(day) || [] })),
  }
}

const SpreadsheetEditor = ({ programData, onChange }) => {
  const weekStartDate = programData?.week_start_date
  const baseRows = useMemo(() => programDataToRows(programData), [programData])

  // Always show a buffer of empty rows for quick entry. They get filtered out
  // on serialize so they never corrupt the program_data shape.
  const displayRows = useMemo(() => {
    const padded = [...baseRows]
    for (let i = 0; i < EMPTY_ROW_PAD; i += 1) {
      padded.push({ day: '', name: '', sets: '', reps: '', intensity: '', notes: '' })
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
        targetCol = COLUMNS.length - 1
        targetRow -= 1
      } else if (targetCol >= COLUMNS.length) {
        targetCol = 0
        targetRow += 1
      }
    }
    const inputs = tableRef.current?.querySelectorAll('input[data-cell]')
    if (!inputs) return
    const targetIndex = targetRow * COLUMNS.length + targetCol
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
              {COLUMNS.map((col) => (
                <th key={col.key} style={{ width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {COLUMNS.map((col, columnIndex) => (
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
