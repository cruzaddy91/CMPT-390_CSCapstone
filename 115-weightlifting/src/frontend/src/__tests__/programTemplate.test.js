import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import {
  PROGRAM_TEMPLATE_COLUMNS,
  PROGRAM_TEMPLATE_SHEET,
  buildTemplateWorkbook,
  parseProgramFile,
} from '../utils/programTemplate'

const makeFileFromRows = (rows, sheetName = PROGRAM_TEMPLATE_SHEET) => {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: PROGRAM_TEMPLATE_COLUMNS })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return new File([buffer], 'program.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('programTemplate', () => {
  it('builds a template workbook with the canonical schema', () => {
    const workbook = buildTemplateWorkbook()
    expect(workbook.SheetNames).toContain(PROGRAM_TEMPLATE_SHEET)
    const sheet = workbook.Sheets[PROGRAM_TEMPLATE_SHEET]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    expect(rows.length).toBeGreaterThan(0)
    const firstRow = rows[0]
    for (const column of PROGRAM_TEMPLATE_COLUMNS) {
      expect(Object.prototype.hasOwnProperty.call(firstRow, column)).toBe(true)
    }
  })

  it('parses a round-trip workbook back to program_data shape', async () => {
    const rows = [
      { day: 'Monday', exercise: 'Snatch', sets: 5, reps: 2, intensity: '75%', notes: 'Fast' },
      { day: 'Monday', exercise: 'Back Squat', sets: 4, reps: 5, intensity: '80%', notes: '' },
      { day: 'Tuesday', exercise: 'Clean & Jerk', sets: 5, reps: '1+1', intensity: '80%', notes: '' },
    ]
    const file = makeFileFromRows(rows)
    const result = await parseProgramFile(file)

    expect(result.days.map((d) => d.day)).toEqual(['Monday', 'Tuesday'])
    expect(result.days[0].exercises).toHaveLength(2)
    expect(result.days[0].exercises[0]).toMatchObject({
      name: 'Snatch', sets: '5', reps: '2', intensity: '75%', notes: 'Fast',
    })
    expect(result.days[1].exercises[0].name).toBe('Clean & Jerk')
  })

  it('handles case-insensitive headers and ignores blank rows', async () => {
    const rows = [
      { Day: 'Wednesday', Exercise: 'Deadlift', Sets: 3, Reps: 5, Intensity: '70%', Notes: '' },
      { Day: '', Exercise: '', Sets: '', Reps: '', Intensity: '', Notes: '' },
      { Day: 'Thursday', Exercise: '', Sets: '', Reps: '', Intensity: '', Notes: '' },
    ]
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, PROGRAM_TEMPLATE_SHEET)
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const file = new File([buffer], 'prog.xlsx')

    const result = await parseProgramFile(file)
    expect(result.days).toHaveLength(1)
    expect(result.days[0].day).toBe('Wednesday')
    expect(result.days[0].exercises[0].name).toBe('Deadlift')
  })

  it('falls back to the first sheet when no "Program" sheet exists', async () => {
    const rows = [{ day: 'Friday', exercise: 'Push Press', sets: 4, reps: 5, intensity: '70%', notes: '' }]
    const file = makeFileFromRows(rows, 'MyWeek')
    const result = await parseProgramFile(file)
    expect(result.days[0].day).toBe('Friday')
    expect(result.days[0].exercises[0].name).toBe('Push Press')
  })

  it('throws a readable error on an empty workbook', async () => {
    const workbook = XLSX.utils.book_new()
    const empty = XLSX.utils.json_to_sheet([])
    XLSX.utils.book_append_sheet(workbook, empty, PROGRAM_TEMPLATE_SHEET)
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const file = new File([buffer], 'empty.xlsx')
    await expect(parseProgramFile(file)).rejects.toThrow(/empty/i)
  })
})
