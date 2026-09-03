import type { ServiceFormInput } from '@/types/service'
import type { ServiceFormValues } from '@/features/services/service-form'

export function serviceFormValuesToInput(values: ServiceFormValues): ServiceFormInput {
  return {
    name: values.name,
    description: values.description,
    price: values.price,
    duration_minutes: values.duration_minutes,
    points_awarded: values.points_awarded,
    display_order: values.display_order,
    category_color: values.category_color,
    is_active: values.is_active,
    visible_on_portal: values.visible_on_portal,
  }
}
