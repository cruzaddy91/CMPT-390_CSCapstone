import * as XLSX from 'xlsx'

// Canonical program-template schema. One xlsx sheet, these columns (header row
// required, case-insensitive). Rows are grouped into days by the `day` column.
// Any column outside this set is ignored. Blank rows tolerated.
export const PROGRAM_TEMPLATE_COLUMNS = ['day', 'exercise', 'sets', 'reps', 'intensity', 'notes']
export const PROGRAM_TEMPLATE_SHEET = 'Program'

// Sample program shipped inside the blank template so coaches can see the
// expected shape at a glance when they open the download.
const TEMPLATE_SAMPLE_ROWS = [
  { day: 'Monday', exercise: 'Snatch', sets: 5, reps: 2, intensity: '75%', notes: 'Fast turnover' },
  { day: 'Monday', exercise: 'Back Squat', sets: 4, reps: 5, intensity: '80%', notes: '' },
  { day: 'Tuesday', exercise: 'Clean & Jerk', sets: 5, reps: '1+1', intensity: '80%', notes: '' },
  { day: 'Tuesday', exercise: 'Front Squat', sets: 4, reps: 3, intensity: '82%', notes: '' },
  { day: 'Wednesday', exercise: 'Snatch Pull', sets: 4, reps: 3, intensity: '90%', notes: '' },
  { day: 'Thursday', exercise: 'Power Clean', sets: 6, reps: 2, intensity: '70%', notes: 'Speed day' },
  { day: 'Friday', exercise: 'Snatch', sets: 4, reps: 1, intensity: '85%', notes: 'Heavy singles' },
  { day: 'Friday', exercise: 'Clean & Jerk', sets: 4, reps: 1, intensity: '85%', notes: '' },
]

export const buildTemplateWorkbook = () => {
  const worksheet = XLSX.utils.json_to_sheet(TEMPLATE_SAMPLE_ROWS, {
    header: PROGRAM_TEMPLATE_COLUMNS,
  })
  worksheet['!cols'] = [
    { wch: 12 }, // day
    { wch: 22 }, // exercise
    { wch: 6 }, // sets
    { wch: 8 }, // reps
    { wch: 12 }, // intensity
    { wch: 28 }, // notes
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, PROGRAM_TEMPLATE_SHEET)
  return workbook
}

export const downloadTemplateXlsx = (filename = 'program_template.xlsx') => {
  const workbook = buildTemplateWorkbook()
  XLSX.writeFile(workbook, filename)
}

// Parses an uploaded File (xlsx/xls/csv/ods) into our program_data shape.
// Throws Error('<readable message>') on anything that does not look like the
// template. Resolves with: { week_start_date, days: [{ day, exercises: [...] }] }.
export const parseProgramFile = async (file) => {
  if (!file) throw new Error('No file provided.')
  // jsdom's File shim doesn't implement arrayBuffer; fall back to FileReader
  // which is present in both jsdom and real browsers.
  const buffer = typeof file.arrayBuffer === 'function'
    ? await file.arrayBuffer()
    : await readFileAsArrayBuffer(file)
  const workbook = XLSX.read(buffer, { type: 'array' })

  if (!workbook.SheetNames.length) {
    throw new Error('Workbook has no sheets.')
  }

  // Prefer the sheet literally named "Program"; fall back to the first sheet
  // so coaches can name it anything.
  const sheetName = workbook.SheetNames.includes(PROGRAM_TEMPLATE_SHEET)
    ? PROGRAM_TEMPLATE_SHEET
    : workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
  if (!rawRows.length) {
    throw new Error(`Sheet "${sheetName}" is empty.`)
  }

  const rows = normalizeRows(rawRows)
  if (!rows.length) {
    throw new Error(
      'No usable rows. Expected columns: ' + PROGRAM_TEMPLATE_COLUMNS.join(', ') + '.'
    )
  }

  // Group rows by day in the order they appear in the sheet so we respect the
  // coach's ordering rather than alphabetizing.
  const dayOrder = []
  const daysByName = new Map()
  for (const row of rows) {
    if (!daysByName.has(row.day)) {
      daysByName.set(row.day, [])
      dayOrder.push(row.day)
    }
    daysByName.get(row.day).push({
      name: row.exercise,
      sets: row.sets,
      reps: row.reps,
      intensity: row.intensity,
      notes: row.notes,
    })
  }

  return {
    week_start_date: new Date().toISOString().split('T')[0],
    days: dayOrder.map((day) => ({ day, exercises: daysByName.get(day) })),
  }
}

const readFileAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'))
    reader.readAsArrayBuffer(file)
  })

// Lower-cases header keys, trims values, drops rows with no exercise name or
// no day. Sets/reps/intensity/notes coerced to strings so downstream
// normalizeProgramData treats them uniformly.
const normalizeRows = (rawRows) => {
  const lowered = rawRows.map((row) => {
    const out = {}
    for (const [key, value] of Object.entries(row)) {
      out[String(key).trim().toLowerCase()] = value
    }
    return out
  })
  return lowered
    .filter((row) => {
      const day = String(row.day || '').trim()
      const exercise = String(row.exercise || '').trim()
      return day && exercise
    })
    .map((row) => ({
      day: String(row.day).trim(),
      exercise: String(row.exercise).trim(),
      sets: String(row.sets ?? '').trim(),
      reps: String(row.reps ?? '').trim(),
      intensity: String(row.intensity ?? '').trim(),
      notes: String(row.notes ?? '').trim(),
    }))
}
