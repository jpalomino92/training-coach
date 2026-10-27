/* ==========================================================
   Edge Function "rest-push": envía las notificaciones de fin de
   descanso que ya vencieron. La llama cada 5 s el cron de Supabase
   (public.fire_rest_alarms, solo si hay alguna pendiente); no
   recibe datos: toma las alarmas con take_due_rest_alarms().

   Secretos: VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (en .env.push al
   generarlas) y, opcional, VAPID_SUBJECT (mailto: de contacto).
   Un solo archivo para poder pegarlo en el editor del panel de Supabase.
   ========================================================== */
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:soporte@example.com';

interface Due { endpoint: string; p256dh: string; auth: string; title: string; body: string }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  if (!PUBLIC || !PRIVATE) return json({ error: 'Faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.' }, 500);
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.rpc('take_due_rest_alarms');
  if (error) { console.error('take_due_rest_alarms', error.message); return json({ error: 'No se pudieron leer las alarmas.' }, 500); }

  const due = (data || []) as Due[];
  let sent = 0;
  await Promise.all(due.map(async d => {
    try {
      await webpush.sendNotification(
        { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
        JSON.stringify({ title: d.title || '¡Se acabó el descanso!', body: d.body || 'Toca la siguiente serie.' }),
        // Si no llega en un minuto ya no sirve; "high" para que despierte el teléfono
        { TTL: 60, urgency: 'high' }
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Suscripción caducada o anulada: se borra
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', d.endpoint);
      else console.error('push', status, (e as Error).message);
    }
  }));
  return json({ due: due.length, sent });
});
