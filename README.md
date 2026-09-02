# Barbatero — Sistema de gestión de turnos

Reemplazo de la aplicación AppSheet **Barbatero** con React + Supabase.

## Requisitos

- Node.js 20+
- Docker Desktop (para Supabase local)
- npm

## Configuración local

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local
# Completar VITE_SUPABASE_ANON_KEY después de iniciar Supabase

# 3. Supabase local (requiere Docker)
npx supabase start

# Copiar anon key del output de supabase start a .env.local

# 4. Desarrollo
npm run dev
```

La app corre en `http://localhost:5173`.

## Usuarios de prueba (después de `supabase db reset`)

| Rol | Email | Contraseña |
|-----|-------|------------|
| Administrador | `admin@barbatero.local` | `admin123456` |
| Barbero (Gian Anibaldi) | `gian@barbatero.local` | `barber123456` |
| Super admin plataforma | `super@lomiva.local` | `super123456` |
| Admin Corte & Estilo (2da org) | `admin@corte.local` | `corte123456` |

La organización seed es **Barbatero** con el barbero **Gian Anibaldi** preconfigurado.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run typecheck` | Verificación TypeScript |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run test:e2e` | Playwright (smoke tests) |
| `npx supabase start` | Iniciar Supabase local |
| `npx supabase db reset` | Reset migraciones + seed |

## Rama de trabajo

Desarrollo en rama local `develop`. Sin push ni deploy sin autorización.

## Documentación

Ver `docs/DOCUMENTO_TECNICO.md` para arquitectura completa.
