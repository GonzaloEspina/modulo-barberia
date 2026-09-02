-- Normalización móvil AR: 10 dígitos locales → 549 + número (no 54 + número).

CREATE OR REPLACE FUNCTION public.normalize_phone_ar(raw_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits TEXT;
  normalized TEXT;
  mobile15 TEXT[];
BEGIN
  digits := regexp_replace(COALESCE(raw_phone, ''), '[^0-9]', '', 'g');
  IF digits = '' THEN
    RETURN '';
  END IF;

  IF digits LIKE '54%' AND length(digits) >= 12 THEN
    RETURN digits;
  END IF;

  IF digits LIKE '0%' THEN
    digits := substring(digits FROM 2);
  END IF;

  -- 11 15 1234 5678 → 5491112345678
  IF digits ~ '^\d{2,4}15\d{6,8}$' THEN
    mobile15 := regexp_match(digits, '^(\d{2,4})15(\d{6,8})$');
    RETURN '549' || mobile15[1] || mobile15[2];
  END IF;

  normalized := digits;

  IF length(normalized) = 10 THEN
    RETURN '549' || normalized;
  END IF;

  IF length(normalized) = 11 AND normalized LIKE '9%' THEN
    RETURN '54' || normalized;
  END IF;

  IF length(normalized) BETWEEN 8 AND 11 AND normalized NOT LIKE '54%' THEN
    RETURN '54' || normalized;
  END IF;

  RETURN normalized;
END;
$$;

-- Re-normalizar teléfonos existentes desde phone_display (o valor actual).
UPDATE public.clients
SET phone_normalized = public.normalize_phone_ar(COALESCE(NULLIF(phone_display, ''), phone_normalized))
WHERE deleted_at IS NULL;
