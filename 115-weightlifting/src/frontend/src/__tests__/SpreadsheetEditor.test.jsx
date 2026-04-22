import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SpreadsheetEditor from '../components/SpreadsheetEditor'

const programFixture = {
  week_start_date: '2026-04-21',
  days: [
    {
      day: 'Monday',
      exercises: [
        {
          name: 'Snatch', sets: '5', reps: '2',
          percent_1rm: '75%', rpe: '', weight: '',
          tempo: '3-1-X-1', rest: '2min', notes: '',
          week: '1',
        },
      ],
    },
    {
      day: 'Tuesday',
      exercises: [
        {
          name: 'Clean & Jerk', sets: '5', reps: '1+1',
          percent_1rm: '80%', rpe: '', weight: '',
          tempo: '', rest: '2min', notes: '',
          week: '1',
        },
      ],
    },
  ],
}

describe('SpreadsheetEditor', () => {
  it('renders one row per exercise with all expanded columns populated', () => {
    render(<SpreadsheetEditor programData={programFixture} onChange={() => {}} />)
    expect(screen.getByDisplayValue('Snatch')).toBeTruthy()
    expect(screen.getByDisplayValue('Clean & Jerk')).toBeTruthy()
    expect(screen.getByDisplayValue('3-1-X-1')).toBeTruthy()
    expect(screen.getAllByDisplayValue('2min').length).toBeGreaterThan(0)
  })

  it('emits updated program_data preserving all expanded fields when a cell changes', () => {
    const onChange = vi.fn()
    render(<SpreadsheetEditor programData={programFixture} onChange={onChange} />)
    const snatchInput = screen.getByDisplayValue('Snatch')
    fireEvent.change(snatchInput, { target: { value: 'Power Snatch' } })

    const nextProgram = onChange.mock.calls.at(-1)[0]
    const firstExercise = nextProgram.days[0].exercises[0]
    expect(firstExercise.name).toBe('Power Snatch')
    expect(firstExercise.percent_1rm).toBe('75%')
    expect(firstExercise.tempo).toBe('3-1-X-1')
    expect(firstExercise.rest).toBe('2min')
    expect(firstExercise.intensity).toBe('75%') // legacy alias populated
  })

  it('drops padding rows without an exercise name on serialize', () => {
    const onChange = vi.fn()
    render(<SpreadsheetEditor programData={programFixture} onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    // Default intensityMode=percent_1rm hides RPE and Weight, so grid has 9
    // columns (week, day, exercise, sets, reps, % 1RM, tempo, rest, notes).
    // Real rows: 2. Padding starts at 2*9; day-cell offset is +1.
    const paddingDayInput = inputs[2 * 9 + 1]
    fireEvent.change(paddingDayInput, { target: { value: 'Friday' } })
    const nextProgram = onChange.mock.calls.at(-1)[0]
    const fridayDay = nextProgram.days.find((d) => d.day === 'Friday')
    expect(fridayDay).toBeDefined()
    expect(fridayDay.exercises).toEqual([])
  })

  it('respects intensityMode=percent_1rm: shows % 1RM, hides RPE and Weight', () => {
    render(<SpreadsheetEditor programData={programFixture} onChange={() => {}} intensityMode="percent_1rm" />)
    const headers = Array.from(document.querySelectorAll('.spreadsheet-editor-table th'))
      .map((el) => el.textContent)
    expect(headers).toContain('% 1RM')
    expect(headers).not.toContain('RPE')
    expect(headers).not.toContain('Weight')
  })

  it('respects intensityMode=rpe: shows RPE only', () => {
    render(<SpreadsheetEditor programData={programFixture} onChange={() => {}} intensityMode="rpe" />)
    const headers = Array.from(document.querySelectorAll('.spreadsheet-editor-table th'))
      .map((el) => el.textContent)
    expect(headers).toContain('RPE')
    expect(headers).not.toContain('% 1RM')
    expect(headers).not.toContain('Weight')
  })

  it('respects intensityMode=weight: shows Weight only', () => {
    render(<SpreadsheetEditor programData={programFixture} onChange={() => {}} intensityMode="weight" />)
    const headers = Array.from(document.querySelectorAll('.spreadsheet-editor-table th'))
      .map((el) => el.textContent)
    expect(headers).toContain('Weight')
    expect(headers).not.toContain('% 1RM')
    expect(headers).not.toContain('RPE')
  })
})
