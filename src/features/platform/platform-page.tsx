import { Building2 } from 'lucide-react'
import { useState } from 'react'
import { PageHeader, SectionHeader } from '@/components/design-system/layout-primitives'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlatformOrganizations } from '@/features/platform/api'
import { usePlatformMutations } from '@/features/platform/platform-mutations'

export function PlatformPage() {
  const { data: orgs, isLoading, error } = usePlatformOrganizations()
  const { createOrganization, createOrganizationWithAdmin, assignAdmin, switchOrganization } = usePlatformMutations()

  const [orgName, setOrgName] = useState('')
  const [orgPhone, setOrgPhone] = useState('')
  const [orgAddress, setOrgAddress] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [newAdminName, setNewAdminName] = useState('')
  const [assignOrgId, setAssignOrgId] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [message, setMessage] = useState('')

  const handleCreate = async () => {
    setMessage('')
    try {
      const id = await createOrganization.mutateAsync({
        name: orgName,
        phone: orgPhone || undefined,
        address: orgAddress || undefined,
      })
      setMessage(`Barbería creada. ID: ${id}`)
      setOrgName('')
      setOrgPhone('')
      setOrgAddress('')
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  const handleAssign = async () => {
    setMessage('')
    try {
      await assignAdmin.mutateAsync({ orgId: assignOrgId, email: adminEmail })
      setMessage('Administrador asignado')
      setAdminEmail('')
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plataforma Lomiva"
        description="Vista global de barberías (super admin)."
        actions={
          <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-xl">
            <Building2 className="size-5" aria-hidden />
          </div>
        }
      />

      {message && <p className="text-sm">{message}</p>}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <SectionHeader title="Nueva barbería con administrador" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Nombre barbería" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <Input placeholder="Nombre admin" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} />
            <Input placeholder="Email admin" type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} />
            <Input placeholder="Contraseña (mín. 8)" type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} />
            <Button
              variant="accent"
              className="sm:col-span-2 sm:max-w-xs"
              onClick={() => void (async () => {
                setMessage('')
                try {
                  const row = await createOrganizationWithAdmin.mutateAsync({
                    name: orgName,
                    adminEmail: newAdminEmail,
                    adminPassword: newAdminPassword,
                    adminFullName: newAdminName || undefined,
                  })
                  setMessage(`Barbería creada. Admin: ${newAdminEmail}`)
                  setOrgName('')
                  setNewAdminEmail('')
                  setNewAdminPassword('')
                  setNewAdminName('')
                  void row
                } catch (e) {
                  setMessage((e as Error).message)
                }
              })()}
            >
              Crear barbería + admin
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <SectionHeader title="Nueva barbería (solo org)" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Nombre" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <Input placeholder="Teléfono" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} />
            <Input placeholder="Dirección" value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} />
            <Button variant="accent" className="sm:col-span-3 sm:max-w-xs" onClick={() => void handleCreate()}>
              Crear organización
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <SectionHeader title="Asignar administrador" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Organización</Label>
              <select
                className="border-input bg-background flex h-9 w-full rounded-lg border px-3 text-sm"
                value={assignOrgId}
                onChange={(e) => setAssignOrgId(e.target.value)}
              >
                <option value="">Elegir…</option>
                {orgs?.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Email del usuario existente</Label>
              <Input placeholder="admin@ejemplo.local" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            </div>
            <Button variant="outline" className="sm:max-w-xs" onClick={() => void handleAssign()}>
              Asignar como admin
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      )}
      {error && <p className="text-destructive text-sm">{(error as Error).message}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {orgs?.map((org) => (
          <Card key={org.id}>
            <CardContent className="space-y-2 pt-6 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold">{org.name}</p>
                <span className={`text-xs font-normal ${org.is_active ? 'text-green-700' : 'text-muted-foreground'}`}>
                  {org.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              {org.phone && <p className="text-muted-foreground">{org.phone}</p>}
              {org.address && <p className="text-muted-foreground">{org.address}</p>}
              <div className="flex flex-wrap gap-3 pt-2">
                <span>{org.clients_count} clientes</span>
                <span>{org.barbers_count} barberos</span>
                <span>{org.appointments_count} turnos</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={switchOrganization.isPending}
                onClick={() => void switchOrganization.mutateAsync(org.id)}
              >
                Entrar a esta barbería
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
