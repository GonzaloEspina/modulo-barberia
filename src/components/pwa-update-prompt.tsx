import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Prompts when a new service worker is waiting (registerType: 'prompt').
 * Mount once at the app root so staff shell and portal share the same flow.
 * Periodically calls registration.update() so installed PWAs discover builds
 * without waiting for a full browser restart.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      const check = () => {
        void registration.update()
      }

      window.setInterval(check, CHECK_INTERVAL_MS)

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })

      // Installed PWAs often stay open for days — check soon after register too.
      window.setTimeout(check, 5_000)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3 md:px-4"
      style={{
        bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex w-full max-w-md flex-col gap-3 rounded-sm border border-white/15 bg-[#141820] p-4 text-white shadow-[0_-8px_32px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-display text-sm font-semibold tracking-wide uppercase">
            Nueva versión disponible
          </p>
          <p className="text-sm text-white/70">
            Actualizá para cargar los cambios. La app se va a recargar.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="rounded-sm border border-white/20 px-3 py-2 text-sm font-medium text-white/80"
            onClick={() => setNeedRefresh(false)}
          >
            Después
          </button>
          <button
            type="button"
            className="rounded-sm bg-[#c41230] px-3 py-2 text-sm font-semibold text-white"
            onClick={() => {
              void updateServiceWorker(true)
            }}
          >
            Actualizar
          </button>
        </div>
      </div>
    </div>
  )
}
