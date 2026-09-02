import type { ClientFormValues } from '@/features/clients/client-form'
import type { ClientBookingOverride } from '@/types/client'

export function clientFormValuesToInput(values: ClientFormValues) {
  return {
    ...values,
    booking_override: values.booking_override as ClientBookingOverride,
  }
}
