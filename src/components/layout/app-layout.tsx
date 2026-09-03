import { LogOut, Menu, Scissors, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useIsPlatformAdmin } from '@/features/platform/api'
import { isAdminRole, useProfile } from '@/hooks/use-profile'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/types/database'

interface AppLayoutProps {
  children: ReactNode
}

function useNavItems() {
  const { data: profile } = useProfile()
  const { data: isPlatformAdmin } = useIsPlatformAdmin()
  const items = [
    { to: '/', label: 'Inicio' },
    { to: '/turnos', label: 'Turnos' },
    { to: '/calendario', label: 'Calendario' },
    { to: '/balance', label: 'Balance' },
  ]
  if (profile && isAdminRole(profile)) {
    items.push(
      { to: '/clientes', label: 'Clientes' },
      { to: '/barberos', label: 'Barberos' },
      { to: '/servicios', label: 'Servicios' },
      { to: '/horarios', label: 'Horarios' },
      { to: '/excepciones', label: 'Excepciones' },
      { to: '/disponibilidad', label: 'Disponibilidad' },
      { to: '/membresias', label: 'Membresías' },
      { to: '/puntos', label: 'Puntos' },
      { to: '/gastos', label: 'Gastos' },
      { to: '/configuracion', label: 'Configuración' },
    )
  }
  if (isPlatformAdmin) {
    items.push(
      { to: '/auditoria', label: 'Auditoría' },
      { to: '/plataforma/organizaciones', label: 'Plataforma' },
    )
  }
  return items
}

export function AppLayout({ children }: AppLayoutProps) {
  const { signOut } = useAuth()
  const { data: profile, isLoading } = useProfile()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navItems = useNavItems()

  const orgName = profile?.organization?.name ?? 'Barbería'
  const roleLabel = profile ? ROLE_LABELS[profile.role] : '—'

  return (
    <div className="bg-background min-h-svh">
      <header className="bg-card sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
                <Scissors className="size-4" aria-hidden="true" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">{orgName}</p>
                <p className="text-muted-foreground text-xs">
                  {isLoading ? 'Cargando…' : roleLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <span className="text-muted-foreground text-sm">{profile?.full_name}</span>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut className="size-4" aria-hidden="true" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl">
        <aside
          className={cn(
            'bg-card fixed inset-x-0 top-14 z-30 border-b p-4 md:static md:w-56 md:border-r md:border-b-0 md:min-h-[calc(100svh-3.5rem)]',
            mobileOpen ? 'block' : 'hidden md:block',
          )}
        >
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-surface-hover hover:text-white',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 border-t pt-4 md:hidden">
            <Button variant="outline" className="w-full" onClick={() => void signOut()}>
              <LogOut className="size-4" aria-hidden="true" />
              Cerrar sesión
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
