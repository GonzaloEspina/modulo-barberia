import { describe, expect, it } from 'vitest'
import { isAdminRole, isBarberRole } from '@/hooks/use-profile'
import type { Profile } from '@/types/database'
import { ROLE_LABELS } from '@/types/database'

const baseProfile: Profile = {
  id: '1',
  organization_id: 'org-1',
  role: 'admin',
  barber_id: null,
  full_name: 'Test',
  permissions: { can_register_payments: true, can_edit_own_schedule: false },
  is_active: true,
}

describe('role helpers', () => {
  it('detecta administrador', () => {
    expect(isAdminRole({ ...baseProfile, role: 'admin' })).toBe(true)
    expect(isBarberRole({ ...baseProfile, role: 'admin' })).toBe(false)
  })

  it('detecta barbero', () => {
    expect(isBarberRole({ ...baseProfile, role: 'barber', barber_id: 'b1' })).toBe(true)
    expect(isAdminRole({ ...baseProfile, role: 'barber', barber_id: 'b1' })).toBe(false)
  })
})

describe('ROLE_LABELS', () => {
  it('tiene etiquetas en español', () => {
    expect(ROLE_LABELS.admin).toBe('Administrador')
    expect(ROLE_LABELS.barber).toBe('Barbero')
  })
})
