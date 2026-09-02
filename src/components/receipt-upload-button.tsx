import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { notifyError } from '@/lib/notify'
import { setExpenseReceiptUrl, setPaymentReceiptUrl, uploadReceipt } from '@/lib/receipt-upload'

interface ReceiptUploadButtonProps {
  organizationId: string
  folder: 'expenses' | 'payments'
  entityId: string
  onUploaded?: (path: string) => void
}

export function ReceiptUploadButton({ organizationId, folder, entityId, onUploaded }: ReceiptUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const path = await uploadReceipt(organizationId, folder, entityId, file)
      if (folder === 'expenses') {
        await setExpenseReceiptUrl(entityId, path)
      } else {
        await setPaymentReceiptUrl(entityId, path)
      }
      onUploaded?.(path)
    } catch (e) {
      notifyError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Subiendo…' : 'Adjuntar comprobante'}
      </Button>
    </>
  )
}
