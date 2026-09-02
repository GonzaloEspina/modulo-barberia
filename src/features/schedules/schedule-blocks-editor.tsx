import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ScheduleBlockInput } from '@/types/schedule'

interface ScheduleBlocksEditorProps {
  blocks: ScheduleBlockInput[]
  onChange: (blocks: ScheduleBlockInput[]) => void
  disabled?: boolean
}

function toInputTime(value: string): string {
  return value.slice(0, 5)
}

function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value
}

export function ScheduleBlocksEditor({ blocks, onChange, disabled }: ScheduleBlocksEditorProps) {
  const updateBlock = (index: number, patch: Partial<ScheduleBlockInput>) => {
    onChange(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)))
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <Input
            type="time"
            className="w-32"
            value={toInputTime(block.start_time)}
            disabled={disabled}
            onChange={(e) => updateBlock(index, { start_time: normalizeTime(e.target.value) })}
          />
          <span className="text-muted-foreground text-sm">a</span>
          <Input
            type="time"
            className="w-32"
            value={toInputTime(block.end_time)}
            disabled={disabled}
            onChange={(e) => updateBlock(index, { end_time: normalizeTime(e.target.value) })}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={disabled}
            aria-label="Eliminar bloque"
            onClick={() => onChange(blocks.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() =>
          onChange([...blocks, { start_time: '10:00:00', end_time: '13:00:00' }])
        }
      >
        <Plus className="size-4" aria-hidden="true" />
        Agregar bloque
      </Button>
    </div>
  )
}
