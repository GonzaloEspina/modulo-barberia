import { getSupabaseClient } from '@/lib/supabase'

const RECEIPT_BUCKET = 'receipts'

export async function uploadReceipt(
  organizationId: string,
  folder: 'expenses' | 'payments',
  entityId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${organizationId}/${folder}/${entityId}/${Date.now()}.${ext}`
  const { error } = await getSupabaseClient().storage.from(RECEIPT_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error
  return path
}

export async function setExpenseReceiptUrl(expenseId: string, receiptUrl: string) {
  const { error } = await getSupabaseClient().rpc('set_expense_receipt_url', {
    p_expense_id: expenseId,
    p_receipt_url: receiptUrl,
  })
  if (error) throw error
}

export async function setPaymentReceiptUrl(paymentId: string, receiptUrl: string) {
  const { error } = await getSupabaseClient().rpc('set_payment_receipt_url', {
    p_payment_id: paymentId,
    p_receipt_url: receiptUrl,
  })
  if (error) throw error
}
