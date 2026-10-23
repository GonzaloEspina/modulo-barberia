import { CalendarRange, LayoutDashboard, Menu, Plus } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

function resolveActive(pathname: string): '/' | '/turnos' | '/turnos/nuevo' | null {
  if (pathname === '/turnos/nuevo') return '/turnos/nuevo'
  if (pathname === '/turnos' || pathname.startsWith('/turnos/')) return '/turnos'
  if (pathname === '/') return '/'
  return null
}

export function MobileBottomNav() {
  const location = useLocation()
  const { setOpenMobile } = useSidebar()
  const active = resolveActive(location.pathname)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Navegación principal"
    >
      <ul className="grid h-14 grid-cols-4">
        <li>
          <Link
            to="/"
            className={cn(
              'relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium tracking-wide',
              active === '/' ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {active === '/' && (
              <span className="bg-accent absolute inset-x-6 top-0 h-0.5" aria-hidden />
            )}
            <LayoutDashboard className="size-5" aria-hidden />
            Resumen
          </Link>
        </li>
        <li>
          <Link
            to="/turnos"
            className={cn(
              'relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium tracking-wide',
              active === '/turnos' ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {active === '/turnos' && (
              <span className="bg-accent absolute inset-x-6 top-0 h-0.5" aria-hidden />
            )}
            <CalendarRange className="size-5" aria-hidden />
            Agenda
          </Link>
        </li>
        <li>
          <Link
            to="/turnos/nuevo"
            className={cn(
              'relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold tracking-wide',
              active === '/turnos/nuevo' ? 'text-foreground' : 'text-muted-foreground',
            )}
            aria-current={active === '/turnos/nuevo' ? 'page' : undefined}
          >
            {active === '/turnos/nuevo' && (
              <span className="bg-accent absolute inset-x-6 top-0 h-0.5" aria-hidden />
            )}
            <span className="bg-accent text-accent-foreground flex size-7 items-center justify-center rounded-sm">
              <Plus className="size-4" aria-hidden />
            </span>
            <span className="text-foreground">Nuevo</span>
          </Link>
        </li>
        <li>
          <button
            type="button"
            className="text-muted-foreground relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium tracking-wide"
            onClick={() => setOpenMobile(true)}
            aria-label="Más opciones"
          >
            <Menu className="size-5" aria-hidden />
            Más
          </button>
        </li>
      </ul>
    </nav>
  )
}
