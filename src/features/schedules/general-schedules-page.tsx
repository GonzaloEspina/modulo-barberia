import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { WeeklyScheduleEditor } from '@/components/design-system/weekly-schedule-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useGeneralScheduleMutations, useGeneralSchedules } from '@/features/schedules/api'
import { useProfile } from '@/hooks/use-profile'
import { notifyError } from '@/lib/notify'
import { ISO_DAYS } from '@/types/schedule'
import type { ScheduleBlockInput } from '@/types/schedule'

const UNSAVED_MESSAGE = 'Tenés cambios sin guardar. ¿Salir sin guardar?'

function blocksEqual(a: ScheduleBlockInput[], b: ScheduleBlockInput[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function useUnsavedChangesGuard(when: boolean) {
  const navigation = useContext(NavigationContext)

  useEffect(() => {
    if (!when) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])

  useEffect(() => {
    if (!when || !navigation?.navigator) return

    const { navigator } = navigation
    const originalPush = navigator.push
    const originalReplace = navigator.replace
    const originalGo = navigator.go

    const confirmLeave = () => window.confirm(UNSAVED_MESSAGE)

    navigator.push = (...args: Parameters<typeof originalPush>) => {
      if (confirmLeave()) originalPush(...args)
    }
    navigator.replace = (...args: Parameters<typeof originalReplace>) => {
      if (confirmLeave()) originalReplace(...args)
    }
    navigator.go = (...args: Parameters<typeof originalGo>) => {
      if (confirmLeave()) originalGo(...args)
    }

    return () => {
      navigator.push = originalPush
      navigator.replace = originalReplace
      navigator.go = originalGo
    }
  }, [when, navigation])
}

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

  const getBlocks = useCallback(
    (day: number) => drafts[day] ?? grouped.get(day) ?? [],
    [drafts, grouped],
  )

  const isDayDirty = useCallback(
    (day: number) => {
      const blocks = getBlocks(day)
      const savedBlocks = grouped.get(day) ?? []
      return !blocksEqual(blocks, savedBlocks)
    },
    [getBlocks, grouped],
  )

  const dirtyDays = useMemo(
    () => ISO_DAYS.filter(({ value }) => isDayDirty(value)).map(({ value }) => value),
    [isDayDirty],
  )

  const hasUnsavedChanges = dirtyDays.length > 0

  useUnsavedChangesGuard(hasUnsavedChanges)

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

  const handleSaveAll = async () => {
    for (const day of dirtyDays) {
      await handleSave(day)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Horarios generales"
        description="Jornada base de la barbería. Los barberos pueden heredarla o personalizarla por día."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {hasUnsavedChanges && (
              <Badge variant="outline" className="border-warning/40 text-warning">
                Cambios sin guardar
              </Badge>
            )}
            <Button
              variant="accent"
              disabled={!hasUnsavedChanges || saveDay.isPending}
              onClick={() => void handleSaveAll()}
            >
              Guardar todos
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {ISO_DAYS.map(({ value: day }) => {
            const blocks = getBlocks(day)
            const dirty = isDayDirty(day)

            return (
              <WeeklyScheduleEditor
                key={day}
                day={day}
                blocks={blocks}
                dirty={dirty}
                onChange={(next) => setDrafts((prev) => ({ ...prev, [day]: next }))}
                onSave={() => void handleSave(day)}
                saveDisabled={!dirty}
                saving={saveDay.isPending}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
