import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { WeeklyScheduleEditor } from '@/components/design-system/weekly-schedule-editor'
import { Skeleton } from '@/components/ui/skeleton'
import { useGeneralScheduleMutations, useGeneralSchedules } from '@/features/schedules/api'
import { useProfile } from '@/hooks/use-profile'
import { notifyError } from '@/lib/notify'
import { ISO_DAYS } from '@/types/schedule'
import type { ScheduleBlockInput } from '@/types/schedule'

export function GeneralSchedulesPage() {
  const { data: profile } = useProfile()
  const { data: schedules, isLoading } = useGeneralSchedules()
  const { saveDay } = useGeneralScheduleMutations(profile?.organization_id)

  const grouped = useMemo(() => {
    const map = new Map<number, ScheduleBlockInput[]>()
    ISO_DAYS.forEach((d) => map.set(d.value, []))
    schedules?.forEach((row) => {
      const current = map.get(row.day_of_week) ?? []
      current.push({ start_time: row.start_time, end_time: row.end_time })
      map.set(row.day_of_week, current)
    })
    return map
  }, [schedules])

  const [drafts, setDrafts] = useState<Record<number, ScheduleBlockInput[]>>({})

  const getBlocks = (day: number) => drafts[day] ?? grouped.get(day) ?? []

  const handleSave = async (day: number) => {
    try {
      await saveDay.mutateAsync({ dayOfWeek: day, blocks: getBlocks(day) })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[day]
        return next
      })
    } catch (err) {
      notifyError((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Horarios generales"
        description="Jornada base de la barbería. Los barberos pueden heredarla o personalizarla por día."
      />

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {ISO_DAYS.map(({ value: day }) => {
            const blocks = getBlocks(day)
            const savedBlocks = grouped.get(day) ?? []
            const hasChanges =
              JSON.stringify(blocks) !== JSON.stringify(savedBlocks) || day in drafts

            return (
              <WeeklyScheduleEditor
                key={day}
                day={day}
                blocks={blocks}
                onChange={(next) => setDrafts((prev) => ({ ...prev, [day]: next }))}
                onSave={() => void handleSave(day)}
                saveDisabled={!hasChanges}
                saving={saveDay.isPending}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
