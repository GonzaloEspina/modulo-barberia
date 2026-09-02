export function calculatePendingAmount(totalAmount: number, paidAmount: number): number {
  return Math.max(totalAmount - paidAmount, 0)
}

export function validatePaymentAmount(amount: number, pendingAmount: number): string | null {
  if (amount <= 0) return 'El monto debe ser mayor a cero'
  if (amount > pendingAmount) return `El monto excede el saldo pendiente ($${pendingAmount})`
  return null
}

export function derivePaymentStatus(totalAmount: number, paidAmount: number): string {
  if (totalAmount <= 0) return 'paid'
  if (paidAmount <= 0) return 'pending'
  if (paidAmount < totalAmount) return 'partial'
  return 'paid'
}
