import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ClientPortalAccessPanelProps {
  phoneDisplay: string | null
}

export function ClientPortalAccessPanel({ phoneDisplay }: ClientPortalAccessPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acceso al portal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          El cliente puede ingresar en <strong>/portal</strong> con su teléfono
          {phoneDisplay ? <> (<strong>{phoneDisplay}</strong>)</> : null}.
        </p>
        <p>No requiere código: solo el número registrado en la ficha.</p>
      </CardContent>
    </Card>
  )
}
