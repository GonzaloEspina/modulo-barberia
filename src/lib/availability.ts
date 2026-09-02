export interface MinuteWindow {
  start: number
  end: number
}

export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function windowsFromPairs(pairs: number[]): MinuteWindow[] {
  const windows: MinuteWindow[] = []
  for (let i = 0; i < pairs.length; i += 2) {
    const start = pairs[i]
    const end = pairs[i + 1]
    if (end > start) windows.push({ start, end })
  }
  return windows
}

export function windowsToPairs(windows: MinuteWindow[]): number[] {
  return windows.flatMap((w) => [w.start, w.end])
}

export function subtractMinuteRange(
  windows: MinuteWindow[],
  blockStart: number,
  blockEnd: number,
): MinuteWindow[] {
  const result: MinuteWindow[] = []

  for (const window of windows) {
    if (blockEnd <= window.start || blockStart >= window.end) {
      result.push(window)
      continue
    }

    if (blockStart > window.start) {
      result.push({ start: window.start, end: Math.min(blockStart, window.end) })
    }
    if (blockEnd < window.end) {
      result.push({ start: Math.max(blockEnd, window.start), end: window.end })
    }
  }

  return result.filter((w) => w.end > w.start)
}

export function applyScheduleExceptions(
  baseWindows: MinuteWindow[],
  exceptions: Array<{
    exception_type: 'block' | 'allow'
    start_time: string | null
    end_time: string | null
  }>,
): MinuteWindow[] {
  let windows = [...baseWindows]

  for (const ex of exceptions) {
    const start = ex.start_time ? parseTimeToMinutes(ex.start_time) : 0
    const end = ex.end_time ? parseTimeToMinutes(ex.end_time) : 24 * 60

    if (ex.exception_type === 'block') {
      windows = subtractMinuteRange(windows, start, end)
    } else {
      windows.push({ start, end })
    }
  }

  return windows.filter((w) => w.end > w.start)
}

export interface BusyRange {
  start: number
  end: number
}

export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && aEnd > bStart
}

export function generateAvailableSlots(
  windows: MinuteWindow[],
  durationMinutes: number,
  intervalMinutes: number,
  busyRanges: BusyRange[] = [],
): Array<{ start: number; end: number }> {
  const slots: Array<{ start: number; end: number }> = []

  for (const window of windows) {
    if (window.end - window.start < durationMinutes) continue

    let slotStart = window.start
    while (slotStart + durationMinutes <= window.end) {
      const slotEnd = slotStart + durationMinutes
      const overlaps = busyRanges.some((busy) => rangesOverlap(slotStart, slotEnd, busy.start, busy.end))

      if (!overlaps) {
        slots.push({ start: slotStart, end: slotEnd })
      }

      slotStart += intervalMinutes
    }
  }

  return slots
}
