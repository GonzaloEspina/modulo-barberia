import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface ClientWarningProps {
  title?: string
  message: string
}

export function ClientWarning({ title = 'Atención', message }: ClientWarningProps) {
  return (
    <Alert className="border-warning/30 bg-warning/5">
      <AlertTriangle className="text-warning size-4" />
      <AlertTitle className="text-warning-foreground">{title}</AlertTitle>
      <AlertDescription className="text-foreground/80">{message}</AlertDescription>
    </Alert>
  )
}
