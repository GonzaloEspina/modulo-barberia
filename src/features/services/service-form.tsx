import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Service } from '@/types/service'
import { SERVICE_COLOR_PRESETS } from '@/types/service'
import { cn } from '@/lib/utils'

const serviceSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  price: z.number().min(0, 'El precio no puede ser negativo'),
  duration_minutes: z.number().int().min(1, 'La duración debe ser al menos 1 minuto'),
  points_awarded: z.number().int().min(0, 'Los puntos no pueden ser negativos'),
  display_order: z.number().int().min(0),
  category_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').optional().or(z.literal('')),
  is_active: z.boolean(),
})

export type ServiceFormValues = z.infer<typeof serviceSchema>

interface ServiceFormProps {
  service?: Service | null
  isSubmitting?: boolean
  onSubmit: (values: ServiceFormValues) => Promise<void>
  onCancel: () => void
}

export function ServiceForm({ service, isSubmitting, onSubmit, onCancel }: ServiceFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      duration_minutes: 30,
      points_awarded: 0,
      display_order: 0,
      category_color: '#D97706',
      is_active: true,
    },
  })

  const selectedColor = watch('category_color')

  useEffect(() => {
    if (service) {
      reset({
        name: service.name,
        description: service.description ?? '',
        price: service.price,
        duration_minutes: service.duration_minutes,
        points_awarded: service.points_awarded,
        display_order: service.display_order,
        category_color: service.category_color ?? '#D97706',
        is_active: service.is_active,
      })
    }
  }, [service, reset])

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Textarea id="description" rows={2} {...register('description')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">Precio ($)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={100}
            {...register('price', { valueAsNumber: true })}
            aria-invalid={!!errors.price}
          />
          {errors.price && <p className="text-destructive text-sm">{errors.price.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration_minutes">Duración (min)</Label>
          <Input
            id="duration_minutes"
            type="number"
            min={1}
            {...register('duration_minutes', { valueAsNumber: true })}
            aria-invalid={!!errors.duration_minutes}
          />
          {errors.duration_minutes && (
            <p className="text-destructive text-sm">{errors.duration_minutes.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="points_awarded">Puntos otorgados</Label>
          <Input
            id="points_awarded"
            type="number"
            min={0}
            {...register('points_awarded', { valueAsNumber: true })}
            aria-invalid={!!errors.points_awarded}
          />
          {errors.points_awarded && (
            <p className="text-destructive text-sm">{errors.points_awarded.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="display_order">Orden</Label>
          <Input
            id="display_order"
            type="number"
            min={0}
            {...register('display_order', { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Color de categoría</Label>
        <div className="flex flex-wrap gap-2">
          {SERVICE_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                'size-9 rounded-full border-2 transition-transform hover:scale-105',
                selectedColor === color ? 'border-foreground scale-110' : 'border-transparent',
              )}
              style={{ backgroundColor: color }}
              aria-label={`Color ${color}`}
              onClick={() => setValue('category_color', color, { shouldValidate: true })}
            />
          ))}
        </div>
        <Input type="color" className="h-10 w-24 p-1" {...register('category_color')} />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="size-4" {...register('is_active')} />
        Servicio activo
      </label>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : service ? 'Guardar cambios' : 'Crear servicio'}
        </Button>
      </div>
    </form>
  )
}
