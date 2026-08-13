// ============================================================================
// Configuración leída del entorno.
//
// Vive aparte de los componentes para que un archivo de UI no exporte también
// constantes: eso rompe el hot reload de React durante el desarrollo.
// ============================================================================

/** Clave pública de Cloudflare Turnstile. Vacía = captcha desactivado. */
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '') as string

/**
 * Si no hay clave configurada, el captcha se omite en el navegador y también en
 * la Edge Function. El proyecto tiene que poder desplegarse sin obligar a nadie
 * a abrir una cuenta de Cloudflare.
 */
export const turnstileActivo = TURNSTILE_SITE_KEY.length > 0
