-- Seed: Barbatero + Gian Anibaldi + usuarios de desarrollo
-- UUIDs fijos para reproducibilidad en local

-- Organización
INSERT INTO public.organizations (id, name, phone, address, timezone, currency)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Barbatero',
  NULL,
  NULL,
  'America/Argentina/Buenos_Aires',
  'ARS'
);

UPDATE public.organizations
SET settings = settings || '{"portal_booking_mode": "all_except_denied"}'::jsonb
WHERE id = 'a0000000-0000-4000-8000-000000000001';

-- Barbero Gian Anibaldi
INSERT INTO public.barbers (
  id,
  organization_id,
  name,
  email,
  calendar_color,
  display_order
)
VALUES (
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  'Gian Anibaldi',
  'gian@barbatero.local',
  '#D97706',
  1
);

-- ---------------------------------------------------------------------------
-- Usuario admin: admin@barbatero.local / admin123456
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000003',
  'authenticated',
  'authenticated',
  'admin@barbatero.local',
  crypt('admin123456', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Administrador Barbatero"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-4000-8000-000000000010',
  'a0000000-0000-4000-8000-000000000003',
  '{"sub":"a0000000-0000-4000-8000-000000000003","email":"admin@barbatero.local"}'::jsonb,
  'email',
  'a0000000-0000-4000-8000-000000000003',
  now(),
  now(),
  now()
);

INSERT INTO public.profiles (id, organization_id, role, full_name, permissions)
VALUES (
  'a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000001',
  'admin',
  'Administrador Barbatero',
  '{"can_register_payments": true, "can_edit_own_schedule": true}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Usuario barbero: gian@barbatero.local / barber123456
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000004',
  'authenticated',
  'authenticated',
  'gian@barbatero.local',
  crypt('barber123456', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Gian Anibaldi"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000004',
  '{"sub":"a0000000-0000-4000-8000-000000000004","email":"gian@barbatero.local"}'::jsonb,
  'email',
  'a0000000-0000-4000-8000-000000000004',
  now(),
  now(),
  now()
);

UPDATE public.barbers
SET user_id = 'a0000000-0000-4000-8000-000000000004'
WHERE id = 'a0000000-0000-4000-8000-000000000002';

INSERT INTO public.profiles (id, organization_id, role, barber_id, full_name, permissions)
VALUES (
  'a0000000-0000-4000-8000-000000000004',
  'a0000000-0000-4000-8000-000000000001',
  'barber',
  'a0000000-0000-4000-8000-000000000002',
  'Gian Anibaldi',
  '{"can_register_payments": true, "can_edit_own_schedule": true}'::jsonb
);

-- Clientes de demostración
INSERT INTO public.clients (
  organization_id, first_name, last_name, phone_normalized, phone_display, email, nickname,
  manual_warning, manual_warning_reason, booking_override
) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Martín', 'Gómez', '5491112345678', '11 1234-5678', 'martin@email.com', 'Tincho', false, NULL, 'inherit'),
  ('a0000000-0000-4000-8000-000000000001', 'Lucas', 'Fernández', '5491123456789', '11 2345-6789', NULL, NULL, true, 'Suele llegar tarde', 'inherit'),
  ('a0000000-0000-4000-8000-000000000001', 'Diego', 'Ruiz', '5491134567890', '11 3456-7890', 'diego@email.com', 'Dieguito', false, NULL, 'denied'),
  ('a0000000-0000-4000-8000-000000000001', 'Santiago', 'López', '5491145678901', '11 4567-8901', NULL, NULL, false, NULL, 'allowed'),
  ('a0000000-0000-4000-8000-000000000001', 'Nicolás', 'Martínez', '5491156789012', '11 5678-9012', 'nico@email.com', 'Nico', false, NULL, 'inherit');

-- Barbero adicional inactivo (demo)
INSERT INTO public.barbers (
  organization_id, name, email, calendar_color, display_order, is_active
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Barbero Demo Inactivo',
  'inactivo@barbatero.local',
  '#16A34A',
  99,
  false
);

-- Servicios generales de demostración
INSERT INTO public.services (
  id, organization_id, name, description, price, duration_minutes, points_awarded, display_order, category_color
) VALUES
  (
    'a0000000-0000-4000-8000-000000000020',
    'a0000000-0000-4000-8000-000000000001',
    'Corte clásico',
    'Corte de cabello tradicional',
    15000,
    30,
    10,
    1,
    '#D97706'
  ),
  (
    'a0000000-0000-4000-8000-000000000021',
    'a0000000-0000-4000-8000-000000000001',
    'Barba',
    'Perfilado y arreglo de barba',
    8000,
    20,
    5,
    2,
    '#3B82F6'
  ),
  (
    'a0000000-0000-4000-8000-000000000022',
    'a0000000-0000-4000-8000-000000000001',
    'Corte + Barba',
    'Combo completo',
    22000,
    45,
    15,
    3,
    '#16A34A'
  ),
  (
    'a0000000-0000-4000-8000-000000000023',
    'a0000000-0000-4000-8000-000000000001',
    'Perfilado de cejas',
    NULL,
    5000,
    15,
    3,
    4,
    '#7C3AED'
  );

-- Override de precio para Gian en Corte clásico
INSERT INTO public.barber_services (
  organization_id, barber_id, service_id, price_override
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000020',
  18000
);

-- Servicio exclusivo de Gian
INSERT INTO public.barber_services (
  organization_id,
  barber_id,
  is_exclusive,
  exclusive_name,
  exclusive_price,
  exclusive_duration,
  exclusive_points
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  true,
  'Tratamiento capilar premium',
  25000,
  60,
  20
);

-- Horarios generales Barbatero (ISO: 1=Lun … 7=Dom)
INSERT INTO public.general_schedules (organization_id, day_of_week, start_time, end_time) VALUES
  ('a0000000-0000-4000-8000-000000000001', 1, '10:00', '13:00'),
  ('a0000000-0000-4000-8000-000000000001', 1, '14:00', '20:00'),
  ('a0000000-0000-4000-8000-000000000001', 2, '10:00', '13:00'),
  ('a0000000-0000-4000-8000-000000000001', 2, '14:00', '20:00'),
  ('a0000000-0000-4000-8000-000000000001', 3, '10:00', '13:00'),
  ('a0000000-0000-4000-8000-000000000001', 3, '14:00', '20:00'),
  ('a0000000-0000-4000-8000-000000000001', 4, '10:00', '13:00'),
  ('a0000000-0000-4000-8000-000000000001', 4, '14:00', '20:00'),
  ('a0000000-0000-4000-8000-000000000001', 5, '10:00', '13:00'),
  ('a0000000-0000-4000-8000-000000000001', 5, '14:00', '20:00'),
  ('a0000000-0000-4000-8000-000000000001', 6, '10:00', '14:00');

-- Métodos de pago demo
INSERT INTO public.payment_methods (organization_id, name, discount_type, discount_value, display_order) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Efectivo', 'percentage', 10, 1),
  ('a0000000-0000-4000-8000-000000000001', 'Transferencia', 'none', 0, 2),
  ('a0000000-0000-4000-8000-000000000001', 'Tarjeta', 'none', 0, 3);

-- Plan de membresía demo
INSERT INTO public.membership_plans (
  id, organization_id, name, price, appointments_included, validity_months, display_order
) VALUES (
  'a0000000-0000-4000-8000-000000000030',
  'a0000000-0000-4000-8000-000000000001',
  'Pack 4 turnos',
  50000,
  4,
  3,
  1
);

-- Config puntos e inasistencias
INSERT INTO public.points_config (organization_id) VALUES ('a0000000-0000-4000-8000-000000000001');
INSERT INTO public.absence_config (organization_id) VALUES ('a0000000-0000-4000-8000-000000000001');

-- Categoría y premio demo
INSERT INTO public.expense_categories (id, organization_id, name) VALUES (
  'a0000000-0000-4000-8000-000000000040',
  'a0000000-0000-4000-8000-000000000001',
  'General'
);

INSERT INTO public.rewards (
  organization_id, name, description, points_required, reward_type, value
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  '10% de descuento',
  'Canjeable en próximo turno',
  100,
  'percentage_discount',
  10
);

-- Membresía activa demo (Martín Gómez)
INSERT INTO public.client_memberships (
  organization_id, client_id, membership_plan_id, plan_name, price_paid,
  appointments_total, appointments_remaining, payment_confirmed,
  starts_at, expires_at, status
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  c.id,
  'a0000000-0000-4000-8000-000000000030',
  'Pack 4 turnos',
  50000,
  4,
  3,
  true,
  CURRENT_DATE,
  private.membership_expires_at(CURRENT_DATE, 3),
  'active'
FROM public.clients c
WHERE c.phone_normalized = '5491112345678'
LIMIT 1;

-- Puntos demo para Lucas Fernández (canje de prueba)
INSERT INTO public.point_movements (
  organization_id, client_id, movement_type, quantity, available_quantity, expires_at, reason
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  c.id,
  'manual_credit',
  150,
  150,
  now() + interval '12 months',
  'Saldo inicial demo'
FROM public.clients c
WHERE c.phone_normalized = '5491123456789'
LIMIT 1;

-- ---------------------------------------------------------------------------
-- Super admin plataforma: super@lomiva.local / super123456
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000005',
  'authenticated', 'authenticated',
  'super@lomiva.local',
  crypt('super123456', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Super Admin Lomiva"}',
  now(), now(),
  '', '', '', ''
);

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) VALUES (
  'a0000000-0000-4000-8000-000000000015',
  'a0000000-0000-4000-8000-000000000005',
  '{"sub":"a0000000-0000-4000-8000-000000000005","email":"super@lomiva.local"}'::jsonb,
  'email',
  'a0000000-0000-4000-8000-000000000005',
  now(), now(), now()
);

INSERT INTO public.profiles (id, organization_id, role, full_name, permissions)
VALUES (
  'a0000000-0000-4000-8000-000000000005',
  'a0000000-0000-4000-8000-000000000001',
  'admin',
  'Super Admin Lomiva',
  '{"can_register_payments": true, "can_edit_own_schedule": true}'::jsonb
);

INSERT INTO public.platform_admins (user_id) VALUES ('a0000000-0000-4000-8000-000000000005');

-- ---------------------------------------------------------------------------
-- Segunda barbería demo: Corte & Estilo
-- Admin: admin@corte.local / corte123456
-- ---------------------------------------------------------------------------
INSERT INTO public.organizations (id, name, phone, address, timezone, currency)
VALUES (
  'a0000000-0000-4000-8000-000000000010',
  'Corte & Estilo',
  '11 5555-0000',
  'Av. Demo 123',
  'America/Argentina/Buenos_Aires',
  'ARS'
);

UPDATE public.organizations
SET settings = settings || '{"portal_booking_mode": "allowlist_only"}'::jsonb
WHERE id = 'a0000000-0000-4000-8000-000000000010';

INSERT INTO public.barbers (id, organization_id, name, email, calendar_color, display_order)
VALUES (
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000010',
  'María López',
  'maria@corte.local',
  '#2563EB',
  1
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000012',
  'authenticated', 'authenticated',
  'admin@corte.local',
  crypt('corte123456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin Corte & Estilo"}',
  now(), now(), '', '', '', ''
);

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES (
  'a0000000-0000-4000-8000-000000000016',
  'a0000000-0000-4000-8000-000000000012',
  '{"sub":"a0000000-0000-4000-8000-000000000012","email":"admin@corte.local"}'::jsonb,
  'email', 'a0000000-0000-4000-8000-000000000012',
  now(), now(), now()
);

INSERT INTO public.profiles (id, organization_id, role, full_name, permissions)
VALUES (
  'a0000000-0000-4000-8000-000000000012',
  'a0000000-0000-4000-8000-000000000010',
  'admin',
  'Admin Corte & Estilo',
  '{"can_register_payments": true, "can_edit_own_schedule": true}'::jsonb
);

INSERT INTO public.points_config (organization_id) VALUES ('a0000000-0000-4000-8000-000000000010');
INSERT INTO public.absence_config (organization_id) VALUES ('a0000000-0000-4000-8000-000000000010');

INSERT INTO public.payment_methods (organization_id, name, display_order) VALUES
  ('a0000000-0000-4000-8000-000000000010', 'Efectivo', 1),
  ('a0000000-0000-4000-8000-000000000010', 'Transferencia', 2);

INSERT INTO public.services (
  id, organization_id, name, price, duration_minutes, points_awarded, display_order
) VALUES (
  'a0000000-0000-4000-8000-000000000013',
  'a0000000-0000-4000-8000-000000000010',
  'Corte clásico',
  8000,
  30,
  10,
  1
);

INSERT INTO public.clients (
  organization_id, first_name, last_name, phone_normalized, phone_display, booking_override
) VALUES (
  'a0000000-0000-4000-8000-000000000010',
  'Ana',
  'Ruiz',
  '5491198765432',
  '11 9876-5432',
  'allowed'
);

INSERT INTO public.rewards (
  organization_id, name, points_required, reward_type, stock
) VALUES (
  'a0000000-0000-4000-8000-000000000010',
  '10% descuento',
  50,
  'percentage_discount',
  20
);
