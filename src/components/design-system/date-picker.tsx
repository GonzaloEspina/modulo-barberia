import { format, parse, startOfDay } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatAppDate } from '@/lib/app-datetime'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  fromYear?: number
  toYear?: number
  disabled?: boolean
  placeholder?: string
  className?: string
  'aria-invalid'?: boolean
}

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, 'yyyy-MM-dd', new Date())
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  fromYear,
  toYear,
  disabled,
  placeholder = 'dd/mm/aaaa',
  className,
  'aria-invalid': ariaInvalid,
}: DatePickerProps) {
  const selected = parseYmd(value)
  const minDate = parseYmd(min ?? '')
  const maxDate = parseYmd(max ?? '')
  const startMonth = fromYear != null ? new Date(fromYear, 0, 1) : undefined
  const endMonth = toYear != null ? new Date(toYear, 11, 1) : undefined
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className={cn(
            'h-9 w-full justify-start rounded-md px-3 font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="size-4" aria-hidden="true" />
          {value ? formatAppDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout={fromYear != null || toYear != null ? 'dropdown' : 'label'}
          startMonth={startMonth}
          endMonth={endMonth}
          onSelect={(day) => {
            if (!day) {
              onChange('')
              return
            }
            onChange(format(day, 'yyyy-MM-dd'))
            setOpen(false)
          }}
          disabled={(day) => {
            const current = startOfDay(day)
            if (minDate && current < startOfDay(minDate)) return true
            if (maxDate && current > startOfDay(maxDate)) return true
            return false
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

interface DateTimePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function DateTimePicker({ id, value, onChange, disabled }: DateTimePickerProps) {
  const date = value.slice(0, 10)
  const time = value.length >= 16 ? value.slice(11, 16) : ''

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <DatePicker
        id={id}
        value={date}
        disabled={disabled}
        onChange={(nextDate) => {
          if (!nextDate) {
            onChange('')
            return
          }
          onChange(`${nextDate}T${time || '00:00'}`)
        }}
      />
      <Input
        type="time"
        lang="es-AR"
        disabled={disabled || !date}
        className="h-9 w-[7.75rem]"
        value={time}
        onChange={(e) => {
          if (!date) return
          onChange(`${date}T${e.target.value}`)
        }}
      />
    </div>
  )
}
