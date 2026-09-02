import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from '@/features/auth/auth-context'

import { LoginPage } from '@/features/auth/login-page'

import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/protected-route'

import { ProfileGate } from '@/features/auth/profile-gate'

import { AdminRoute } from '@/features/auth/admin-route'

import { AppointmentCreatePage } from '@/features/appointments/appointment-create-page'

import { AppointmentDetailPage } from '@/features/appointments/appointment-detail-page'

import { CalendarPage } from '@/features/appointments/calendar-page'

import { AuditPage } from '@/features/audit/audit-page'

import { AvailabilityPage } from '@/features/availability/availability-page'

import { BalancePage } from '@/features/balance/balance-page'

import { BarberCreatePage } from '@/features/barbers/barber-create-page'

import { BarberEditPage } from '@/features/barbers/barber-edit-page'

import { BarbersPage } from '@/features/barbers/barbers-page'

import { ClientCreatePage } from '@/features/clients/client-create-page'

import { ClientEditPage } from '@/features/clients/client-edit-page'

import { ClientsPage } from '@/features/clients/clients-page'

import { DashboardPage } from '@/features/dashboard/dashboard-page'

import { ExpensesPage } from '@/features/expenses/expenses-page'

import { MembershipsPage } from '@/features/memberships/memberships-page'

import { PlatformPage } from '@/features/platform/platform-page'

import { PlatformIndexRedirect, PlatformRoute } from '@/features/platform/platform-route'

import { PointsPage } from '@/features/points/points-page'

import { PortalPage } from '@/features/portal/portal-page'

import { GeneralSchedulesPage } from '@/features/schedules/general-schedules-page'

import { ScheduleExceptionsPage } from '@/features/schedules/exceptions-page'

import { ServiceCreatePage } from '@/features/services/service-create-page'

import { ServiceEditPage } from '@/features/services/service-edit-page'

import { ServicesPage } from '@/features/services/services-page'

import { SettingsPage } from '@/features/settings/settings-page'
import { UserCreatePage } from '@/features/users/user-create-page'
import { UserEditPage } from '@/features/users/user-edit-page'
import { UsersPage } from '@/features/users/users-page'



const queryClient = new QueryClient({

  defaultOptions: {

    queries: {

      staleTime: 30_000,

      retry: 1,

    },

  },

})



export function App() {

  return (

    <QueryClientProvider client={queryClient}>

      <AuthProvider>

        <BrowserRouter>

          <Routes>

            <Route element={<PublicOnlyRoute />}>

              <Route path="/login" element={<LoginPage />} />

            </Route>

            <Route path="/portal" element={<PortalPage />} />

            <Route element={<ProtectedRoute />}>

              <Route element={<ProfileGate />}>

                <Route path="/" element={<DashboardPage />} />

                <Route path="/turnos" element={<CalendarPage />} />

                <Route path="/turnos/nuevo" element={<AppointmentCreatePage />} />

                <Route path="/turnos/:id" element={<AppointmentDetailPage />} />

                <Route path="/calendario" element={<Navigate to="/turnos" replace />} />

                <Route path="/balance" element={<BalancePage />} />

                <Route element={<AdminRoute />}>

                  <Route path="/clientes" element={<ClientsPage />} />

                  <Route path="/clientes/nuevo" element={<ClientCreatePage />} />

                  <Route path="/clientes/:id" element={<ClientEditPage />} />

                  <Route path="/barberos" element={<BarbersPage />} />

                  <Route path="/barberos/nuevo" element={<BarberCreatePage />} />

                  <Route path="/barberos/:id" element={<BarberEditPage />} />

                  <Route path="/usuarios" element={<UsersPage />} />

                  <Route path="/usuarios/nuevo" element={<UserCreatePage />} />

                  <Route path="/usuarios/:id" element={<UserEditPage />} />

                  <Route path="/servicios" element={<ServicesPage />} />

                  <Route path="/servicios/nuevo" element={<ServiceCreatePage />} />

                  <Route path="/servicios/:id" element={<ServiceEditPage />} />

                  <Route path="/horarios" element={<GeneralSchedulesPage />} />

                  <Route path="/excepciones" element={<ScheduleExceptionsPage />} />

                  <Route path="/disponibilidad" element={<AvailabilityPage />} />

                  <Route path="/membresias" element={<MembershipsPage />} />

                  <Route path="/puntos" element={<PointsPage />} />

                  <Route path="/gastos" element={<ExpensesPage />} />

                  <Route path="/auditoria" element={<AuditPage />} />

                  <Route path="/configuracion" element={<SettingsPage />} />

                </Route>

                <Route element={<PlatformRoute />}>

                  <Route path="/plataforma" element={<PlatformIndexRedirect />} />

                  <Route path="/plataforma/organizaciones" element={<PlatformPage />} />

                </Route>

              </Route>

            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>

        </BrowserRouter>

      </AuthProvider>

    </QueryClientProvider>

  )

}

