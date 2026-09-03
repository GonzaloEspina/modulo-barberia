import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/design-system/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useProfile } from '@/hooks/use-profile'
import type { Client } from '@/types/client'
import { getBookingOverrideOptions } from '@/types/client'

const clientSchema = z
  .object({
    first_name: z.string().min(1, 'El nombre es obligatorio'),
    last_name: z.string().optional(),
    phone: z.string().min(6, 'Ingresá un teléfono válido'),
    email: z.string().email('Correo inválido').optional().or(z.literal('')),
    nickname: z.string().optional(),
    birth_date: z.string().optional(),
    notes: z.string().optional(),
    manual_warning: z.boolean(),
    manual_warning_reason: z.string().optional(),
    booking_override: z.enum(['inherit', 'allowed', 'denied']),
  })
  .refine((data) => !data.manual_warning || !!data.manual_warning_reason?.trim(), {
    message: 'Indicá el motivo de la advertencia',
    path: ['manual_warning_reason'],
  })

export type ClientFormValues = z.infer<typeof clientSchema>

interface ClientFormProps {
  client?: Client | null
  isSubmitting?: boolean
  onSubmit: (values: ClientFormValues) => Promise<void>
  onCancel: () => void
}

export function ClientForm({ client, isSubmitting, onSubmit, onCancel }: ClientFormProps) {
  const { data: profile } = useProfile()
  const portalMode = profile?.organization?.settings.portal_booking_mode ?? 'disabled'
  const bookingOptions = getBookingOverrideOptions(portalMode)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      nickname: '',
      birth_date: '',
      notes: '',
      manual_warning: false,
      manual_warning_reason: '',
      booking_override: 'inherit',
    },
  })

  const manualWarning = watch('manual_warning')

  useEffect(() => {
    if (client) {
      reset({
        first_name: client.first_name,
        last_name: client.last_name,
        phone: client.phone_display ?? client.phone_normalized,
        email: client.email ?? '',
        nickname: client.nickname ?? '',
        birth_date: client.birth_date ?? '',
        notes: client.notes ?? '',
        manual_warning: client.manual_warning,
        manual_warning_reason: client.manual_warning_reason ?? '',
        booking_override: client.booking_override,
      })
    }
  }, [client, reset])

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">Nombre</Label>
          <Input id="first_name" {...register('first_name')} aria-invalid={!!errors.first_name} />
          {errors.first_name && (
            <p className="text-destructive text-sm">{errors.first_name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Apellido (opcional)</Label>
          <Input id="last_name" {...register('last_name')} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="11 1234-5678"
            {...register('phone')}
            aria-invalid={!!errors.phone}
          />
          {errors.phone && <p className="text-destructive text-sm">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo (opcional)</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="nickname">Apodo (opcional, solo staff)</Label>
          <Input id="nickname" {...register('nickname')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birth_date">Fecha de nacimiento (opcional)</Label>
          <DatePicker
            id="birth_date"
            value={watch('birth_date') ?? ''}
            fromYear={1920}
            toYear={new Date().getFullYear()}
            onChange={(next) => setValue('birth_date', next, { shouldDirty: true })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" rows={3} {...register('notes')} />
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4" {...register('manual_warning')} />
          <AlertTriangle className="text-amber-600 size-4" aria-hidden="true" />
          Advertencia manual al crear turno
        </label>
        {manualWarning && (
          <div className="space-y-2">
            <Label htmlFor="manual_warning_reason">Motivo de advertencia</Label>
            <Textarea
              id="manual_warning_reason"
              rows={2}
              {...register('manual_warning_reason')}
              aria-invalid={!!errors.manual_warning_reason}
            />
            {errors.manual_warning_reason && (
              <p className="text-destructive text-sm">{errors.manual_warning_reason.message}</p>
            )}
          </div>
        )}
      </div>

      {bookingOptions.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="booking_override">¿Puede reservar desde el portal?</Label>
          <select
            id="booking_override"
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
            {...register('booking_override')}
          >
            {bookingOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {portalMode === 'disabled' && (
        <p className="text-muted-foreground text-sm">
          Las reservas desde el portal están deshabilitadas para esta barbería.
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : client ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </div>
    </form>
  )
}
