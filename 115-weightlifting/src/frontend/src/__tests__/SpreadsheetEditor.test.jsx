import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SpreadsheetEditor from '../components/SpreadsheetEditor'

const programFixture = {
  week_start_date: '2026-04-21',
  days: [
    { day: 'Monday', exercises: [{ name: 'Snatch', sets: '5', reps: '2', intensity: '75%', notes: '' }] },
    { day: 'Tuesday', exercises: [{ name: 'Clean & Jerk', sets: '5', reps: '1+1', intensity: '80%', notes: '' }] },
  ],
}

describe('SpreadsheetEditor', () => {
  it('renders one row per exercise plus empty padding rows', () => {
    render(<SpreadsheetEditor programData={programFixture} onChange={() => {}} />)
    const snatchInput = screen.getByDisplayValue('Snatch')
    const cjInput = screen.getByDisplayValue('Clean & Jerk')
    expect(snatchInput).toBeTruthy()
    expect(cjInput).toBeTruthy()
  })

  it('emits updated program_data when a cell changes', () => {
    const onChange = vi.fn()
    render(<SpreadsheetEditor programData={programFixture} onChange={onChange} />)
    const snatchInput = screen.getByDisplayValue('Snatch')
    fireEvent.change(snatchInput, { target: { value: 'Power Snatch' } })
    expect(onChange).toHaveBeenCalled()
    const nextProgram = onChange.mock.calls.at(-1)[0]
    expect(nextProgram.days[0].exercises[0].name).toBe('Power Snatch')
  })

  it('drops rows without an exercise name on serialize', () => {
    const onChange = vi.fn()
    render(<SpreadsheetEditor programData={programFixture} onChange={onChange} />)
    // Fill a padding row's day but not exercise -> that row should not persist.
    const inputs = screen.getAllByRole('textbox')
    // The first padding row starts after Monday (1 exercise) + Tuesday (1 exercise) = 2 real rows.
    // Each row has 6 columns. Padding row 1 first cell index = 2 * 6 = 12.
    const paddingDayInput = inputs[12]
    fireEvent.change(paddingDayInput, { target: { value: 'Friday' } })
    const nextProgram = onChange.mock.calls.at(-1)[0]
    const fridayDay = nextProgram.days.find((d) => d.day === 'Friday')
    expect(fridayDay).toBeDefined()
    expect(fridayDay.exercises).toEqual([])
  })
})
