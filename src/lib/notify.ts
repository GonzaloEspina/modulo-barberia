import { toast } from 'sonner'

export function notifyError(message: string) {
  toast.error(message)
}

export function notifySuccess(message: string) {
  toast.success(message)
}

export async function confirmAction(message: string): Promise<boolean> {
  return window.confirm(message)
}
