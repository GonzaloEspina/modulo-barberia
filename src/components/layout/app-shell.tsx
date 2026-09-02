import { Link, useLocation } from 'react-router-dom'
import { LogOut, Scissors, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NAV_GROUPS, NAV_PATHS, PLATFORM_NAV } from '@/config/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/features/auth/auth-context'
import { useIsPlatformAdmin } from '@/features/platform/api'
import { isAdminRole, useProfile } from '@/hooks/use-profile'
import { ROLE_LABELS } from '@/types/database'
import { cn } from '@/lib/utils'

function resolveActiveNavPath(pathname: string, navPaths: string[]) {
  if (pathname === '/') return '/'

  const matches = navPaths
    .filter((path) => path !== '/')
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)

  return matches[0] ?? null
}

function isActivePath(pathname: string, to: string, navPaths: string[]) {
  if (to === '/') return pathname === '/'
  return resolveActiveNavPath(pathname, navPaths) === to
}

interface AppShellProps {
  children: ReactNode
}

function SidebarNavLink({
  to,
  isActive,
  label,
  icon: Icon,
}: {
  to: string
  isActive: boolean
  label: string
  icon: LucideIcon
}) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
      <Link
        to={to}
        onClick={() => {
          if (isMobile) setOpenMobile(false)
        }}
      >
        <Icon className="size-4" />
        <span>{label}</span>
      </Link>
    </SidebarMenuButton>
  )
}

export function AppShell({ children }: AppShellProps) {
  const { signOut } = useAuth()
  const { data: profile } = useProfile()
  const { data: isPlatformAdmin } = useIsPlatformAdmin()
  const location = useLocation()
  const isAdmin = profile && isAdminRole(profile)

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="border-sidebar-border border-b">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <Scissors className="size-4" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold">{profile?.organization?.name ?? 'Barbatero'}</p>
              <p className="text-muted-foreground truncate text-xs">Gestión de barbería</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => {
              if (item.platformOnly) return false
              if (item.adminOnly && !isAdmin) return false
              return true
            })
            if (items.length === 0) return null
            return (
              <SidebarGroup key={group.title}>
                <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.map((item) => (
                      <SidebarMenuItem key={`${group.title}-${item.to}-${item.label}`}>
                        <SidebarNavLink
                          to={item.to}
                          isActive={isActivePath(location.pathname, item.to, NAV_PATHS)}
                          label={item.label}
                          icon={item.icon}
                        />
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )
          })}
          {isPlatformAdmin && (
            <SidebarGroup>
              <SidebarGroupLabel>Sistema</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarNavLink
                      to={PLATFORM_NAV.to}
                      isActive={location.pathname.startsWith(PLATFORM_NAV.to)}
                      label={PLATFORM_NAV.label}
                      icon={PLATFORM_NAV.icon}
                    />
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter className="border-sidebar-border border-t">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="h-auto py-2">
                    <div className="bg-muted flex size-8 items-center justify-center rounded-lg text-xs font-semibold">
                      {profile?.full_name?.slice(0, 1).toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0 text-left group-data-[collapsible=icon]:hidden">
                      <p className="truncate text-sm font-medium">{profile?.full_name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {profile ? ROLE_LABELS[profile.role] : ''}
                      </p>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuItem onClick={() => void signOut()}>
                    <LogOut className="size-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-0">
        <header className="bg-background/80 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="hidden h-5 sm:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile?.organization?.name}</p>
          </div>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => void signOut()}>
            <LogOut className="size-4" />
            Salir
          </Button>
        </header>
        <main className={cn('flex min-h-0 flex-1 flex-col p-4 md:p-6 lg:p-8')}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
