import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  getBarberDayBlocks,
  getBarberDayMode,
  useBarberScheduleMutations,
  useBarberSchedules,
  type BarberDayMode,
} from '@/features/barbers/barber-schedules-api'
import { ScheduleBlocksEditor } from '@/features/schedules/schedule-blocks-editor'
import { notifyError } from '@/lib/notify'
import type { BarberRecord } from '@/types/barber'
import { ISO_DAYS, formatTimeRange, getDayLabel } from '@/types/schedule'
import type { ScheduleBlockInput } from '@/types/schedule'

interface BarberSchedulesPanelProps {
  barber: BarberRecord
}

interface DayDraft {
  mode: BarberDayMode
  blocks: ScheduleBlockInput[]
}

export function BarberSchedulesPanel({ barber }: BarberSchedulesPanelProps) {
  const { data: schedules, isLoading } = useBarberSchedules(barber.id)
  const { saveDay, clearDay } = useBarberScheduleMutations(barber.id)
  const [drafts, setDrafts] = useState<Record<number, DayDraft>>({})

  const getDraft = (day: number): DayDraft => {
    if (drafts[day]) return drafts[day]
    const mode = getBarberDayMode(day, schedules ?? [], barber.use_general_schedules)
    return {
      mode,
      blocks: getBarberDayBlocks(day, schedules ?? []),
    }
  }

  const updateDraft = (day: number, patch: Partial<DayDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [day]: { ...getDraft(day), ...patch },
    }))
  }

  const savedSummary = useMemo(() => {
    return ISO_DAYS.map(({ value: day }) => {
      const mode = getBarberDayMode(day, schedules ?? [], barber.use_general_schedules)
      const blocks = getBarberDayBlocks(day, schedules ?? [])
      return { day, mode, blocks }
    })
  }, [barber.use_general_schedules, schedules])

  const handleSave = async (day: number) => {
    const draft = getDraft(day)
    try {
      if (draft.mode === 'general') {
        await clearDay.mutateAsync(day)
      } else {
        await saveDay.mutateAsync({
          dayOfWeek: day,
          mode: draft.mode,
          blocks: draft.blocks,
        })
      }
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[day]
        return next
      })
    } catch (err) {
      notifyError((err as Error).message)
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Cargando horarios del barbero…</p>
  }

  return (
    <Card className="min-w-0 gap-0 overflow-hidden rounded-xl py-0">
      <div className="border-b px-3 py-2.5">
        <p className="text-sm font-medium">Horarios</p>
        <p className="text-muted-foreground text-xs">
          {barber.use_general_schedules
            ? 'Hereda los horarios generales. Podés cerrar un día o personalizar bloques.'
            : 'No hereda horarios generales: configurá cada día laborable.'}
        </p>
      </div>
      <div className="divide-y">
        {ISO_DAYS.map(({ value: day }) => {
          const draft = getDraft(day)
          const saved = savedSummary.find((s) => s.day === day)
          const hasChanges =
            day in drafts ||
            draft.mode !== saved?.mode ||
            JSON.stringify(draft.blocks) !== JSON.stringify(saved?.blocks ?? [])

          return (
            <div key={day} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <p className="w-24 shrink-0 text-sm font-medium">{getDayLabel(day)}</p>
                <select
                  className="border-input bg-background h-8 min-w-0 flex-1 rounded-md border px-2 text-sm"
                  value={draft.mode}
                  onChange={(e) =>
                    updateDraft(day, { mode: e.target.value as BarberDayMode })
                  }
                >
                  {barber.use_general_schedules && (
                    <option value="general">Horario general</option>
                  )}
                  <option value="custom">Personalizado</option>
                  <option value="closed">No laborable</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={!hasChanges || saveDay.isPending || clearDay.isPending}
                  onClick={() => void handleSave(day)}
                >
                  Guardar
                </Button>
              </div>

              {draft.mode === 'custom' && (
                <div className="mt-2">
                  <ScheduleBlocksEditor
                    blocks={draft.blocks}
                    onChange={(blocks) => updateDraft(day, { blocks })}
                  />
                </div>
              )}

              {draft.mode === 'custom' && draft.blocks.length > 0 && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {draft.blocks.map((b) => formatTimeRange(b.start_time, b.end_time)).join(' · ')}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
