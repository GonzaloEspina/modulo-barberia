export type UserRole = 'admin' | 'barber'

export type PortalBookingMode = 'all_except_denied' | 'allowlist_only' | 'disabled'

export interface ProfilePermissions {
  can_register_payments: boolean
  can_edit_own_schedule: boolean
}

export interface OrganizationSettings {
  appointment_slot_interval_minutes: number
  overbooking_requires_reason: boolean
  portal_booking_mode: PortalBookingMode
  default_appointment_status: string
  privacy_hide_client_names_in_conflicts: boolean
  redemption_reversal_expiry_days: number
  membership_credit_points: boolean
}

export interface Organization {
  id: string
  name: string
  logo_url: string | null
  phone: string | null
  address: string | null
  timezone: string
  currency: string
  settings: OrganizationSettings
  is_active: boolean
}

export interface Barber {
  id: string
  organization_id: string
  user_id: string | null
  name: string
  photo_url: string | null
  phone: string | null
  email: string | null
  calendar_color: string
  display_order: number
  is_active: boolean
}

export interface Profile {
  id: string
  organization_id: string
  role: UserRole
  barber_id: string | null
  full_name: string | null
  permissions: ProfilePermissions
  is_active: boolean
  organization?: Organization
  barber?: Barber | null
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  barber: 'Barbero',
}
