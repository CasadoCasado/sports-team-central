/**
 * La clave pública de Turnstile (variable de compilación). Sin ella no hay
 * reto en el registro; ver `components/turnstile.tsx`.
 */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export const turnstileActivo = Boolean(TURNSTILE_SITE_KEY);
