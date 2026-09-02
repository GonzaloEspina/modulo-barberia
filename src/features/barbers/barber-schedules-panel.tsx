import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <Card>
      <CardHeader>
        <CardTitle>Horarios del barbero</CardTitle>
        <CardDescription>
          {barber.use_general_schedules
            ? 'Por defecto hereda los horarios generales. Podés marcar días cerrados o personalizar bloques.'
            : 'Este barbero no hereda horarios generales: configurá cada día laborable.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ISO_DAYS.map(({ value: day }) => {
          const draft = getDraft(day)
          const saved = savedSummary.find((s) => s.day === day)
          const hasChanges =
            day in drafts ||
            draft.mode !== saved?.mode ||
            JSON.stringify(draft.blocks) !== JSON.stringify(saved?.blocks ?? [])

          return (
            <div key={day} className="space-y-3 rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{getDayLabel(day)}</p>
                <select
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  value={draft.mode}
                  onChange={(e) =>
                    updateDraft(day, { mode: e.target.value as BarberDayMode })
                  }
                >
                  {barber.use_general_schedules && (
                    <option value="general">Usar horario general</option>
                  )}
                  <option value="custom">Horario personalizado</option>
                  <option value="closed">Día no laborable</option>
                </select>
              </div>

              {draft.mode === 'custom' && (
                <ScheduleBlocksEditor
                  blocks={draft.blocks}
                  onChange={(blocks) => updateDraft(day, { blocks })}
                />
              )}

              {draft.mode === 'general' && (
                <p className="text-muted-foreground text-sm">Hereda bloques del horario general.</p>
              )}

              {draft.mode === 'closed' && (
                <p className="text-muted-foreground text-sm">Sin turnos este día.</p>
              )}

              {draft.mode === 'custom' && draft.blocks.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  {draft.blocks.map((b) => formatTimeRange(b.start_time, b.end_time)).join(' · ')}
                </p>
              )}

              <Button
                size="sm"
                variant="outline"
                disabled={!hasChanges || saveDay.isPending || clearDay.isPending}
                onClick={() => void handleSave(day)}
              >
                Guardar {getDayLabel(day).toLowerCase()}
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
