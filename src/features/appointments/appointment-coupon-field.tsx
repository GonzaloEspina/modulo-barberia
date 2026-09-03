import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AppointmentCoupon } from '@/lib/coupon-discount'

interface AppointmentCouponFieldProps {
  coupons: AppointmentCoupon[]
  redemptionId: string
  code: string
  onRedemptionIdChange: (id: string) => void
  onCodeChange: (code: string) => void
  disabled?: boolean
  idPrefix?: string
  selectPlaceholder?: string
  codePlaceholder?: string
}

export function AppointmentCouponField({
  coupons,
  redemptionId,
  code,
  onRedemptionIdChange,
  onCodeChange,
  disabled,
  idPrefix = 'coupon',
  selectPlaceholder = 'Elegí un cupón del cliente',
  codePlaceholder,
}: AppointmentCouponFieldProps) {
  const selectId = `${idPrefix}-select`
  const codeId = `${idPrefix}-code`

  const selectCoupon = (id: string) => {
    onRedemptionIdChange(id)
    const match = coupons.find((coupon) => coupon.id === id)
    onCodeChange(match?.unique_code ?? '')
  }

  const typeCode = (next: string) => {
    onCodeChange(next)
    const normalized = next.trim().toUpperCase()
    const match = coupons.find((coupon) => coupon.unique_code.toUpperCase() === normalized)
    onRedemptionIdChange(match?.id ?? '')
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={coupons.length > 0 ? selectId : codeId}>
        Cupón de descuento
      </Label>
      {coupons.length > 0 && (
        <select
          id={selectId}
          className="border-input bg-background flex h-10 w-full rounded-lg border px-3 text-sm"
          value={redemptionId}
          disabled={disabled}
          onChange={(e) => selectCoupon(e.target.value)}
          aria-label="Cupones disponibles"
        >
          <option value="">{selectPlaceholder}</option>
          {coupons.map((coupon) => (
            <option key={coupon.id} value={coupon.id}>
              {coupon.reward_name} · {coupon.unique_code}
            </option>
          ))}
        </select>
      )}
      <Input
        id={codeId}
        className="rounded-lg"
        placeholder={codePlaceholder ?? (coupons.length > 0 ? 'O escribí el código' : 'Código de descuento')}
        value={code}
        disabled={disabled}
        onChange={(e) => typeCode(e.target.value)}
      />
    </div>
  )
}
