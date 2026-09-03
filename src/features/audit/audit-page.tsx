import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatAppDateTime } from '@/lib/app-datetime'
import { getSupabaseClient } from '@/lib/supabase'

interface AuditLogRow {
  id: string
  entity_type: string
  entity_id: string | null
  action: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

export function AuditPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: logs } = useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('audit_log')
        .select('id, entity_type, entity_id, action, old_values, new_values, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as AuditLogRow[]
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría"
        description="Cambios en turnos, pagos y membresías."
      />

      <div className="grid gap-2">
        {logs?.map((log) => (
          <Card key={log.id}>
            <CardContent className="space-y-2 p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{log.entity_type} · {log.action}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatAppDateTime(log.created_at)}
                    {log.entity_id && ` · ${log.entity_id.slice(0, 8)}…`}
                  </p>
                </div>
                {(log.old_values || log.new_values) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    {expandedId === log.id ? 'Ocultar' : 'Detalle'}
                  </Button>
                )}
              </div>
              {expandedId === log.id && (
                <div className="grid gap-2 border-t pt-2 sm:grid-cols-2">
                  {log.old_values && (
                    <pre className="bg-muted max-h-48 overflow-auto rounded-lg p-2 text-xs">
                      {JSON.stringify(log.old_values, null, 2)}
                    </pre>
                  )}
                  {log.new_values && (
                    <pre className="bg-muted max-h-48 overflow-auto rounded-lg p-2 text-xs">
                      {JSON.stringify(log.new_values, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
