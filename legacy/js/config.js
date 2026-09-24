/* ==========================================================
   Configuración
   mode: 'demo'     → cuentas y datos en localStorage de este dispositivo.
   mode: 'supabase' → Supabase Auth + PostgreSQL con Row Level Security.
   Para producción: crea el proyecto en Supabase, ejecuta supabase/schema.sql,
   rellena url y anonKey y cambia mode a 'supabase'.
   ========================================================== */
window.AppConfig = {
  mode: 'demo',
  supabase: {
    url: '',      // p. ej. https://xxxx.supabase.co
    anonKey: ''   // clave pública "anon" (nunca la service_role)
  }
};
