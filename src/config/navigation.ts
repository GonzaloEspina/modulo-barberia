import type { LucideIcon } from 'lucide-react'
import {
  Award,
  CalendarDays,
  CalendarRange,
  Clock,
  Coins,
  CreditCard,
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
    title: 'Barbería',
    items: [{ to: '/', label: 'Resumen', icon: LayoutDashboard }],
  },
  {
    title: 'Turnos',
    items: [
      { to: '/turnos', label: 'Calendario', icon: CalendarRange },
    ],
  },
  {
    title: 'Clientes',
    items: [
      { to: '/clientes', label: 'Clientes', icon: Users, adminOnly: true },
      { to: '/membresias', label: 'Membresías', icon: Award, adminOnly: true },
      { to: '/puntos', label: 'Puntos y premios', icon: Gift, adminOnly: true },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { to: '/servicios', label: 'Servicios', icon: Scissors, adminOnly: true },
      { to: '/barberos', label: 'Barberos', icon: UserRound, adminOnly: true },
      { to: '/gastos', label: 'Gastos', icon: Receipt, adminOnly: true },
    ],
  },
  {
    title: 'Reportes',
    items: [
      { to: '/balance', label: 'Balance', icon: Wallet },
      { to: '/turnos', label: 'Exportaciones', icon: Download },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { to: '/configuracion', label: 'Barbería', icon: Settings, adminOnly: true },
      { to: '/horarios', label: 'Horarios', icon: Clock, adminOnly: true },
      { to: '/excepciones', label: 'Días bloqueados', icon: CalendarDays, adminOnly: true },
      { to: '/configuracion', label: 'Métodos de pago', icon: CreditCard, adminOnly: true },
      { to: '/puntos', label: 'Puntos', icon: Coins, adminOnly: true },
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
