import type { LucideIcon } from 'lucide-react'
import {
  Award,
  CalendarDays,
  CalendarRange,
  Clock,
  Download,
  Gift,
  LayoutDashboard,
  Receipt,
  Scissors,
  Settings,
  Shield,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
  platformOnly?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Resumen',
    items: [{ to: '/', label: 'Resumen', icon: LayoutDashboard }],
  },
  {
    title: 'Agenda',
    items: [{ to: '/turnos', label: 'Agenda', icon: CalendarRange }],
  },
  {
    title: 'Clientes',
    items: [{ to: '/clientes', label: 'Clientes', icon: Users, adminOnly: true }],
  },
  {
    title: 'Fidelización',
    items: [
      { to: '/membresias', label: 'Membresías', icon: Award, adminOnly: true },
      { to: '/puntos', label: 'Puntos y premios', icon: Gift, adminOnly: true },
    ],
  },
  {
    title: 'Equipo',
    items: [
      { to: '/barberos', label: 'Barberos', icon: UserRound, adminOnly: true },
      { to: '/usuarios', label: 'Usuarios', icon: Shield, adminOnly: true },
    ],
  },
  {
    title: 'Caja',
    items: [
      { to: '/balance', label: 'Balance', icon: Wallet },
      { to: '/gastos', label: 'Gastos', icon: Receipt, adminOnly: true },
    ],
  },
  {
    title: 'Reportes',
    items: [{ to: '/exportaciones', label: 'Exportaciones', icon: Download }],
  },
  {
    title: 'Configuración',
    items: [
      { to: '/configuracion', label: 'Barbería', icon: Settings, adminOnly: true },
      { to: '/servicios', label: 'Servicios', icon: Scissors, adminOnly: true },
      { to: '/horarios', label: 'Horarios', icon: Clock, adminOnly: true },
      { to: '/excepciones', label: 'Días bloqueados', icon: CalendarDays, adminOnly: true },
      { to: '/disponibilidad', label: 'Disponibilidad', icon: CalendarRange, adminOnly: true },
      { to: '/auditoria', label: 'Auditoría', icon: Shield, adminOnly: true },
    ],
  },
]

export const PLATFORM_NAV: NavItem = {
  to: '/plataforma/organizaciones',
  label: 'Plataforma',
  icon: Shield,
  platformOnly: true,
}

export const NAV_PATHS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.to))
