import * as XLSX from 'xlsx'
import XLSXStyle from 'xlsx-js-style'

// Canonical program-template schema. Expanded to match what serious Olympic
// weightlifting coaches actually track (Catalyst Athletics, Takano, Pendlay,
// TrainHeroic, TrueCoach). Required fields: day, exercise, sets, reps. The
// three intensity columns are alternatives -- a coach only fills in whichever
// notation they prefer. Tempo / rest / notes are optional.
export const PROGRAM_TEMPLATE_COLUMNS = [
  'week',
  'day',
  'exercise',
  'sets',
  'reps',
  'percent_1rm',
  'rpe',
  'weight',
  'tempo',
  'rest',
  'notes',
]

export const PROGRAM_TEMPLATE_SHEET = 'Program'
export const INSTRUCTIONS_SHEET = 'Instructions'

const COLUMN_META = [
  { key: 'week', label: 'Week', width: 6, hint: 'Week number in the block (1, 2, 3 ...). Leave blank for a single-week program.' },
  { key: 'day', label: 'Day', width: 12, hint: 'Monday, Tuesday, Day 1, etc. Rows with the same day are grouped together.' },
  { key: 'exercise', label: 'Exercise', width: 24, hint: 'Snatch, Clean & Jerk, Back Squat, Snatch + OHS (complexes are fine as one string).' },
  { key: 'sets', label: 'Sets', width: 6, hint: 'Number of working sets.' },
  { key: 'reps', label: 'Reps', width: 10, hint: 'Reps per set. Supports Olympic complex notation (1+1, 2+1, 3+pause).' },
  { key: 'percent_1rm', label: '% 1RM', width: 8, hint: 'Intensity as a percentage of one-rep max (75%, 80, 82.5%).' },
  { key: 'rpe', label: 'RPE', width: 6, hint: 'Rate of perceived exertion (1-10). Use instead of or alongside %.' },
  { key: 'weight', label: 'Weight', width: 10, hint: 'Absolute load in kg or lb (100kg, 225lb).' },
  { key: 'tempo', label: 'Tempo', width: 10, hint: 'Eccentric-pause-concentric-top (3-1-X-1). Leave blank if not prescribed.' },
  { key: 'rest', label: 'Rest', width: 8, hint: 'Inter-set rest (2min, 90s).' },
  { key: 'notes', label: 'Notes', width: 32, hint: 'Coach cues, technique reminders, warmup notes.' },
]

// Realistic 4-day microcycle sample so coaches immediately see how to use the
// different intensity columns, tempo, and Olympic complex notation.
const TEMPLATE_SAMPLE_ROWS = [
  { week: 1, day: 'Monday', exercise: 'Snatch', sets: 5, reps: 2, percent_1rm: '75%', rpe: '', weight: '', tempo: '', rest: '2min', notes: 'Fast turnover' },
  { week: 1, day: 'Monday', exercise: 'Snatch Pull', sets: 4, reps: 3, percent_1rm: '90%', rpe: '', weight: '', tempo: '', rest: '2min', notes: '' },
  { week: 1, day: 'Monday', exercise: 'Back Squat', sets: 4, reps: 5, percent_1rm: '80%', rpe: '', weight: '', tempo: '3-1-X-1', rest: '3min', notes: 'Slow down, explosive up' },
  { week: 1, day: 'Tuesday', exercise: 'Clean & Jerk + OHS', sets: 5, reps: '1+1+1', percent_1rm: '78%', rpe: '', weight: '', tempo: '', rest: '2-3min', notes: 'Complex: clean, jerk, OHS' },
  { week: 1, day: 'Tuesday', exercise: 'Front Squat', sets: 4, reps: 3, percent_1rm: '82%', rpe: '', weight: '', tempo: '', rest: '3min', notes: '' },
  { week: 1, day: 'Wednesday', exercise: 'Power Snatch', sets: 5, reps: 2, percent_1rm: '', rpe: 7, weight: '', tempo: '', rest: '90s', notes: 'Speed day, stop at RPE 7' },
  { week: 1, day: 'Thursday', exercise: 'Snatch', sets: 4, reps: 1, percent_1rm: '85%', rpe: '', weight: '', tempo: '', rest: '2min', notes: 'Heavy singles' },
  { week: 1, day: 'Thursday', exercise: 'Clean & Jerk', sets: 4, reps: 1, percent_1rm: '85%', rpe: '', weight: '', tempo: '', rest: '2min', notes: '' },
  { week: 1, day: 'Thursday', exercise: 'Deadlift', sets: 3, reps: 5, percent_1rm: '', rpe: '', weight: '180kg', tempo: '', rest: '3min', notes: 'Use absolute weight if preferred' },
]

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFFFF' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'FF0F3A5F' } },
  alignment: { vertical: 'center', horizontal: 'left' },
  border: {
    top: { style: 'thin', color: { rgb: 'FF1E4E7F' } },
    bottom: { style: 'thin', color: { rgb: 'FF1E4E7F' } },
    left: { style: 'thin', color: { rgb: 'FF1E4E7F' } },
    right: { style: 'thin', color: { rgb: 'FF1E4E7F' } },
  },
}

const SAMPLE_ROW_STYLE = {
  font: { italic: true, color: { rgb: 'FF666666' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFF3F6FA' } },
}

const INSTRUCTIONS_TITLE_STYLE = {
  font: { bold: true, sz: 14, color: { rgb: 'FF0F3A5F' } },
  alignment: { vertical: 'center' },
}

const INSTRUCTIONS_HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFE6EEF7' } },
  border: {
    bottom: { style: 'thin', color: { rgb: 'FF1E4E7F' } },
  },
}

const buildProgramSheet = () => {
  const worksheet = XLSXStyle.utils.aoa_to_sheet([
    COLUMN_META.map((c) => c.label),
    ...TEMPLATE_SAMPLE_ROWS.map((row) => COLUMN_META.map((c) => row[c.key] ?? '')),
  ])

  // Column widths so the opened file is readable without resizing.
  worksheet['!cols'] = COLUMN_META.map((c) => ({ wch: c.width }))

  // Freeze the header row so scrolling keeps column labels visible.
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 }
  worksheet['!views'] = [{ state: 'frozen', ySplit: 1, xSplit: 0 }]

  // Style header row and sample rows. Cell addresses are A1, B1, ... then A2, A3 ...
  for (let c = 0; c < COLUMN_META.length; c += 1) {
    const headerAddr = XLSXStyle.utils.encode_cell({ r: 0, c })
    if (worksheet[headerAddr]) {
      worksheet[headerAddr].s = HEADER_STYLE
    }
    for (let r = 1; r <= TEMPLATE_SAMPLE_ROWS.length; r += 1) {
      const addr = XLSXStyle.utils.encode_cell({ r, c })
      if (worksheet[addr]) {
        worksheet[addr].s = SAMPLE_ROW_STYLE
      }
    }
  }

  return worksheet
}

const buildInstructionsSheet = () => {
  const rows = [
    ['115 Weightlifting — Program Template'],
    [],
    ['How to use:'],
    ['1) Open the "Program" sheet.'],
    ['2) Replace the sample rows with your own programming. One row per exercise-on-a-day.'],
    ['3) Required fields: day, exercise, sets, reps. Everything else is optional.'],
    ['4) Save as .xlsx (or export from Google Sheets: File → Download → Microsoft Excel).'],
    ['5) Upload the file in the Coach Dashboard to autofill the builder.'],
    [],
    ['Column reference:'],
    ['Column', 'Purpose'],
    ...COLUMN_META.map((c) => [c.label, c.hint]),
    [],
    ['Intensity convention:'],
    ['You can use ANY of % 1RM, RPE, or Weight. Pick one (or mix as needed per exercise).'],
    ['Coaches from the Catalyst / USSR tradition tend to use % 1RM. RPE is popular with'],
    ['newer coaches and works well for autoregulation. Weight is concrete and removes math.'],
    [],
    ['Olympic complex notation:'],
    ['Reps like "1+1+1" or "2+1" represent a single-rep complex (a snatch + overhead'],
    ['squat is "1+1"). Write the exercises in the "exercise" cell joined by a + symbol.'],
    [],
    ['Multi-week programming:'],
    ['Use the "week" column to separate blocks. Rows with the same week+day value group'],
    ['together in the builder. Leave week blank for a single-week program.'],
  ]

  const worksheet = XLSXStyle.utils.aoa_to_sheet(rows)
  worksheet['!cols'] = [{ wch: 18 }, { wch: 70 }]

  // Title
  if (worksheet['A1']) worksheet['A1'].s = INSTRUCTIONS_TITLE_STYLE
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]

  // Section headers + column reference header
  const sectionHeaderRows = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => row.length === 1 && typeof row[0] === 'string' && row[0].endsWith(':'))
    .map(({ idx }) => idx)

  for (const idx of sectionHeaderRows) {
    const addr = XLSXStyle.utils.encode_cell({ r: idx, c: 0 })
    if (worksheet[addr]) {
      worksheet[addr].s = INSTRUCTIONS_HEADER_STYLE
    }
  }

  // Column-reference table header row (the "Column | Purpose" row)
  const refHeaderRow = rows.findIndex((r) => r[0] === 'Column' && r[1] === 'Purpose')
  if (refHeaderRow >= 0) {
    for (let c = 0; c <= 1; c += 1) {
      const addr = XLSXStyle.utils.encode_cell({ r: refHeaderRow, c })
      if (worksheet[addr]) {
        worksheet[addr].s = INSTRUCTIONS_HEADER_STYLE
      }
    }
  }

  return worksheet
}

export const buildTemplateWorkbook = () => {
  const workbook = XLSXStyle.utils.book_new()
  XLSXStyle.utils.book_append_sheet(workbook, buildInstructionsSheet(), INSTRUCTIONS_SHEET)
  XLSXStyle.utils.book_append_sheet(workbook, buildProgramSheet(), PROGRAM_TEMPLATE_SHEET)
  return workbook
}

export const downloadTemplateXlsx = (filename) => {
  const workbook = buildTemplateWorkbook()
  const fallbackName = `115wl_program_template_${new Date().toISOString().split('T')[0]}.xlsx`
  XLSXStyle.writeFile(workbook, filename || fallbackName)
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

  // Prefer the sheet literally named "Program"; fall back to the first
  // non-instructions sheet so coaches can name it anything.
  const preferredSheet = workbook.SheetNames.includes(PROGRAM_TEMPLATE_SHEET)
    ? PROGRAM_TEMPLATE_SHEET
    : workbook.SheetNames.find((name) => name !== INSTRUCTIONS_SHEET) || workbook.SheetNames[0]
  const sheet = workbook.Sheets[preferredSheet]

  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
  if (!rawRows.length) {
    throw new Error(`Sheet "${preferredSheet}" is empty.`)
  }

  const rows = normalizeRows(rawRows)
  if (!rows.length) {
    throw new Error(
      'No usable rows. Expected columns: ' + PROGRAM_TEMPLATE_COLUMNS.join(', ') + '.'
    )
  }

  // Group rows by day in the order they appear. Week is preserved per-exercise
  // so the builder can choose to surface multi-week blocks later.
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
      percent_1rm: row.percent_1rm,
      rpe: row.rpe,
      weight: row.weight,
      tempo: row.tempo,
      rest: row.rest,
      // Backwards-compatible with existing backend/UI that still key on
      // `intensity`. Prefer % 1RM, fall back to RPE, then weight.
      intensity: row.percent_1rm || row.rpe || row.weight || '',
      notes: row.notes,
      week: row.week,
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
// no day. All numeric-ish fields coerced to strings so downstream normalization
// treats them uniformly.
const normalizeRows = (rawRows) => {
  const lowered = rawRows.map((row) => {
    const out = {}
    for (const [key, value] of Object.entries(row)) {
      const normalized = String(key).trim().toLowerCase()
      // Accept "% 1RM" / "%1rm" / "pct_1rm" variants as percent_1rm.
      if (normalized === '% 1rm' || normalized === '%1rm' || normalized === 'pct_1rm' || normalized === 'percent') {
        out.percent_1rm = value
      } else {
        out[normalized] = value
      }
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
      week: String(row.week ?? '').trim(),
      day: String(row.day).trim(),
      exercise: String(row.exercise).trim(),
      sets: String(row.sets ?? '').trim(),
      reps: String(row.reps ?? '').trim(),
      percent_1rm: String(row.percent_1rm ?? '').trim(),
      rpe: String(row.rpe ?? '').trim(),
      weight: String(row.weight ?? '').trim(),
      tempo: String(row.tempo ?? '').trim(),
      rest: String(row.rest ?? '').trim(),
      notes: String(row.notes ?? '').trim(),
    }))
}
