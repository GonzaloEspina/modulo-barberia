import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import type { Organization, OrganizationSettings, PortalBookingMode } from '@/types/database'

export interface OrganizationFormInput {
  name: string
  phone: string
  address: string
  settings: OrganizationSettings
}

export interface PointsConfigInput {
  enabled: boolean
  expiration_type: string
  expiration_value: number
  credit_moment: string
  require_payment_for_credit: boolean
}

export type AbsenceRuleType = 'consecutive' | 'within_period'
export type AbsencePeriodUnit = 'days' | 'weeks' | 'months'

export interface AbsenceConfigInput {
  threshold_count: number
  rule_type: AbsenceRuleType
  period_value: number
  period_unit: AbsencePeriodUnit
  is_active: boolean
}

export interface PaymentMethodInput {
  name: string
  discount_type: string
  discount_value: number
  auto_apply_discount: boolean
  display_order: number
  is_active: boolean
}

export function useOrganizationSettings(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['organization', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('organizations')
        .select('*')
        .eq('id', organizationId!)
        .single()
      if (error) throw error
      return {
        ...data,
        settings: data.settings as OrganizationSettings,
      } as Organization
    },
  })
}

export function usePointsConfigAdmin() {
  return useQuery({
    queryKey: ['points-config'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().from('points_config').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useAbsenceConfig() {
  return useQuery({
    queryKey: ['absence-config'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().from('absence_config').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function usePaymentMethodsAdmin() {
  return useQuery({
    queryKey: ['payment-methods-admin'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('payment_methods')
        .select('*')
        .order('display_order')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useSettingsMutations(organizationId: string | undefined) {
  const qc = useQueryClient()

  const invalidateOrg = () => {
    void qc.invalidateQueries({ queryKey: ['organization', organizationId] })
    void qc.invalidateQueries({ queryKey: ['profile'] })
  }

  const updateOrganization = useMutation({
    mutationFn: async (input: OrganizationFormInput) => {
      const { error } = await getSupabaseClient()
        .from('organizations')
        .update({
          name: input.name.trim(),
          phone: input.phone.trim() || null,
          address: input.address.trim() || null,
          settings: input.settings,
        })
        .eq('id', organizationId!)
      if (error) throw error
    },
    onSuccess: invalidateOrg,
  })

  const updatePointsConfig = useMutation({
    mutationFn: async (input: PointsConfigInput) => {
      const { data: existing } = await getSupabaseClient()
        .from('points_config')
        .select('id')
        .maybeSingle()
      if (existing?.id) {
        const { error } = await getSupabaseClient()
          .from('points_config')
          .update(input)
          .eq('id', existing.id as string)
        if (error) throw error
      } else if (organizationId) {
        const { error } = await getSupabaseClient()
          .from('points_config')
          .insert({ organization_id: organizationId, ...input })
        if (error) throw error
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['points-config'] }),
  })

  const updateAbsenceConfig = useMutation({
    mutationFn: async (input: AbsenceConfigInput) => {
      const { data: existing } = await getSupabaseClient()
        .from('absence_config')
        .select('id')
        .maybeSingle()
      if (existing?.id) {
        const { error } = await getSupabaseClient()
          .from('absence_config')
          .update(input)
          .eq('id', existing.id as string)
        if (error) throw error
      } else if (organizationId) {
        const { error } = await getSupabaseClient()
          .from('absence_config')
          .insert({ organization_id: organizationId, ...input })
        if (error) throw error
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['absence-config'] }),
  })

  const savePaymentMethod = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: PaymentMethodInput }) => {
      const payload = {
        organization_id: organizationId!,
        ...input,
      }
      if (id) {
        const { error } = await getSupabaseClient().from('payment_methods').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await getSupabaseClient().from('payment_methods').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payment-methods-admin'] }),
  })

  const deletePaymentMethod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient().from('payment_methods').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payment-methods-admin'] }),
  })

  return {
    updateOrganization,
    updatePointsConfig,
    updateAbsenceConfig,
    savePaymentMethod,
    deletePaymentMethod,
  }
}

export const PORTAL_BOOKING_LABELS: Record<PortalBookingMode, string> = {
  disabled: 'Solo consulta (sin reservas)',
  all_except_denied: 'Todos excepto bloqueados',
  allowlist_only: 'Solo clientes autorizados',
}
