import { Copy } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { notifyError, notifySuccess } from '@/lib/notify'

function getPortalUrl() {
  if (typeof window === 'undefined') return '/portal'
  return `${window.location.origin}/portal`
}

export function ClientPortalAccessPanel() {
  const portalUrl = useMemo(() => getPortalUrl(), [])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl)
      notifySuccess('Enlace copiado')
    } catch {
      notifyError('No se pudo copiar el enlace')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acceso al portal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <a
            href={portalUrl}
            className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-4 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {portalUrl}
          </a>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => void copyLink()}
            aria-label="Copiar enlace al portapapeles"
          >
            <Copy />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
