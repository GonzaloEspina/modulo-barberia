import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'

export interface PaymentSummary {
  total_amount: number
  paid_amount: number
  pending_amount: number
  payment_status: string
}

export interface PaymentMethod {
  id: string
  name: string
  discount_type: string
  discount_value: number
  is_active: boolean
}

export function usePaymentSummary(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['payment-summary', appointmentId],
    enabled: !!appointmentId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_appointment_payment_summary', {
        p_appointment_id: appointmentId!,
      })
      if (error) throw error
      const row = (data as PaymentSummary[])[0]
      return row
    },
  })
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('payment_methods')
        .select('id, name, discount_type, discount_value, is_active')
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
      return (data ?? []) as PaymentMethod[]
    },
  })
}

export function usePayments(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['payments', appointmentId],
    enabled: !!appointmentId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('payments')
        .select('id, amount, discount_applied, paid_at, status, receipt_url, payment_methods(name)')
        .eq('appointment_id', appointmentId!)
        .order('paid_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function usePaymentMutations() {
  const queryClient = useQueryClient()

  const invalidate = (appointmentId: string) => {
    void queryClient.invalidateQueries({ queryKey: ['payments', appointmentId] })
    void queryClient.invalidateQueries({ queryKey: ['payment-summary', appointmentId] })
    void queryClient.invalidateQueries({ queryKey: ['appointments'] })
  }

  const registerPayment = useMutation({
    mutationFn: async (input: {
      appointment_id: string
      payment_method_id: string
      amount: number
    }) => {
      const { data, error } = await getSupabaseClient().rpc('register_payment', {
        p_appointment_id: input.appointment_id,
        p_payment_method_id: input.payment_method_id,
        p_amount: input.amount,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (_, vars) => invalidate(vars.appointment_id),
  })

  return { registerPayment }
}
