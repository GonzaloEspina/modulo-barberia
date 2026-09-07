import { describe, expect, it } from 'vitest'
import { resolveServiceSelection } from '@/lib/service-selection'
import type { Service } from '@/types/service'

const services: Service[] = [
  {
    id: 'corte',
    organization_id: 'org',
    name: 'Corte clásico',
    description: null,
    price: 15000,
    duration_minutes: 30,
    points_awarded: 10,
    display_order: 1,
    category_color: null,
    is_active: true,
    visible_on_portal: true,
    deleted_at: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'barba',
    organization_id: 'org',
    name: 'Barba',
    description: null,
    price: 8000,
    duration_minutes: 20,
    points_awarded: 5,
    display_order: 2,
    category_color: null,
    is_active: true,
    visible_on_portal: true,
    deleted_at: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'combo',
    organization_id: 'org',
    name: 'Corte + Barba',
    description: null,
    price: 22000,
    duration_minutes: 45,
    points_awarded: 15,
    display_order: 3,
    category_color: null,
    is_active: true,
    visible_on_portal: true,
    deleted_at: null,
    created_at: '',
    updated_at: '',
  },
]

describe('resolveServiceSelection', () => {
  it('al elegir combo quita los servicios incluidos', () => {
    expect(resolveServiceSelection(['corte', 'barba'], 'combo', services)).toEqual(['combo'])
  })

  it('al elegir un servicio del combo quita el combo', () => {
    expect(resolveServiceSelection(['combo'], 'corte', services)).toEqual(['corte'])
  })

  it('permite varios servicios sin combo', () => {
    expect(resolveServiceSelection(['corte'], 'barba', services)).toEqual(['corte', 'barba'])
  })
})
