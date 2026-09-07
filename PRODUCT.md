# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary operators: **administrador** de una barbería y **barbero**, usando la PWA en el local (escritorio, tablet o teléfono) durante el día de silla. El administrador corre la agenda, caja, clientes, equipo y fidelización; el barbero ve y opera **solo sus propios turnos** (y su balance), y solo crea turnos asignados a sí mismo.

Secondary: **cliente final** en `/portal`, que entra con el teléfono registrado para ver turnos, puntos, canjes y membresías, y reservar si la política de la barbería lo permite.

Platform: **super admin de Lomiva** (`/plataforma`, `/auditoria`) gestiona organizaciones multi-tenant.

## Product Purpose

Reemplazo de la app AppSheet **Barbatero** por un sistema web multi-tenant, responsive e instalable como PWA para **gestionar el día de la barbería**: turnos con motor de disponibilidad, asistencia, pagos sin excedente, membresías (paquetes de turnos), puntos/premios (ledger FEFO), gastos y balance producción vs caja.

Éxito: el local deja de depender de AppSheet/planillas y puede cargar un turno, cobrar, y leer el día (quién sigue, plata vs producción) sin fricción.

## Positioning

No es un widget de reservas. Es el **sistema operativo del local**: turnos, caja, membresías y puntos viven en un mismo ledger transaccional (PostgreSQL + RLS), con totales históricos congelados y disponibilidad calculada en servidor. Membresías y puntos son módulos independientes. Multi-tenant desde el diseño (`organization_id` + RLS).

## Operating Context

- Idioma y voz: español rioplatense (vos). Zona horaria UI: `America/Argentina/Buenos_Aires`; UTC en BD. Moneda: ARS.
- Organización seed: **Barbatero**, barbero **Gian Anibaldi**.
- Auth staff: email/contraseña (Supabase Auth + `profiles`). Portal: teléfono (sesión de portal).
- Uso típico: alta frecuencia en Agenda (`/turnos`, FullCalendar), Resumen (`/`), alta de turno (`/turnos/nuevo`), detalle/cobro, portal cliente en el celular.
- Desarrollo local hasta validación; sin push/deploy/remoto sin autorización.

## Capabilities and Constraints

Confirmed functionality (routes in `src/app/App.tsx`):

- Staff: login, resumen, agenda/calendario, nuevo turno, detalle, exportaciones, balance.
- Admin: clientes, barberos, usuarios, servicios, horarios, días bloqueados, disponibilidad, membresías, puntos y premios, gastos, configuración de barbería.
- Platform: auditoría, organizaciones.
- Portal cliente (`/portal`): acceso por teléfono, puntos/canjes, turnos, reserva si aplica, membresías visibles.

Constraints to preserve:

- Stack vigente: React 19 + TypeScript + Vite + Tailwind 4 + shadcn/Radix + TanStack Query + React Router + Supabase. No inventar otro framework.
- Comportamiento, copy fáctico, datos y flujos existentes. No fabricar claims comerciales, testimonios ni precios.
- Barbero: solo turnos propios. Pagos: sin excedente; descuento sobre subtotal congelado. Portal: modos `all_except_denied` | `allowlist_only` | `disabled` + override por cliente.

Undecided (not specified by the user this session): accessibility standard beyond existing UI patterns; brand lock beyond product names already in the repo.

## Brand Commitments

- Product/org names in use: **Barbatero** (organización y PWA `name`/`short_name`), **Lomiva** (plataforma), título de documento **Barbería**.
- Voice: labels y mensajes en español argentino, informal y operativo (Ingresá, Verificá, Salir).
- Binding request this session: rediseño visual completo de todas las secciones, pantallas y portal; web-responsive; moderno, funcional e intuitivo. El look anterior (crema + charcoal + oro + Inter + cards shadcn genéricas) es anti-referencia, no identidad a preservar.
- No hay logo vectorial de marca comprometido más allá de ícono tijeras y PNGs PWA.

## Evidence on Hand

- Spec: `docs/DOCUMENTO_TECNICO.md`
- App: `src/app/App.tsx`, `src/config/navigation.ts`, `src/features/*`
- Seed/test users in `README.md` (local only)
- Do not fabricate: testimonials, press, customer logos, pricing, live production URLs, or claims the product does not implement.

## Product Principles

1. **El día de silla manda.** Agenda, próximo turno y caja deben ser escaneables en segundos, en el dispositivo que esté en el local.
2. **La verdad es transaccional.** Totales congelados, ledger de puntos, pagos sin excedente: la UI no puede contradecir el estado real.
3. **Roles nítidos.** Admin, barbero y cliente ven mundos distintos; no mezclar datos de caja o de otros clientes en el portal.
4. **Una barbería, muchas orgs.** Multi-tenant es estructural; el nombre en pantalla es el de la organización, no un brand genérico.
5. **Copy del local.** Español rioplatense, verbos de oficio (turno, silla, caja, canje), sin marketing inventado.

## Accessibility & Inclusion

No hay estándar formal fijado por el usuario. Inferido del código: UI en español, controles nativos (labels, focus rings, `aria-*` en varios componentes), PWA con `viewport-fit=cover`. Preservar y no degradar contraste, teclado y tamaños táctiles en el rediseño.

<!-- Init substitution: no structured interview tool was available (subagent run). Product truth taken from README, DOCUMENTO_TECNICO.md, routes, and the user's redesign brief. Visual direction is owned by new-work, not this file. Build-path preference was not stored. -->
