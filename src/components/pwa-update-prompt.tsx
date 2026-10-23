import { useRegisterSW } from 'virtual:pwa-register/react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * Prompts when a new service worker is waiting (registerType: 'prompt').
 * Mount once at the app root so staff shell and portal share the same flow.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <AlertDialog
      open={needRefresh}
      onOpenChange={(open) => {
        if (!open) setNeedRefresh(false)
      }}
    >
      <AlertDialogContent
        size="sm"
        className="rounded-sm border-border bg-card p-5 shadow-none sm:max-w-sm"
      >
        <AlertDialogHeader className="place-items-start text-left sm:place-items-start sm:text-left">
          <AlertDialogTitle className="font-display text-base font-semibold tracking-wide text-foreground uppercase">
            Hay una nueva versión disponible
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            Actualizá para cargar los cambios. La app se va a recargar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-end">
          <AlertDialogCancel className="rounded-sm">Después</AlertDialogCancel>
          <AlertDialogAction
            variant="accent"
            className="rounded-sm"
            onClick={() => {
              void updateServiceWorker(true)
            }}
          >
            Actualizar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
