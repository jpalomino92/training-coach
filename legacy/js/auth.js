/* ==========================================================
   Authentication
   Interfaz común:
     signUp(email, password) → { id, email }
     signIn(email, password) → { id, email }
     signOut()
     getSession()            → { id, email } | null
   DemoAuth: la contraseña NUNCA se guarda. Solo se guarda un hash
   PBKDF2-SHA256 con sal aleatoria. Aun así es un modo de prueba:
   todo vive en este dispositivo y no sustituye a un backend real.
   ========================================================== */
(function () {
  'use strict';
  const USERS_KEY = 'rtp2:users';
  const SESSION_KEY = 'rtp2:session';
  const ITER = 150000;

  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const normEmail = e => String(e || '').trim().toLowerCase();

  function validate(email, password) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Escribe un email válido.');
    if (!password || password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  async function derive(password, saltBytes, iter) {
    if (!(window.crypto && crypto.subtle)) throw new Error('Este navegador no permite el cifrado necesario. Abre la app desde https o localhost.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: iter }, key, 256);
    return b64(bits);
  }
  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  const DemoAuth = {
    mode: 'demo',
    _users() { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch (e) { return []; } },
    _saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); },
    _setSession(u) { localStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, email: u.email })); },

    async signUp(email, password) {
      email = normEmail(email); validate(email, password);
      const users = this._users();
      if (users.some(u => u.email === email)) throw new Error('Ya existe una cuenta con ese email en este dispositivo. Inicia sesión.');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const user = { id: window.AppStorage.uid(), email, salt: b64(salt), hash: await derive(password, salt, ITER), iter: ITER, created_at: new Date().toISOString() };
      users.push(user); this._saveUsers(users); this._setSession(user);
      return { id: user.id, email };
    },
    async signIn(email, password) {
      email = normEmail(email);
      if (!email || !password) throw new Error('Escribe tu email y tu contraseña.');
      const u = this._users().find(x => x.email === email);
      const fail = new Error('Email o contraseña incorrectos.');
      if (!u) { await derive(password, new Uint8Array(16), 1000); throw fail; }
      const h = await derive(password, unb64(u.salt), u.iter || ITER);
      if (!safeEqual(h, u.hash)) throw fail;
      this._setSession(u);
      return { id: u.id, email: u.email };
    },
    async signOut() { localStorage.removeItem(SESSION_KEY); },
    async getSession() {
      try {
        const s = JSON.parse(localStorage.getItem(SESSION_KEY));
        if (s && this._users().some(u => u.id === s.id)) return s;
      } catch (e) { /* sin sesión */ }
      return null;
    }
  };

  function SupabaseAuth(client) {
    const map = u => u ? { id: u.id, email: u.email } : null;
    return {
      mode: 'supabase',
      client,
      async signUp(email, password) {
        email = normEmail(email); validate(email, password);
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        if (!data.session) throw new Error('Revisa tu email para confirmar la cuenta y después inicia sesión.');
        return map(data.user);
      },
      async signIn(email, password) {
        const { data, error } = await client.auth.signInWithPassword({ email: normEmail(email), password });
        if (error) throw new Error('Email o contraseña incorrectos.');
        return map(data.user);
      },
      async signOut() { await client.auth.signOut(); },
      async getSession() {
        const { data } = await client.auth.getSession();
        return map(data.session && data.session.user);
      }
    };
  }

  function createAuth() {
    const cfg = window.AppConfig;
    if (cfg.mode === 'supabase') {
      if (!window.supabase || !cfg.supabase.url || !cfg.supabase.anonKey) throw new Error('Supabase no está configurado. Revisa js/config.js.');
      const client = window.supabase.createClient(cfg.supabase.url, cfg.supabase.anonKey);
      return SupabaseAuth(client);
    }
    return DemoAuth;
  }

  window.AppAuth = { createAuth, DemoAuth };
})();
