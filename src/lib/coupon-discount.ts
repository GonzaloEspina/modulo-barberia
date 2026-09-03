export interface AppointmentCoupon {
  id: string
  unique_code: string
  status: string
  reward_name: string
  reward_type: string
  value: number | null
  service_id?: string | null
  points_used: number
}

export function computeCouponDiscount(
  coupon: AppointmentCoupon,
  subtotal: number,
  services: Array<{ id: string; price: number }>,
): number {
  const value = Number(coupon.value ?? 0)
  if (subtotal <= 0) return 0

  if (coupon.reward_type === 'percentage_discount') {
    return Math.min(subtotal, Number((subtotal * value / 100).toFixed(2)))
  }
  if (coupon.reward_type === 'fixed_discount') {
    return Math.min(subtotal, Math.max(value, 0))
  }
  if (coupon.reward_type === 'free_service') {
    const service = services.find((row) => row.id === coupon.service_id)
    return service ? Math.min(subtotal, Number(service.price)) : 0
  }
  return 0
}
