/* Área de la alumna: acceso, reservas, bonos, videoteca y perfil */
(async function () {
  const C = window.MOBA, sb = M.sb, esc = M.esc, $ = M.$, $$ = M.$$;
  const qs = new URLSearchParams(location.search);
  $('#nav-wa').href = M.wa('Hola María, tengo una pregunta sobre mi cuenta de Moba Training.');

  // ================= ACCESO =================
  const vista = (f) => { ['f-login', 'f-reg'].forEach((x) => ($('#' + x).hidden = x !== f)); $('#a-ok').hidden = true; $('#a-login').setAttribute('aria-selected', f === 'f-login'); $('#a-reg').setAttribute('aria-selected', f === 'f-reg'); };
  $('#a-login').onclick = () => vista('f-login');
  $('#a-reg').onclick = () => vista('f-reg');
  const ok = (m) => { const e = $('#a-ok'); e.textContent = m; e.hidden = false; };
  const traducir = (error) => {
    const m = error && error.message || '';
    if (m === 'Invalid login credentials') return M.toast('Móvil o contraseña incorrectos.', true);
    if (m === 'User already registered') return M.toast('Ya hay una cuenta con ese móvil. Entra con tu contraseña.', true);
    if (/confirm/i.test(m)) return M.toast('Ahora mismo no se pueden crear cuentas. Escribe a María por WhatsApp.', true);
    M.error(error);
  };

  $('#f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tel = $('#l-tel').value.trim();
    if (!M.telValido(tel)) return M.toast('Escribe tu móvil', true);
    const { error } = await sb.auth.signInWithPassword({ email: M.emailDeTel(tel), password: $('#l-pass').value });
    if (error) return traducir(error);
    arrancar();
  });
  $('#l-olvido').href = M.wa('Hola María, he olvidado la contraseña de mi cuenta de Moba Training. ¿Me das una nueva?');
  $('#f-reg').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = $('#r-nombre').value.trim(), tel = $('#r-tel').value.trim(), pass = $('#r-pass').value;
    if (!nombre) return M.toast('Escribe tu nombre', true);
    if (!M.telValido(tel)) return M.toast('Escribe tu móvil con WhatsApp: es tu usuario y el número de las videollamadas', true);
    if (pass.length < 6) return M.toast('La contraseña debe tener al menos 6 caracteres', true);
    if (!$('#r-legal').checked) return M.toast('Acepta la política de privacidad para crear la cuenta', true);
    const { data, error } = await sb.auth.signUp({
      email: M.emailDeTel(tel), password: pass,
      options: { data: { nombre, telefono: tel, acepta_emails: $('#r-emails').checked } }
    });
    if (error) return traducir(error);
    if (data.session) return arrancar();
    ok('Cuenta creada, pero no se ha podido iniciar sesión. Escribe a María por WhatsApp para activarla.');
    $('#f-reg').hidden = true;
  });

  // ================= APP =================
  let yo = null, bonos = [], misRes = [], productos = [];

  async function arrancar() {
    const s = await M.sesion();
    if (!s) { $('#v-auth').hidden = false; $('#v-app').hidden = true; if (qs.get('comprar') || qs.get('reservar') || qs.get('registro')) vista('f-reg'); return; }
    yo = await M.perfil();
    if (!yo) { M.toast('No encontramos tu perfil. Escribe a María.', true); return; }
    $('#v-auth').hidden = true; $('#v-app').hidden = false;
    $('#saludo').textContent = 'Hola, ' + (yo.nombre.split(' ')[0] || 'bienvenida');
    $('#ir-panel').hidden = yo.rol !== 'admin';
    $('#tel-maria').textContent = C.whatsappVisible;
    $('#wa-hola').href = M.wa('Hola María, soy ' + yo.nombre + '.');
    const { data: pr } = await sb.from('productos').select('*').eq('activo', true).order('orden');
    productos = pr || [];
    await recargar();
    if (yo.estado === 'baja') M.toast('Tu cuenta está dada de baja. Escribe a María para reactivarla.', true);
    if (qs.get('reservar')) { abrirReserva(+qs.get('reservar')); limpiarURL(); }
    else if (qs.get('comprar')) { abrirActivar(qs.get('comprar')); limpiarURL(); }
    if (location.hash === '#videoteca') tab('videoteca');
  }
  const limpiarURL = () => history.replaceState(null, '', location.pathname + location.hash);

  async function recargar() {
    const [b, r] = await Promise.all([
      sb.from('bonos').select('*').eq('cliente_id', yo.id).order('fecha_compra', { ascending: false }),
      sb.from('reservas').select('id,estado,enfoque,clase_id,clases(titulo,disciplina,tipo,inicio,duracion_min)').eq('cliente_id', yo.id).order('creada', { ascending: false }).limit(80)
    ]);
    bonos = b.data || []; misRes = (r.data || []).filter((x) => x.clases);
    if (!videos.length) await cargarVideos();
    pintarInicio(); pintarBonos();
  }

  // ---------- pestañas ----------
  function tab(v) {
    $$('#tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.v === v));
    ['inicio', 'reservar', 'bonos', 'videoteca', 'perfil'].forEach((x) => ($('#p-' + x).hidden = x !== v));
    if (v === 'reservar') cargarSemana();
    if (v === 'videoteca') pintarVideos();
    if (v === 'perfil') pintarPerfil();
  }
  $$('#tabs button').forEach((b) => (b.onclick = () => tab(b.dataset.v)));

  // ---------- acceso según lo pagado ----------
  const activo = (b) => b.estado_pago === 'pagado' && b.caduca >= M.hoyISO() && (b.clases_total == null || b.clases_usadas < b.clases_total);
  const acceso = {
    grupo: () => bonos.some((b) => activo(b) && ['grupo', 'completo'].includes(b.tipo)),
    personal: () => bonos.some((b) => activo(b) && b.tipo === 'personal'),
    videos: () => bonos.some((b) => activo(b) && ['videoteca', 'completo'].includes(b.tipo)),
    alguno: () => bonos.some((b) => activo(b) && b.tipo !== 'prueba')
  };
  const prodPorDefecto = { grupo: 'g4', personal: 'p4', videos: 'comp' };
  let videos = [];
  async function cargarVideos() {
    const { data } = await sb.from('videos').select('id,titulo,disciplina,nivel,duracion_min,gratis,descripcion').order('creado', { ascending: false });
    videos = data || [];
  }
  async function verVideo(id) {
    const { data: url, error } = await sb.rpc('ver_video', { p_id: id });
    if (error || !url) return M.toast('Este vídeo es para alumnas con la cuenta activada', true);
    window.open(url, '_blank', 'noopener');
  }

  // ---------- inicio ----------
  function pintarInicio() {
    const activada = acceso.alguno();
    // Clase de prueba grabada (siempre visible con cuenta)
    const pruebas = videos.filter((v) => v.gratis);
    $('#prueba').innerHTML = activada ? '' : '<div class="card" style="background:var(--sun)"><span class="pill s" style="justify-self:start">Gratis con tu cuenta</span><h3>Tu clase de prueba</h3>' +
      (pruebas.length ? pruebas.map((v) => '<div class="row"><div class="l"><b>' + esc(v.titulo) + '</b><span>' + esc(v.disciplina) + ' · ' + v.duracion_min + ' min · ' + esc(v.nivel) + '</span></div><button class="btn btn-p btn-s" data-ver="' + v.id + '">Ver clase</button></div>').join('') : '<p class="small muted">María está grabando la clase de prueba. Muy pronto la tendrás aquí.</p>') + '</div>';

    const prox = misRes.filter((r) => r.estado === 'confirmada' && new Date(r.clases.inicio) > new Date(Date.now() - 3600e3)).sort((a, b) => new Date(a.clases.inicio) - new Date(b.clases.inicio));
    $('#mis-clases').innerHTML = prox.length ? prox.map((r) => {
      const c = r.clases, horas = (new Date(c.inicio) - new Date()) / 3600e3;
      return '<div class="row"><div class="l"><b>' + esc(c.titulo) + '</b><span>' + M.fecha(c.inicio) + ' · ' + M.hora(c.inicio) + ' · ' + c.duracion_min + ' min' + (r.enfoque ? ' · ' + esc(r.enfoque) : '') + '</span></div><div class="acts">' +
        '<button class="btn btn-g btn-xs" data-cancel="' + r.id + '" data-tarde="' + (horas < C.horasCancelacion) + '">Cancelar</button></div></div>';
    }).join('') : '<p class="empty">' + (activada ? 'No tienes clases reservadas. <a href="#" data-ir="reservar">Reserva una</a>.' : 'Cuando actives tu cuenta podrás reservar tus clases en directo aquí.') + '</p>';
    const pas = misRes.filter((r) => r.estado !== 'cancelada' && new Date(r.clases.inicio) < new Date()).slice(0, 6);
    $('#historial').innerHTML = pas.length ? pas.map((r) => '<div class="row"><div class="l"><b>' + esc(r.clases.titulo) + '</b><span>' + M.fechaCorta(r.clases.inicio) + '</span></div><span class="pill ' + (r.estado === 'falta' ? 'warn">No asististe' : 'ok">Hecha') + '</span></div>').join('') : '<p class="empty">Aquí verás las clases que vayas haciendo.</p>';

    const act = bonos.filter(activo).filter((b) => b.tipo !== 'prueba'), pend = bonos.filter((b) => b.estado_pago === 'pendiente');
    $('#mis-bonos-res').innerHTML = (act.length ? act.map(tarjetaBono).join('') :
      '<div class="bono"><span class="eyebrow" style="color:inherit;opacity:.7">Tu cuenta</span><b class="big" style="font-size:28px">Pendiente de activar</b><span style="font-size:14px;opacity:.85">Elige tu plan, haz el pago y pídele a María la activación por WhatsApp. En cuanto la confirme se desbloquean tus clases y vídeos.</span><button class="btn btn-p btn-s" id="activar-ya" style="justify-self:start">Activar mi cuenta</button></div>') +
      (pend.length ? '<div class="card" style="margin-top:16px"><h3>Activación solicitada</h3>' + pend.map((b) => '<div class="row"><div class="l"><b>' + esc(b.nombre) + '</b><span>' + M.eur(b.precio) + ' · ' + (b.metodo_pago === 'efectivo' ? 'en mano' : esc(b.metodo_pago)) + '</span></div><a class="btn btn-wa btn-xs" target="_blank" rel="noopener" href="' + esc(waActivar(productos.find((p) => p.id === b.producto_id) || { nombre: b.nombre, precio: b.precio }, b.metodo_pago)) + '">Recordar a María</a></div>').join('') + '<p class="tiny muted">María la activa en cuanto confirma tu pago.</p></div>' : '');
    const ay = $('#activar-ya'); if (ay) ay.onclick = () => abrirActivar(null);
    $$('[data-ir]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); tab(a.dataset.ir); }));
    $$('[data-cancel]').forEach((b) => (b.onclick = () => cancelar(+b.dataset.cancel, b.dataset.tarde === 'true')));
    $$('#prueba [data-ver]').forEach((b) => (b.onclick = () => verVideo(+b.dataset.ver)));
  }
  function tarjetaBono(b) {
    const ilim = b.clases_total == null, quedan = ilim ? null : b.clases_total - b.clases_usadas;
    return '<div class="bono" style="margin-bottom:12px"><span class="eyebrow" style="color:inherit;opacity:.7">' + esc(b.nombre) + '</span>' +
      (ilim ? '<b class="big">' + (b.tipo === 'videoteca' ? 'Videoteca' : 'Ilimitado') + '</b>' : '<b class="big num">' + quedan + ' <small style="font-size:16px;font-weight:500">de ' + b.clases_total + ' restantes</small></b><div class="meter"><i style="width:' + (quedan / b.clases_total * 100) + '%"></i></div>') +
      '<span style="font-size:13px;opacity:.8">Válido hasta el ' + M.fechaCorta(b.caduca) + ' (' + Math.max(0, M.diasHasta(b.caduca)) + ' días)</span></div>';
  }
  function cancelar(id, tarde) {
    M.modal('<h3>¿Cancelar esta clase?</h3><p class="muted">' + (tarde ? 'Faltan menos de ' + C.horasCancelacion + ' horas: la clase se descontará de tu bono.' : 'La clase volverá a tu bono.') + '</p><div class="foot"><button class="btn btn-g btn-s" data-cerrar>Volver</button><button class="btn btn-p btn-s" id="ok-c">Sí, cancelar</button></div>', (w, cerrar) => {
      $('#ok-c', w).onclick = async () => {
        const { data, error } = await sb.rpc('cancelar_reserva', { p_reserva: id });
        if (error) return M.error(error);
        cerrar(); M.toast(data.devuelta ? 'Clase cancelada. Ha vuelto a tu bono.' : 'Clase cancelada.'); recargar();
      };
    });
  }

  // ---------- reservar ----------
  let semana = M.lunes(), dia = (new Date().getDay() + 6) % 7, modo = 'grupo', clases = [];
  async function cargarSemana() {
    const { data } = await sb.rpc('horario', { desde: semana.toISOString(), hasta: M.masDias(semana, 7).toISOString() });
    clases = data || [];
    const fin = M.masDias(semana, 6);
    $('#w-lbl').textContent = semana.getDate() + ' ' + semana.toLocaleDateString('es-ES', { month: 'short' }) + ' – ' + fin.getDate() + ' ' + fin.toLocaleDateString('es-ES', { month: 'short' });
    $('#w-prev').disabled = semana <= M.lunes();
    pintarSemana();
  }
  function pintarSemana() {
    const puede = acceso[modo]();
    $('#res-aviso').innerHTML = puede ? '' : '<div class="card" style="margin-bottom:14px"><h3>' + (modo === 'grupo' ? 'Activa tu cuenta para reservar clases en grupo' : 'Activa tu cuenta para reservar entrenamiento personal') + '</h3><p class="small muted">Puedes ver el horario, pero para reservar necesitas un bono ' + (modo === 'grupo' ? 'de clases en grupo o Moba Completo' : 'de entrenamiento personal') + ' activado por María.</p><button class="btn btn-p btn-s" id="res-act" style="justify-self:start">Activar mi cuenta</button></div>';
    const ra = $('#res-act'); if (ra) ra.onclick = () => abrirActivar(prodPorDefecto[modo]);
    const mias = new Set(misRes.filter((r) => r.estado === 'confirmada').map((r) => r.clase_id));
    const lista = clases.filter((c) => c.tipo === modo);
    $('#days').innerHTML = M.DN.map((n, i) => { const d = M.masDias(semana, i), k = lista.filter((c) => M.mismoDia(c.inicio, d)).length; return '<button aria-pressed="' + (i === dia) + '" data-i="' + i + '"><small>' + n + '</small><b class="num">' + d.getDate() + '</b><i>' + (k ? k : '') + '</i></button>'; }).join('');
    $$('#days button').forEach((b) => (b.onclick = () => { dia = +b.dataset.i; pintarSemana(); }));
    const hoy = lista.filter((c) => M.mismoDia(c.inicio, M.masDias(semana, dia)) && new Date(c.inicio) > new Date());
    $('#slots').innerHTML = hoy.length ? hoy.map((c) => {
      const libres = c.plazas - c.ocupadas, mia = mias.has(c.id);
      return '<div class="slot"><time>' + M.hora(c.inicio) + '</time><div class="info"><b>' + esc(c.titulo) + '</b><span>' + esc(c.disciplina) + ' · ' + c.duracion_min + ' min · ' + esc(c.nivel) + '</span>' +
        (modo === 'grupo' ? '<div class="cap"><span class="bar"><i style="width:' + (c.ocupadas / c.plazas * 100) + '%"></i></span><span class="num">' + (libres > 0 ? libres + ' de ' + c.plazas + ' libres' : 'Completa') + '</span></div>' : '') + '</div>' +
        (mia ? '<span class="pill ok">Reservada</span>' : libres <= 0 ? '<button class="btn btn-g btn-s" disabled>Completa</button>' : puede ? '<button class="btn btn-p btn-s" data-res="' + c.id + '">Reservar</button>' : '<button class="btn btn-g btn-s" disabled title="Disponible al activar tu cuenta">Al activar tu cuenta</button>') + '</div>';
    }).join('') : '<p class="empty">No hay ' + (modo === 'grupo' ? 'clases' : 'huecos libres') + ' este día. Prueba otro día o <a href="' + M.wa('Hola María, busco un hueco para ' + (modo === 'grupo' ? 'una clase' : 'entrenamiento personal') + ' esta semana.') + '" target="_blank" rel="noopener">escribe a María</a>.</p>';
    $$('[data-res]').forEach((b) => (b.onclick = () => abrirReserva(+b.dataset.res)));
  }
  const setModo = (m) => { modo = m; $('#t-grupo').setAttribute('aria-selected', m === 'grupo'); $('#t-personal').setAttribute('aria-selected', m === 'personal'); pintarSemana(); };
  $('#t-grupo').onclick = () => setModo('grupo');
  $('#t-personal').onclick = () => setModo('personal');
  $('#w-prev').onclick = () => { semana = M.masDias(semana, -7); cargarSemana(); };
  $('#w-next').onclick = () => { semana = M.masDias(semana, 7); dia = 0; cargarSemana(); };

  async function abrirReserva(id) {
    const { data: c } = await sb.from('clases').select('*').eq('id', id).maybeSingle();
    if (!c || c.estado !== 'programada' || new Date(c.inicio) < new Date()) return M.toast('Esta clase ya no está disponible', true);
    const personal = c.tipo === 'personal';
    if (!acceso[personal ? 'personal' : 'grupo']()) { tab('reservar'); return abrirActivar(personal ? 'p4' : 'g4'); }
    M.modal('<h3>' + esc(c.titulo) + '</h3><p class="muted">' + M.fecha(c.inicio) + ' · ' + M.hora(c.inicio) + ' · ' + c.duracion_min + ' min</p>' +
      (personal ? '<label class="field">¿Qué quieres trabajar?<select id="m-enf"><option>Fuerza y tonificación</option><option>Recuperación o prevención de lesiones</option><option>Pilates</option><option>Yoga</option><option>Funcional</option><option>Otro objetivo</option></select></label>' : '') +
      '<p class="small">María te llamará por <b>videollamada de WhatsApp</b> al <b>' + esc(yo.telefono) + '</b>.</p><p class="okmsg">Se descontará de tu bono.</p>' +
      '<div class="foot"><button class="btn btn-g btn-s" data-cerrar>Cancelar</button><button class="btn btn-p btn-s" id="m-ok">Confirmar reserva</button></div>', (w, cerrar) => {
      const okb = $('#m-ok', w);
      okb.onclick = async () => {
        okb.disabled = true;
        const { error } = await sb.rpc('reservar', { p_clase: c.id, p_enfoque: personal ? $('#m-enf', w).value : null });
        okb.disabled = false;
        if (error) return M.error(error);
        cerrar();
        M.modal('<h3>¡Reserva confirmada!</h3><p>' + esc(c.titulo) + ' · ' + M.fecha(c.inicio) + ' a las ' + M.hora(c.inicio) + '.</p><p class="small muted">A esa hora, María te hará una <b>videollamada de WhatsApp</b> al ' + esc(yo.telefono) + '. Guarda su número (' + esc(C.whatsappVisible) + ') para reconocer la llamada y ten la esterilla preparada.</p><div class="foot"><a class="btn btn-wa btn-s" target="_blank" rel="noopener" href="' + M.wa('Hola María, soy ' + yo.nombre + '. He reservado «' + c.titulo + '» el ' + M.fecha(c.inicio) + ' a las ' + M.hora(c.inicio) + '.') + '">Avisar a María</a><button class="btn btn-p btn-s" data-cerrar>Hecho</button></div>');
        await recargar(); if (!$('#p-reservar').hidden) cargarSemana();
      };
    });
  }

  // ---------- activar (bonos) ----------
  const metodoTxt = (m) => (m === 'efectivo' ? 'en mano' : m);
  function waActivar(p, met) {
    return M.wa('Hola María, soy ' + yo.nombre + ' (' + yo.telefono + '). Quiero activar mi cuenta de Moba Training con «' + p.nombre + '» (' + M.eur(p.precio) + (p.mensual ? '/mes' : '') + '). Lo pago ' + (met === 'efectivo' ? 'en mano' : 'por ' + met) + '.');
  }
  function pintarBonos() {
    $('#lista-bonos').innerHTML = bonos.filter((b) => b.tipo !== 'prueba').length ? bonos.filter((b) => b.tipo !== 'prueba').map((b) => {
      const est = b.estado_pago === 'pendiente' ? '<span class="pill warn">Pendiente de activar</span>' : b.estado_pago === 'anulado' ? '<span class="pill">Anulado</span>' : activo(b) ? '<span class="pill ok">Activo</span>' : '<span class="pill">Terminado</span>';
      const uso = b.clases_total == null ? 'Ilimitado' : (b.clases_total - b.clases_usadas) + ' de ' + b.clases_total + ' clases';
      return '<div class="row"><div class="l"><b>' + esc(b.nombre) + '</b><span>' + uso + ' · ' + (b.estado_pago === 'pagado' ? 'hasta ' + M.fechaCorta(b.caduca) : M.eur(b.precio) + ' · ' + esc(metodoTxt(b.metodo_pago))) + '</span></div>' + est + '</div>';
    }).join('') : '<p class="empty">Todavía no tienes ningún plan activado.</p>';
    const grupos = [['Clases en grupo en directo', 'grupo'], ['Entrenamiento personal', 'personal'], ['Videoteca y Moba Completo', 'x']];
    $('#tienda').innerHTML = grupos.map(([t, k]) => '<p class="eyebrow" style="margin-top:6px">' + t + '</p>' + productos.filter((p) => k === 'x' ? ['videoteca', 'completo'].includes(p.tipo) : p.tipo === k).map((p) =>
      '<div class="row"><div class="l"><b>' + esc(p.nombre) + '</b><span>' + esc(p.descripcion || '') + '</span></div><button class="btn btn-g btn-xs" data-comprar="' + p.id + '">' + M.eur(p.precio) + (p.mensual ? '/mes' : '') + '</button></div>').join('')).join('');
    $$('[data-comprar]').forEach((b) => (b.onclick = () => abrirActivar(b.dataset.comprar)));
  }
  function abrirActivar(id) {
    if (!productos.length) return;
    const sel = productos.find((x) => x.id === id) || productos.find((x) => x.id === 'g4') || productos[0];
    M.modal('<h3>Activar mi cuenta</h3><p class="small muted">Elige tu plan, haz el pago y pulsa el botón: se abrirá WhatsApp con el mensaje para María. En cuanto confirme el pago, tu cuenta se activa.</p>' +
      '<label class="field">Plan<select id="m-prod">' + productos.map((p) => '<option value="' + p.id + '"' + (p.id === sel.id ? ' selected' : '') + '>' + esc(p.nombre) + ' · ' + M.eur(p.precio) + (p.mensual ? '/mes' : '') + '</option>').join('') + '</select></label>' +
      '<label class="field">¿Cómo vas a pagar?<select id="m-met"><option value="bizum">Bizum</option>' + (C.iban ? '<option value="transferencia">Transferencia</option>' : '') + '<option value="efectivo">En mano</option></select></label>' +
      '<div id="m-inst" class="small muted"></div>' +
      '<div class="foot"><button class="btn btn-g btn-s" data-cerrar>Cancelar</button><a class="btn btn-wa btn-s" id="m-ok" target="_blank" rel="noopener" href="#">Pedir activación por WhatsApp</a></div>', (w, cerrar) => {
      const actual = () => productos.find((x) => x.id === $('#m-prod', w).value);
      const pintar = () => {
        const p = actual(), m = $('#m-met', w).value;
        $('#m-inst', w).innerHTML = (m === 'bizum' ? 'Haz un Bizum de <b>' + M.eur(p.precio) + '</b> al <b>' + esc(C.whatsappVisible) + '</b> con el concepto «Moba ' + esc(yo.nombre.split(' ')[0]) + '».' : m === 'transferencia' ? 'Transfiere <b>' + M.eur(p.precio) + '</b> a la cuenta <b>' + esc(C.iban) + '</b> con el concepto «Moba ' + esc(yo.nombre) + '».' : 'Paga a María en mano.') + ' La validez empieza el día que María active tu cuenta.';
        $('#m-ok', w).href = waActivar(p, m);
      };
      $('#m-prod', w).onchange = pintar; $('#m-met', w).onchange = pintar; pintar();
      $('#m-ok', w).addEventListener('click', () => {
        sb.rpc('solicitar_bono', { p_producto: actual().id, p_metodo: $('#m-met', w).value }).then(({ error }) => { if (error) M.error(error); else recargar(); });
        setTimeout(() => { cerrar(); M.toast('Solicitud enviada. María activará tu cuenta al confirmar el pago.'); }, 300);
      });
    });
  }

  // ---------- videoteca ----------
  async function pintarVideos() {
    await cargarVideos();
    const ok = acceso.videos();
    $('#vid-acceso').innerHTML = ok ? '<p class="okmsg">Tienes acceso a toda la videoteca.</p>' : '<div class="card"><h3>Desbloquea la videoteca</h3><p class="small muted">Con tu cuenta puedes ver la clase de prueba. Para ver todos los vídeos, activa la videoteca o Moba Completo.</p><div class="acts"><button class="btn btn-p btn-s" data-act="comp">Moba Completo</button><button class="btn btn-g btn-s" data-act="vid">Solo videoteca</button></div></div>';
    $$('[data-act]').forEach((b) => (b.onclick = () => abrirActivar(b.dataset.act)));
    $('#vid-lista').innerHTML = videos.length ? videos.map((v) => {
      const abierto = ok || v.gratis;
      return '<article class="vid"><div class="thumb" data-d="' + esc(v.disciplina) + '"><span class="dur num">' + v.duracion_min + ' min</span><span class="lock pill ' + (v.gratis ? 'g">Clase de prueba' : abierto ? 'ok">Incluido' : 'a">🔒 Con tu plan') + '</span></div><div class="body"><b>' + esc(v.titulo) + '</b><span>' + esc(v.disciplina) + ' · ' + esc(v.nivel) + '</span>' +
        (abierto ? '<button class="btn btn-p btn-xs" style="justify-self:start;margin-top:6px" data-ver="' + v.id + '">Ver vídeo</button>' : '<button class="btn btn-g btn-xs" style="justify-self:start;margin-top:6px" data-act="comp">Desbloquear</button>') + '</div></article>';
    }).join('') : '<div class="soon"><span class="pill s">Muy pronto</span><h3>María está grabando los primeros vídeos</h3><p class="muted">Te avisaremos en cuanto estén disponibles.</p></div>';
    $$('#vid-lista [data-ver]').forEach((b) => (b.onclick = () => verVideo(+b.dataset.ver)));
    $$('#vid-lista [data-act]').forEach((b) => (b.onclick = () => abrirActivar(b.dataset.act)));
  }

  // ---------- perfil ----------
  function pintarPerfil() {
    $('#pf-nombre').value = yo.nombre; $('#pf-mail').value = yo.email; $('#pf-tel').value = yo.telefono; $('#pf-obj').value = yo.objetivo || ''; $('#pf-emails').checked = yo.acepta_emails;
  }
  $('#f-perfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = { p_nombre: $('#pf-nombre').value.trim(), p_email: $('#pf-mail').value.trim(), p_objetivo: $('#pf-obj').value.trim(), p_acepta: $('#pf-emails').checked };
    if (!d.p_nombre) return M.toast('Escribe tu nombre', true);
    if (d.p_email && !/^\S+@\S+\.\S+$/.test(d.p_email)) return M.toast('El email no es válido (puedes dejarlo vacío)', true);
    const { error } = await sb.rpc('actualizar_perfil', d);
    if (error) return M.error(error);
    Object.assign(yo, { nombre: d.p_nombre, email: d.p_email, objetivo: d.p_objetivo, acepta_emails: d.p_acepta });
    $('#saludo').textContent = 'Hola, ' + yo.nombre.split(' ')[0];
    M.toast('Datos guardados');
  });
  $('#f-clave').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = $('#pf-pass').value;
    if (p.length < 6) return M.toast('La contraseña debe tener al menos 6 caracteres', true);
    const { error } = await sb.auth.updateUser({ password: p });
    if (error) return M.error(error);
    $('#pf-pass').value = ''; M.toast('Contraseña cambiada');
  });
  $('#salir').onclick = M.salir;
  $('#baja').onclick = () => M.modal('<h3>Solicitar la baja</h3><label class="field">¿Nos cuentas el motivo? (opcional)<textarea id="m-mot"></textarea></label><div class="foot"><button class="btn btn-g btn-s" data-cerrar>Volver</button><button class="btn btn-p btn-s" id="m-ok">Darme de baja</button></div>', (w, cerrar) => {
    $('#m-ok', w).onclick = async () => {
      const { error } = await sb.rpc('darme_de_baja', { p_motivo: $('#m-mot', w).value.trim() || 'Sin motivo' });
      if (error) return M.error(error);
      cerrar(); yo.estado = 'baja'; M.toast('Baja registrada. ¡Gracias por entrenar con nosotras!');
    };
  });

  arrancar();
})();
