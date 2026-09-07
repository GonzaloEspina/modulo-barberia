# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Administradores y barberos de barberías que gestionan el día de silla: turnos, clientes, caja, horarios, membresías y fidelización. Clientes finales que consultan turnos, puntos y reservan desde el portal (`/portal`).

## Product Purpose

Barbatero reemplaza la app AppSheet del mismo nombre con un sistema web multi-tenant de gestión de turnos. Éxito = el operador escanea el programa de hoy, crea/ajusta turnos sin fricción, cobra y cierra caja; el cliente consulta y reserva sin llamar.

## Positioning

Motor de disponibilidad transaccional en PostgreSQL + ledger de puntos FEFO + membresías independientes de puntos, con portal configurable por organización y override por cliente. Multi-tenant con RLS por `organization_id`.

## Operating Context

Uso diario en local (desktop/tablet) y a veces móvil. Zona horaria `America/Argentina/Buenos_Aires`. PWA instalable. Stack: React + TypeScript + Vite + Tailwind + shadcn/ui + Supabase.

## Capabilities and Constraints

- Roles: admin (org), barber (solo sus turnos), platform admin.
- Módulos: agenda/calendario, clientes, barberos, servicios, horarios/excepciones, membresías, puntos/premios, balance/gastos, portal, configuración, plataforma.
- Portal: acceso por teléfono; reservas según `portal_booking_mode` + override por cliente; un turno próximo por cliente.
- No inventar precios, clientes ni claims de negocio.

## Brand Commitments

Nombre de producto/org seed: **Barbatero**. Voz operativa en español rioplatense (vos). Sin landing de marketing en este producto.

## Evidence on Hand

Código en `src/`, docs en `docs/DOCUMENTO_TECNICO.md`, seed Supabase. Ausencia: no hay sistema de diseño documentado previo a este rediseño; el look Inter + cream/terracotta es anti-referencia.

## Product Principles

1. El día de silla es el centro: hora, cliente, servicio, sala/barbero primero.
2. Operar rápido: scanabilidad sobre ornamentación.
3. Portal y staff comparten una misma identidad, con densidad adecuada a cada tarea.
4. Datos reales y estados honestos (vacío, carga, error).
5. Responsive de verdad: la misma lectura en 390 y 1440.

## Accessibility & Inclusion

Contraste WCAG AA en texto de cuerpo; foco visible; controles con nombre de acción.
