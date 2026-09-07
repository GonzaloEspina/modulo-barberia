import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLinkableProfiles } from '@/features/barbers/api'
import type { BarberRecord } from '@/types/barber'
import { BARBER_COLOR_PRESETS } from '@/types/barber'
import { cn } from '@/lib/utils'

const barberSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  calendar_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
  display_order: z.number().int().min(0),
  use_general_schedules: z.boolean(),
  use_general_services: z.boolean(),
  use_general_prices: z.boolean(),
  use_general_durations: z.boolean(),
  is_active: z.boolean(),
  linked_profile_id: z.string().optional(),
})

export type BarberFormValues = z.infer<typeof barberSchema>

interface BarberFormProps {
  barber?: BarberRecord | null
  isSubmitting?: boolean
  onSubmit: (values: BarberFormValues) => Promise<void>
  onCancel: () => void
}

export function BarberForm({ barber, isSubmitting, onSubmit, onCancel }: BarberFormProps) {
  const { data: linkableProfiles } = useLinkableProfiles(barber?.id)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<BarberFormValues>({
    resolver: zodResolver(barberSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      calendar_color: '#D97706',
      display_order: 0,
      use_general_schedules: true,
      use_general_services: true,
      use_general_prices: true,
      use_general_durations: true,
      is_active: true,
      linked_profile_id: '',
    },
  })

  const selectedColor = watch('calendar_color')

  useEffect(() => {
    if (barber) {
      reset({
        name: barber.name,
        email: barber.email ?? '',
        phone: barber.phone ?? '',
        calendar_color: barber.calendar_color,
        display_order: barber.display_order,
        use_general_schedules: barber.use_general_schedules,
        use_general_services: barber.use_general_services,
        use_general_prices: barber.use_general_prices,
        use_general_durations: barber.use_general_durations,
        is_active: barber.is_active,
        linked_profile_id: barber.user_id ?? '',
      })
    }
  }, [barber?.id, reset])

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
          {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo (opcional)</Label>
          <Input id="email" type="email" {...register('email')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono (opcional)</Label>
          <Input id="phone" type="tel" {...register('phone')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="display_order">Orden de visualización</Label>
          <Input id="display_order" type="number" min={0} {...register('display_order', { valueAsNumber: true })} />
          <p className="text-muted-foreground text-xs">
            Menor número = mayor prioridad al asignar &quot;Cualquier barbero disponible&quot;.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="linked_profile_id">Usuario vinculado (opcional)</Label>
          <select
            id="linked_profile_id"
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
            {...register('linked_profile_id')}
          >
            <option value="">Sin usuario vinculado</option>
            {linkableProfiles?.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name ?? profile.id}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            Vincula un perfil con rol Barbero para que pueda iniciar sesión y ver sus turnos.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Color en calendario</Label>
          <div className="flex flex-wrap items-center gap-2">
            {BARBER_COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  'size-7 rounded-full border-2 transition-transform hover:scale-105',
                  selectedColor === color ? 'border-foreground scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: color }}
                aria-label={`Color ${color}`}
                onClick={() => setValue('calendar_color', color, { shouldValidate: true })}
              />
            ))}
            <Input type="color" className="h-8 w-12 p-0.5" {...register('calendar_color')} />
          </div>
        </div>
      </div>

      <fieldset className="rounded-md border px-3 py-2.5">
        <legend className="px-1 text-sm font-medium">Heredar configuración general</legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register('use_general_schedules')} />
            Horarios generales
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register('use_general_services')} />
            Servicios generales
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register('use_general_prices')} />
            Precios generales
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register('use_general_durations')} />
            Duraciones generales
          </label>
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4" {...register('is_active')} />
          Barbero activo
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : barber ? 'Guardar cambios' : 'Crear barbero'}
          </Button>
        </div>
      </div>
    </form>
  )
}
