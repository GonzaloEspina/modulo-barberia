import { Plus } from 'lucide-react'
import { ScheduleBlocksEditor } from '@/features/schedules/schedule-blocks-editor'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { getDayLabel } from '@/types/schedule'
import type { ScheduleBlockInput } from '@/types/schedule'
import { cn } from '@/lib/utils'

interface WeeklyScheduleEditorProps {
  day: number
  blocks: ScheduleBlockInput[]
  onChange: (blocks: ScheduleBlockInput[]) => void
  onSave?: () => void
  saveDisabled?: boolean
  saving?: boolean
  className?: string
}

export function WeeklyScheduleEditor({
  day,
  blocks,
  onChange,
  onSave,
  saveDisabled,
  saving,
  className,
}: WeeklyScheduleEditorProps) {
  const isOpen = blocks.length > 0

  return (
    <section className={cn('rounded-xl border bg-card p-4', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{getDayLabel(day)}</h3>
          <p className="text-muted-foreground text-sm">
            {isOpen ? `${blocks.length} bloque${blocks.length !== 1 ? 's' : ''}` : 'Cerrado'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Activo</span>
          <Switch
            checked={isOpen}
            onCheckedChange={(checked) => {
              if (checked && blocks.length === 0) {
                onChange([{ start_time: '09:00:00', end_time: '18:00:00' }])
              }
              if (!checked) onChange([])
            }}
          />
        </div>
      </div>

      {isOpen && (
        <>
          <ScheduleBlocksEditor blocks={blocks} onChange={onChange} />
          {!blocks.length && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => onChange([{ start_time: '09:00:00', end_time: '13:00:00' }])}
            >
              <Plus className="size-4" />
              Agregar horario
            </Button>
          )}
        </>
      )}

      {onSave && (
        <Button
          className="mt-4"
          size="sm"
          variant="accent"
          disabled={saveDisabled || saving}
          onClick={onSave}
        >
          Guardar {getDayLabel(day).toLowerCase()}
        </Button>
      )}
    </section>
  )
}
