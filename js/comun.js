/* Utilidades compartidas por la web, el área de alumna y el panel */
(function () {
  const C = window.MOBA;
  const M = (window.M = {});
  M.sb = window.supabase.createClient(C.supabase.url, C.supabase.clave);

  // ---------- texto seguro ----------
  M.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  M.$ = (sel, el = document) => el.querySelector(sel);
  M.$$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  // ---------- formatos ----------
  M.eur = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
  M.hora = (d) => new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  M.fecha = (d, o) => new Date(d).toLocaleDateString('es-ES', o || { weekday: 'long', day: 'numeric', month: 'long' });
  M.fechaCorta = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  M.diasHasta = (d) => Math.ceil((new Date(d + (String(d).length === 10 ? 'T23:59:59' : '')) - new Date()) / 86400000);
  M.hoyISO = () => new Date().toLocaleDateString('sv-SE');
  M.DN = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  M.lunes = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  M.masDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  M.mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

  // ---------- enlaces ----------
  M.wa = (texto, tel = C.whatsapp) => 'https://wa.me/' + String(tel).replace(/\D/g, '') + (texto ? '?text=' + encodeURIComponent(texto) : '');
  M.telWa = (t) => { let d = String(t || '').replace(/\D/g, ''); if (d.length === 9) d = '34' + d; return d; };
  // El acceso es con móvil: cada número tiene un email interno que nunca recibe correos.
  M.emailDeTel = (t) => M.telWa(t) + '@alumnas.mobatraining.es';
  M.telValido = (t) => /^(34)?[6789]\d{8}$/.test(String(t || '').replace(/\D/g, '')) || String(t || '').replace(/\D/g, '').length >= 11;
  M.gmail = (to, asunto, cuerpo) => 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(to || '') + '&su=' + encodeURIComponent(asunto || '') + '&body=' + encodeURIComponent(cuerpo || '');

  // ---------- avisos ----------
  let tT;
  M.toast = (msg, mal) => {
    let t = M.$('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle('bad', !!mal); t.hidden = false;
    clearTimeout(tT); tT = setTimeout(() => (t.hidden = true), 3200);
  };
  M.error = (e) => {
    const m = (e && (e.message || e.error_description)) || String(e);
    const trad = {
      'Invalid login credentials': 'Email o contraseña incorrectos.',
      'Email not confirmed': 'Confirma tu email: te hemos enviado un enlace al registrarte.',
      'User already registered': 'Ya existe una cuenta con ese email. Inicia sesión.',
      'Password should be at least 6 characters.': 'La contraseña debe tener al menos 6 caracteres.'
    };
    M.toast(trad[m] || m, true);
  };

  // ---------- ventana modal ----------
  M.modal = (html, alAbrir) => {
    const w = document.createElement('div');
    w.className = 'modal';
    w.innerHTML = '<div class="box" role="dialog" aria-modal="true">' + html + '</div>';
    const cerrar = () => { w.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') cerrar(); };
    w.addEventListener('click', (e) => { if (e.target === w || e.target.closest('[data-cerrar]')) cerrar(); });
    document.addEventListener('keydown', esc);
    document.body.appendChild(w);
    const f = w.querySelector('input,select,textarea,button:not([data-cerrar])'); if (f) f.focus();
    if (alAbrir) alAbrir(w, cerrar);
    return cerrar;
  };

  // ---------- sesión ----------
  M.sesion = async () => (await M.sb.auth.getSession()).data.session;
  M.perfil = async () => {
    const s = await M.sesion(); if (!s) return null;
    const { data } = await M.sb.from('perfiles').select('*').eq('id', s.user.id).maybeSingle();
    return data;
  };
  M.salir = async () => { await M.sb.auth.signOut(); location.href = 'index.html'; };

  // ---------- ayuda de disciplina ----------
  M.colorDisc = { Pilates: 'a', Yoga: 'g', Funcional: 's', Personal: 'ok' };
})();
