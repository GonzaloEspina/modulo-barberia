import type { UserRole } from '@/types/database'
import { ROLE_LABELS } from '@/types/database'

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className="bg-muted text-foreground inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium">
      {ROLE_LABELS[role]}
    </span>
  )
}
