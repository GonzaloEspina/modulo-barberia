import { describe, expect, it } from 'vitest'
import {
  applyScheduleExceptions,
  generateAvailableSlots,
  parseTimeToMinutes,
  subtractMinuteRange,
  windowsFromPairs,
} from '@/lib/availability'

describe('parseTimeToMinutes', () => {
  it('convierte HH:MM a minutos', () => {
    expect(parseTimeToMinutes('10:30')).toBe(630)
    expect(parseTimeToMinutes('14:00')).toBe(840)
  })
})

describe('generateAvailableSlots', () => {
  const morning = { start: parseTimeToMinutes('10:00'), end: parseTimeToMinutes('13:00') }
  const afternoon = { start: parseTimeToMinutes('14:00'), end: parseTimeToMinutes('20:00') }

  it('genera slots dentro de la jornada', () => {
    const slots = generateAvailableSlots([morning], 30, 15)
    expect(slots.length).toBeGreaterThan(0)
    expect(slots[0].start).toBe(morning.start)
    expect(slots.every((s) => s.end <= morning.end)).toBe(true)
  })

  it('no atraviesa descanso entre bloques', () => {
    const slots = generateAvailableSlots([morning, afternoon], 45, 15)
    const crossesBreak = slots.some(
      (s) => s.start < morning.end && s.end > afternoon.start,
    )
    expect(crossesBreak).toBe(false)
  })

  it('no ofrece slots fuera de jornada', () => {
    const slots = generateAvailableSlots([morning], 30, 15)
    expect(slots.every((s) => s.start >= morning.start && s.end <= morning.end)).toBe(true)
  })

  it('excluye slots que solapan turnos ocupados', () => {
    const busy = [{ start: parseTimeToMinutes('10:00'), end: parseTimeToMinutes('10:30') }]
    const slots = generateAvailableSlots([morning], 30, 15, busy)
    expect(slots.some((s) => s.start === parseTimeToMinutes('10:00'))).toBe(false)
    expect(slots.some((s) => s.start === parseTimeToMinutes('10:30'))).toBe(true)
  })
})

describe('subtractMinuteRange', () => {
  it('recorta ventana con bloqueo parcial', () => {
    const base = windowsFromPairs([600, 840])
    const result = subtractMinuteRange(base, 660, 720)
    expect(result).toEqual([
      { start: 600, end: 660 },
      { start: 720, end: 840 },
    ])
  })
})

describe('applyScheduleExceptions', () => {
  it('bloqueo de día completo elimina ventanas', () => {
    const base = windowsFromPairs([600, 840, 840, 1200])
    const result = applyScheduleExceptions(base, [
      { exception_type: 'block', start_time: null, end_time: null },
    ])
    expect(result).toHaveLength(0)
  })

  it('excepción allow agrega ventana en día cerrado', () => {
    const result = applyScheduleExceptions([], [
      {
        exception_type: 'allow',
        start_time: '16:00:00',
        end_time: '18:00:00',
      },
    ])
    expect(result).toEqual([{ start: 960, end: 1080 }])
  })
})
