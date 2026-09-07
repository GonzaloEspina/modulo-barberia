# Design System

<!-- impeccable:design-schema 1 -->

## Visual world

**Cartelera de sesiones.** El día de silla se lee como un programa de cine: hora, cliente, servicio, sala. No es un dashboard de tiles métricas.

## Palette

| Role | Value | Use |
|------|-------|-----|
| Lobby | `#eef1f6` | Fondo de app |
| Hoja | `#ffffff` | Listados, paneles |
| Tinta | `#141820` | Texto, sidebar, fila AHORA |
| Vermellón | `#c41230` | CTA, AHORA, acento operativo |
| Muted | `#5a6475` | Secundario |

Estrategia: Restrained — neutros + un acento. Vermellón solo para acción y “en curso”.

## Typography

- Body: **Barlow**
- Display / horas / montos: **Barlow Condensed** (`font-display`, `font-listing`)
- Mastheads en uppercase con tracking amplio

## Materials

- Radio ~3px (`rounded-sm`)
- `.listing-sheet`: hoja blanca con borde fino, sin sombra suave de tarjeta
- Sidebar tinta invertida
- Fila AHORA: fondo tinta, tipografía invertida, etiqueta “Ahora”

## Components

- Botones: `rounded-sm`; `accent` = vermellón
- Inputs / cards: `rounded-sm`, sin `shadow-sm` por defecto en cards
- Empty states: hoja con borde, sin dashed cards ornamentales
- BoxOfficeBar: producción vs caja en dos columnas

## Surfaces

- Staff Operate: Resumen (cartelera), agenda, clientes, caja, config, etc. heredan tokens
- Portal Operate: `/portal` login ink header + listing sheet; dashboard con tipografía de cartelera

## Motion

- Hover de filas: 150ms a tinta
- Sin glow ni glass decorativo

## Anti-reference

Inter + cream + terracotta tiles del look anterior. No hero-metric cards en Resumen.
