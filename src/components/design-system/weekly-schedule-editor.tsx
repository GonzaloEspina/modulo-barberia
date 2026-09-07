import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
  dirty?: boolean
  className?: string
}

function toInputTime(value: string): string {
  return value.slice(0, 5)
}

function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value
}

export function WeeklyScheduleEditor({
  day,
  blocks,
  onChange,
  onSave,
  saveDisabled,
  saving,
  dirty,
  className,
}: WeeklyScheduleEditorProps) {
  const isOpen = blocks.length > 0

  const updateBlock = (index: number, patch: Partial<ScheduleBlockInput>) => {
    onChange(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)))
  }

  return (
    <section
      className={cn(
        'rounded-sm border bg-card p-3',
        dirty && 'border-warning/40',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display text-sm font-semibold tracking-wide uppercase">{getDayLabel(day)}</h3>
          {dirty && (
            <span className="text-warning text-xs font-medium">Sin guardar</span>
          )}
          {!isOpen ? (
            <Badge variant="secondary" className="text-xs">
              Cerrado
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">
              {blocks.length} bloque{blocks.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={isOpen}
            aria-label={isOpen ? `Cerrar ${getDayLabel(day)}` : `Abrir ${getDayLabel(day)}`}
            onCheckedChange={(checked) => {
              if (checked && blocks.length === 0) {
                onChange([{ start_time: '09:00:00', end_time: '18:00:00' }])
              }
              if (!checked) onChange([])
            }}
          />
          {onSave && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="hidden h-8 sm:inline-flex"
              disabled={saveDisabled || saving}
              onClick={onSave}
            >
              Guardar
            </Button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="mt-2 space-y-1.5">
          {blocks.map((block, index) => (
            <div key={index} className="flex flex-wrap items-center gap-1.5">
              <Input
                type="time"
                step={60}
                className="h-8 w-[5.5rem] px-2 text-sm"
                value={toInputTime(block.start_time)}
                onChange={(e) => updateBlock(index, { start_time: normalizeTime(e.target.value) })}
              />
              <span className="text-muted-foreground text-xs">a</span>
              <Input
                type="time"
                step={60}
                className="h-8 w-[5.5rem] px-2 text-sm"
                value={toInputTime(block.end_time)}
                onChange={(e) => updateBlock(index, { end_time: normalizeTime(e.target.value) })}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8"
                aria-label="Eliminar bloque"
                onClick={() => onChange(blocks.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() =>
              onChange([...blocks, { start_time: '10:00:00', end_time: '13:00:00' }])
            }
          >
            <Plus className="size-3.5" />
            Agregar bloque
          </Button>
        </div>
      )}

      {onSave && (
        <Button
          type="button"
          className="mt-2 h-8 w-full sm:hidden"
          size="sm"
          variant="outline"
          disabled={saveDisabled || saving}
          onClick={onSave}
        >
          Guardar {getDayLabel(day).toLowerCase()}
        </Button>
      )}
    </section>
  )
}
