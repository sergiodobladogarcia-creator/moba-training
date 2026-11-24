/* Panel de María: agenda, alumnas, facturación, bajas, avisos, vídeos y tarifas */
(async function () {
  const C = window.MOBA, sb = M.sb, esc = M.esc, $ = M.$, $$ = M.$$;
  const BASE = location.href.replace(/[^/]*([?#].*)?$/, '');
  $('#salir').onclick = (e) => { e.preventDefault(); M.salir(); };

  const yo = await M.perfil();
  if (!yo || yo.rol !== 'admin') { $('#sin-acceso').hidden = false; return; }
  $('#panel').hidden = false;
  $('#hoy').textContent = M.fecha(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ================= DATOS =================
  let P = [], B = [], R = [], A = [], PROD = [], V = [], S = [];
  const cli = {}; // id -> perfil
  async function cargar() {
    const [p, b, r, a, pr, v, s] = await Promise.all([
      sb.from('perfiles').select('*').order('nombre'),
      sb.from('bonos').select('*').order('fecha_compra', { ascending: false }),
      sb.from('reservas').select('*, clases(id,titulo,tipo,inicio,duracion_min,disciplina)').order('creada', { ascending: false }),
      sb.from('avisos').select('*').order('creado', { ascending: false }),
      sb.from('productos').select('*').order('orden'),
      sb.from('videos').select('id,titulo,disciplina,nivel,duracion_min,descripcion,gratis,publicado,creado').order('creado', { ascending: false }),
      sb.from('suscriptores').select('*').order('creado', { ascending: false })
    ]);
    const err = [p, b, r, a, pr, v, s].find((x) => x.error); if (err) M.error(err.error);
    P = p.data || []; B = b.data || []; R = (r.data || []).filter((x) => x.clases); A = a.data || []; PROD = pr.data || []; V = v.data || []; S = s.data || [];
    Object.keys(cli).forEach((k) => delete cli[k]); P.forEach((x) => (cli[x.id] = x));
  }
  const alumnas = () => P.filter((x) => x.rol === 'cliente');
  const hoy = M.hoyISO();
  const activo = (b) => b.estado_pago === 'pagado' && b.caduca >= hoy && (b.clases_total == null || b.clases_usadas < b.clases_total);
  const bonosDe = (id) => B.filter((b) => b.cliente_id === id);
  const activosDe = (id) => bonosDe(id).filter(activo);
  const resDe = (id) => R.filter((r) => r.cliente_id === id && r.estado !== 'cancelada');
  const ultimaClase = (id) => resDe(id).map((r) => r.clases.inicio).filter((d) => new Date(d) < new Date()).sort().pop();
  const ultimoAviso = (id) => A.find((a) => a.cliente_id === id);
  const nombre = (id) => (cli[id] ? cli[id].nombre || cli[id].email : 'Alumna eliminada');
  const quedan = (b) => (b.clases_total == null ? null : b.clases_total - b.clases_usadas);
  const prodDe = (b) => PROD.find((p) => p.id === b.producto_id);

  // ---------- listas de retención ----------
  function caducanPronto() {
    return B.filter((b) => activo(b) && b.tipo !== 'prueba' && cli[b.cliente_id] && cli[b.cliente_id].estado === 'activa' && (M.diasHasta(b.caduca) <= 10 || (quedan(b) != null && quedan(b) <= 1)))
      .filter((b) => !activosDe(b.cliente_id).some((o) => o.id !== b.id && o.tipo === b.tipo && o.caduca > b.caduca))
      .sort((a, b) => a.caduca.localeCompare(b.caduca));
  }
  // Registradas que nunca han pagado ni pedido un plan
  const pagadoAlgunaVez = (id) => bonosDe(id).some((b) => b.estado_pago === 'pagado' && b.tipo !== 'prueba');
  const sinActivar = () => alumnas().filter((c) => c.estado === 'activa' && !pagadoAlgunaVez(c.id) && !bonosDe(c.id).some((b) => b.estado_pago === 'pendiente'));
  function filaSinActivar(c) {
    const d = Math.floor((new Date() - new Date(c.fecha_alta)) / 86400000);
    const txt = '¡Hola ' + ((c.nombre || '').split(' ')[0] || '') + '! 😊 Soy María, de Moba Training. He visto que has creado tu cuenta: ¿qué te ha parecido la clase de prueba? Si quieres, te ayudo a elegir el plan que mejor te encaje y te activo la cuenta hoy mismo.';
    return '<div class="row"><div class="l"><b>' + esc(c.nombre || c.telefono) + '</b><span>' + esc(c.telefono) + ' · registrada ' + (d === 0 ? 'hoy' : 'hace ' + d + ' d') + '</span>' + avisadoTxt(c.id) + '</div><div class="acts">' +
      (c.telefono ? '<a class="btn btn-wa btn-xs" target="_blank" rel="noopener" data-avisar="activar" data-cli="' + c.id + '" href="' + esc(M.wa(txt, M.telWa(c.telefono))) + '">WhatsApp</a>' : '') +
      '<button class="btn btn-p btn-xs" data-activar="' + c.id + '">Activar</button></div></div>';
  }
  function enRiesgo() {
    const cad = new Set(caducanPronto().map((b) => b.cliente_id));
    const hace21 = M.masDias(new Date(), -21);
    return alumnas().filter((c) => c.estado === 'activa' && !cad.has(c.id) && pagadoAlgunaVez(c.id)).map((c) => {
      const ult = ultimaClase(c.id), act = activosDe(c.id), todos = bonosDe(c.id).filter((b) => b.estado_pago === 'pagado');
      let motivo = null;
      if (todos.length && !act.length) motivo = 'Bono terminado sin renovar';
      else if (ult && new Date(ult) < hace21) motivo = 'Sin clases desde el ' + M.fechaCorta(ult);
      return motivo ? { c, motivo } : null;
    }).filter(Boolean);
  }

  // ---------- mensajes de WhatsApp ----------
  const firma = '\n\nUn abrazo,\nMaría · Moba Training\n' + BASE;
  const pila = (c) => (c.nombre || '').split(' ')[0] || '';
  function waRenovar(b) {
    const c = cli[b.cliente_id], n = pila(c), q = quedan(b), comp = PROD.find((p) => p.id === 'comp');
    const txt = '¡Hola ' + n + '! 💪\n\n' +
      'Te escribo porque ' + (q != null ? 'te ' + (q === 1 ? 'queda 1 clase' : 'quedan ' + q + ' clases') + ' de tu ' + b.nombre.toLowerCase() + ', que' : 'tu ' + b.nombre.toLowerCase()) + ' es válido hasta el ' + M.fecha(b.caduca + 'T12:00:00', { day: 'numeric', month: 'long' }) + '.\n\n' +
      'Estoy muy contenta con lo que estás avanzando. La constancia es lo que de verdad marca la diferencia: cada clase suma fuerza, movilidad y bienestar, y sería una pena cortar ahora ese ritmo que tanto te ha costado coger.\n\n' +
      'Si quieres seguir, puedes renovar en un minuto desde tu cuenta:\n' + BASE + 'cuenta.html?comprar=' + (b.producto_id || 'g4') + '\n\n' +
      (comp && b.tipo !== 'completo' ? 'Y si quieres aún más, con Moba Completo tienes clases en grupo ilimitadas y toda la videoteca por ' + M.eur(comp.precio) + ' al mes.\n\n' : '') +
      '¿Lo renovamos? 😊' + firma;
    return M.wa(txt, M.telWa(c.telefono));
  }
  function waVuelve(c) {
    const txt = '¡Hola ' + pila(c) + '! 🌿\n\nHace unos días que no coincidimos en clase y quería saber qué tal estás.\n\n' +
      'Sé que a veces cuesta encontrar el momento, pero volver es más fácil de lo que parece: una sola clase a la semana ya marca la diferencia en cómo te sientes, en tu postura y en tu energía.\n\n' +
      'Aquí tienes el horario para reservar la que mejor te encaje:\n' + BASE + 'cuenta.html\n\n' +
      'Si necesitas que adapte algo (horario, nivel, alguna molestia), dímelo y lo preparo para ti.' + firma;
    return M.wa(txt, M.telWa(c.telefono));
  }
  async function registrarAviso(cliente_id, bono_id, tipo) {
    const { data } = await sb.from('avisos').insert({ cliente_id, bono_id, tipo }).select().single();
    if (data) A.unshift(data);
  }
  const avisadoTxt = (id) => { const a = ultimoAviso(id); if (!a) return ''; const d = Math.floor((new Date() - new Date(a.creado)) / 86400000); return '<span class="tiny muted">Avisada ' + (d === 0 ? 'hoy' : 'hace ' + d + ' d') + '</span>'; };
  function botonAvisar(el) {
    el.querySelectorAll('[data-avisar]').forEach((a) => a.addEventListener('click', () => {
      registrarAviso(a.dataset.cli, a.dataset.bono ? +a.dataset.bono : null, a.dataset.avisar);
      M.toast('Mensaje preparado en WhatsApp. Revísalo y pulsa Enviar.');
      setTimeout(() => pintarTodo(), 400);
    }));
  }
  const filaCad = (b) => {
    const c = cli[b.cliente_id], q = quedan(b), d = M.diasHasta(b.caduca);
    return '<div class="row"><div class="l"><b>' + esc(c.nombre || c.email) + '</b><span>' + esc(b.nombre) + ' · ' + (q != null ? q + (q === 1 ? ' clase' : ' clases') + ' · ' : '') + (d <= 0 ? 'caduca hoy' : 'caduca en ' + d + ' d') + '</span>' + avisadoTxt(c.id) + '</div>' +
      '<div class="acts">' + (c.telefono ? '<a class="btn btn-wa btn-xs" target="_blank" rel="noopener" data-avisar="renovar" data-cli="' + c.id + '" data-bono="' + b.id + '" href="' + esc(waRenovar(b)) + '">Avisar por WhatsApp</a>' : '<span class="tiny muted">Sin teléfono</span>') + '</div></div>';
  };

  // ================= PESTAÑAS =================
  let vista = 'resumen';
  function tab(v) { vista = v; $$('#tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.v === v)); $$('.view').forEach((s) => (s.hidden = s.id !== 'p-' + v)); pintar(v); }
  $$('#tabs button').forEach((b) => (b.onclick = () => tab(b.dataset.v)));
  function pintar(v) { ({ resumen: pResumen, agenda: pAgenda, clientes: pClientes, facturacion: pFact, retencion: pRet, videos: pVideos, tarifas: pTarifas })[v](); }
  function pintarTodo() {
    const pend = B.filter((b) => b.estado_pago === 'pendiente').length, ret = caducanPronto().length;
    $('#b-pend').hidden = !pend; $('#b-pend').textContent = pend;
    $('#b-ret').hidden = !ret; $('#b-ret').textContent = ret;
    pintar(vista);
  }
  async function refrescar() { await cargar(); pintarTodo(); }

  // ================= RESUMEN =================
  async function pResumen() {
    const mes = hoy.slice(0, 7), mesAnt = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('sv-SE').slice(0, 7);
    const ing = (m) => B.filter((b) => b.estado_pago === 'pagado' && b.fecha_pago && new Date(b.fecha_pago).toLocaleDateString('sv-SE').startsWith(m)).reduce((s, b) => s + +b.precio, 0);
    const iM = ing(mes), iA = ing(mesAnt);
    const ini = M.lunes(), fin = M.masDias(ini, 7);
    const { data: sem } = await sb.rpc('horario', { desde: ini.toISOString(), hasta: fin.toISOString() });
    const grupoSem = (sem || []).filter((c) => c.tipo === 'grupo'), pl = grupoSem.reduce((s, c) => s + c.plazas, 0), oc = grupoSem.reduce((s, c) => s + c.ocupadas, 0);
    const act = alumnas().filter((c) => c.estado === 'activa' && activosDe(c.id).length).length;
    const resHoy = R.filter((r) => r.estado !== 'cancelada' && M.mismoDia(r.clases.inicio, new Date()));
    $('#kpis').innerHTML =
      '<div class="kpi"><span>Ingresos de ' + new Date().toLocaleDateString('es-ES', { month: 'long' }) + '</span><b class="num">' + M.eur(iM) + '</b><span>' + (iA ? (iM >= iA ? '+' : '') + Math.round((iM - iA) / iA * 100) + ' % que el mes pasado' : 'Mes pasado: ' + M.eur(iA)) + '</span></div>' +
      '<div class="kpi"><span>Reservas hoy</span><b class="num">' + resHoy.length + '</b><span>' + new Set(resHoy.map((r) => r.clase_id)).size + ' clases</span></div>' +
      '<div class="kpi"><span>Ocupación de la semana</span><b class="num">' + (pl ? Math.round(oc / pl * 100) : 0) + ' %</b><div class="meter"><i style="width:' + (pl ? oc / pl * 100 : 0) + '%"></i></div><span>' + oc + ' de ' + pl + ' plazas en grupo</span></div>' +
      '<div class="kpi"><span>Alumnas con bono activo</span><b class="num">' + act + '</b><span>' + alumnas().filter((c) => c.estado === 'activa').length + ' registradas activas</span></div>';
    const { data: hc } = await sb.rpc('horario', { desde: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(), hasta: new Date(new Date().setHours(24, 0, 0, 0)).toISOString() });
    $('#hoy-clases').innerHTML = (hc || []).length ? hc.map((c) => '<div class="row"><div class="l"><b>' + M.hora(c.inicio) + ' · ' + esc(c.titulo) + '</b><span>' + c.ocupadas + ' de ' + c.plazas + ' plazas · ' + esc(nombresClase(c.id).join(', ') || 'sin reservas') + '</span></div><button class="btn btn-g btn-xs" data-ver="' + c.id + '">Ver</button></div>').join('') : '<p class="empty">Hoy no tienes clases.</p>';
    $$('#hoy-clases [data-ver]').forEach((b) => (b.onclick = () => verClase(+b.dataset.ver)));
    const meses = [...Array(6)].map((_, i) => { const d = new Date(new Date().getFullYear(), new Date().getMonth() - 5 + i, 1); return [d.toLocaleDateString('sv-SE').slice(0, 7), d.toLocaleDateString('es-ES', { month: 'short' })]; });
    const vals = meses.map(([m]) => ing(m)), max = Math.max(...vals, 1);
    $('#bars').innerHTML = meses.map(([, l], i) => '<div><span class="num">' + (vals[i] ? Math.round(vals[i]) + ' €' : '') + '</span><i style="height:' + (vals[i] / max * 110) + 'px"></i><span>' + l + '</span></div>').join('');
    pintarPendientes($('#res-pend'));
    const sa = sinActivar();
    $('#res-sin').innerHTML = sa.length ? sa.slice(0, 8).map(filaSinActivar).join('') : '<p class="empty">Todas las cuentas registradas tienen un plan o lo han pedido.</p>';
    botonAvisar($('#res-sin'));
    $$('#res-sin [data-activar]').forEach((b) => (b.onclick = () => venta(b.dataset.activar)));
    const cad = caducanPronto();
    $('#res-cad').innerHTML = cad.length ? cad.slice(0, 6).map(filaCad).join('') : '<p class="empty">Ningún bono caduca en los próximos 10 días.</p>';
    botonAvisar($('#res-cad'));
  }
  const nombresClase = (id) => R.filter((r) => r.clase_id === id && r.estado !== 'cancelada').map((r) => nombre(r.cliente_id).split(' ')[0]);
  function pintarPendientes(el) {
    const pend = B.filter((b) => b.estado_pago === 'pendiente');
    el.innerHTML = pend.length ? pend.map((b) => '<div class="row"><div class="l"><b>' + esc(nombre(b.cliente_id)) + '</b><span>' + esc(b.nombre) + ' · ' + M.eur(b.precio) + ' · ' + esc(b.metodo_pago) + ' · pedido el ' + M.fechaCorta(b.fecha_compra) + '</span></div><div class="acts"><button class="btn btn-p btn-xs" data-pagado="' + b.id + '">Confirmar pago</button><button class="btn btn-l btn-xs" data-anular="' + b.id + '">Anular</button></div></div>').join('') : '<p class="empty">No hay pagos pendientes.</p>';
    el.querySelectorAll('[data-pagado]').forEach((x) => (x.onclick = async () => { const { error } = await sb.rpc('confirmar_pago', { p_bono: +x.dataset.pagado }); if (error) return M.error(error); M.toast('Pago confirmado. Bono activado.'); refrescar(); }));
    el.querySelectorAll('[data-anular]').forEach((x) => (x.onclick = async () => { const { error } = await sb.from('bonos').update({ estado_pago: 'anulado' }).eq('id', +x.dataset.anular); if (error) return M.error(error); M.toast('Solicitud anulada'); refrescar(); }));
  }

  // ================= AGENDA =================
  let semana = M.lunes(), dia = (new Date().getDay() + 6) % 7, agenda = [];
  async function pAgenda() {
    const { data, error } = await sb.from('clases').select('*').gte('inicio', semana.toISOString()).lt('inicio', M.masDias(semana, 7).toISOString()).order('inicio');
    if (error) return M.error(error);
    agenda = data || [];
    const fin = M.masDias(semana, 6);
    $('#w-lbl').textContent = semana.getDate() + ' ' + semana.toLocaleDateString('es-ES', { month: 'short' }) + ' – ' + fin.getDate() + ' ' + fin.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    $('#days').innerHTML = M.DN.map((n, i) => { const d = M.masDias(semana, i), k = agenda.filter((c) => c.estado === 'programada' && M.mismoDia(c.inicio, d)).length; return '<button aria-pressed="' + (i === dia) + '" data-i="' + i + '"><small>' + n + '</small><b class="num">' + d.getDate() + '</b><i>' + (k || '') + '</i></button>'; }).join('');
    $$('#days button').forEach((b) => (b.onclick = () => { dia = +b.dataset.i; pAgenda(); }));
    const lista = agenda.filter((c) => M.mismoDia(c.inicio, M.masDias(semana, dia)));
    $('#agenda').innerHTML = lista.length ? lista.map((c) => {
      const res = R.filter((r) => r.clase_id === c.id && r.estado !== 'cancelada'), canc = c.estado === 'cancelada';
      return '<div class="slot" style="' + (canc ? 'opacity:.55' : '') + '"><time>' + M.hora(c.inicio) + '</time><div class="info"><b>' + esc(c.titulo) + ' ' + (c.tipo === 'personal' ? '<span class="pill ok">Personal</span>' : '<span class="pill ' + (M.colorDisc[c.disciplina] || 'a') + '">' + esc(c.disciplina) + '</span>') + (canc ? ' <span class="pill warn">Cancelada</span>' : '') + '</b><span>' + c.duracion_min + ' min · ' + res.length + ' de ' + c.plazas + ' plazas' + (res.length ? ' · ' + esc(res.map((r) => nombre(r.cliente_id).split(' ')[0] + (r.enfoque ? ' (' + r.enfoque + ')' : '')).join(', ')) : '') + '</span></div>' +
        '<div class="acts"><button class="btn btn-p btn-xs" data-ver="' + c.id + '">Ver</button>' + (canc ? '' : '<button class="btn btn-g btn-xs" data-edit="' + c.id + '">Editar</button>') + '</div></div>';
    }).join('') : '<p class="empty">No hay clases este día. Pulsa «Crear clase» o «Abrir huecos personales».</p>';
    $$('#agenda [data-ver]').forEach((b) => (b.onclick = () => verClase(+b.dataset.ver)));
    $$('#agenda [data-edit]').forEach((b) => (b.onclick = () => formClase(agenda.find((c) => c.id === +b.dataset.edit))));
  }
  $('#w-prev').onclick = () => { semana = M.masDias(semana, -7); pAgenda(); };
  $('#w-next').onclick = () => { semana = M.masDias(semana, 7); pAgenda(); };
  $('#w-hoy').onclick = () => { semana = M.lunes(); dia = (new Date().getDay() + 6) % 7; pAgenda(); };

  const isoLocal = (d) => { const x = new Date(d); return x.toLocaleDateString('sv-SE') + 'T' + x.toTimeString().slice(0, 5); };
  function formClase(c) {
    const nueva = !c;
    const d = c ? new Date(c.inicio) : (() => { const x = M.masDias(semana, dia); x.setHours(19, 0, 0, 0); return x; })();
    M.modal('<h3>' + (nueva ? 'Crear clase en grupo' : 'Editar clase') + '</h3><form class="form" id="fc">' +
      '<label class="field">Título<input id="c-tit" value="' + esc(c ? c.titulo : '') + '" placeholder="Pilates Mat · Core" required></label>' +
      '<div class="g2" style="grid-template-columns:1fr 1fr"><label class="field">Disciplina<select id="c-dis">' + ['Pilates', 'Yoga', 'Funcional', 'Personal'].map((x) => '<option' + (c && c.disciplina === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label>' +
      '<label class="field">Nivel<select id="c-niv">' + ['Todos', 'Inicial', 'Medio', 'Avanzado'].map((x) => '<option' + (c && c.nivel === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label></div>' +
      '<div class="g2" style="grid-template-columns:1fr 1fr"><label class="field">Día y hora<input type="datetime-local" id="c-ini" value="' + isoLocal(d) + '"></label>' +
      '<label class="field">Duración (min)<input type="number" id="c-dur" min="15" max="120" value="' + (c ? c.duracion_min : 50) + '"></label></div>' +
      '<div class="g2" style="grid-template-columns:1fr 1fr"><label class="field">Plazas (máx. 6)<input type="number" id="c-pla" min="1" max="6" value="' + (c ? c.plazas : C.plazasGrupo) + '"></label>' +
      (nueva ? '<label class="field">Repetir cada semana<select id="c-rep"><option value="1">Solo esta vez</option><option value="4">4 semanas</option><option value="8">8 semanas</option><option value="12">12 semanas</option></select></label>' : '<span></span>') + '</div>' +
      '<label class="field">Descripción (opcional)<textarea id="c-desc">' + esc(c && c.descripcion || '') + '</textarea></label>' +
      '<div class="foot">' + (nueva ? '' : '<button type="button" class="btn btn-l" id="c-cancel" style="margin-right:auto">Cancelar clase</button>') + '<button type="button" class="btn btn-g btn-s" data-cerrar>Cerrar</button><button class="btn btn-p btn-s">Guardar</button></div></form>', (w, cerrar) => {
      $('#fc', w).addEventListener('submit', async (e) => {
        e.preventDefault();
        const ini = new Date($('#c-ini', w).value), tit = $('#c-tit', w).value.trim();
        if (!tit || isNaN(ini)) return M.toast('Pon título, día y hora', true);
        const fila = { titulo: tit, disciplina: $('#c-dis', w).value, nivel: $('#c-niv', w).value, duracion_min: +$('#c-dur', w).value || 50, plazas: Math.min(6, Math.max(1, +$('#c-pla', w).value || 6)), descripcion: $('#c-desc', w).value.trim() || null };
        let error;
        if (nueva) {
          const rep = +$('#c-rep', w).value;
          const filas = [...Array(rep)].map((_, i) => ({ ...fila, tipo: fila.disciplina === 'Personal' ? 'personal' : 'grupo', inicio: M.masDias(ini, 7 * i).toISOString() }));
          ({ error } = await sb.from('clases').insert(filas));
        } else ({ error } = await sb.from('clases').update({ ...fila, inicio: ini.toISOString() }).eq('id', c.id));
        if (error) return M.error(error);
        cerrar(); M.toast(nueva ? 'Clase creada' : 'Clase guardada');
        semana = M.lunes(ini); dia = (ini.getDay() + 6) % 7; await refrescar(); if (vista !== 'agenda') tab('agenda');
      });
      const cb = $('#c-cancel', w);
      if (cb) cb.onclick = async () => {
        const res = R.filter((r) => r.clase_id === c.id && r.estado === 'confirmada');
        for (const r of res) await sb.rpc('cancelar_reserva', { p_reserva: r.id });
        const { error } = await sb.from('clases').update({ estado: 'cancelada' }).eq('id', c.id);
        if (error) return M.error(error);
        cerrar(); await refrescar();
        if (res.length) M.modal('<h3>Clase cancelada</h3><p class="muted">Las clases se han devuelto a los bonos. Avisa a las alumnas:</p>' + res.map((r) => { const a = cli[r.cliente_id]; return '<div class="row"><div class="l"><b>' + esc(a.nombre) + '</b><span>' + esc(a.telefono) + '</span></div>' + (a.telefono ? '<a class="btn btn-wa btn-xs" target="_blank" rel="noopener" href="' + esc(M.wa('Hola ' + a.nombre.split(' ')[0] + ', siento avisarte de que he tenido que cancelar la clase «' + c.titulo + '» del ' + M.fecha(c.inicio) + ' a las ' + M.hora(c.inicio) + '. Te he devuelto la clase al bono. ¡Perdona las molestias!', M.telWa(a.telefono))) + '">WhatsApp</a>' : '') + '</div>'; }).join('') + '<div class="foot"><button class="btn btn-p btn-s" data-cerrar>Hecho</button></div>');
        else M.toast('Clase cancelada');
      };
    });
  }
  $('#nueva-clase').onclick = () => formClase(null);
  $('#nueva-clase2').onclick = () => formClase(null);

  $('#huecos').onclick = () => {
    const d = M.masDias(semana, dia);
    M.modal('<h3>Abrir huecos de entrenamiento personal</h3><p class="small muted">Cada hueco es una sesión 1 a 1 que las alumnas con bono personal pueden reservar.</p><form class="form" id="fh">' +
      '<label class="field">Día<input type="date" id="h-dia" value="' + d.toLocaleDateString('sv-SE') + '"></label>' +
      '<label class="field">Horas (separadas por comas)<input id="h-horas" value="09:00, 10:00, 17:00, 18:00"></label>' +
      '<div class="g2" style="grid-template-columns:1fr 1fr"><label class="field">Duración (min)<input type="number" id="h-dur" value="55"></label>' +
      '<label class="field">Repetir cada semana<select id="h-rep"><option value="1">Solo ese día</option><option value="4">4 semanas</option><option value="8">8 semanas</option></select></label></div>' +
      '<div class="foot"><button type="button" class="btn btn-g btn-s" data-cerrar>Cerrar</button><button class="btn btn-p btn-s">Abrir huecos</button></div></form>', (w, cerrar) => {
      $('#fh', w).addEventListener('submit', async (e) => {
        e.preventDefault();
        const horas = $('#h-horas', w).value.split(',').map((x) => x.trim()).filter((x) => /^\d{1,2}:\d{2}$/.test(x));
        if (!horas.length) return M.toast('Escribe al menos una hora, por ejemplo 18:00', true);
        const rep = +$('#h-rep', w).value, dur = +$('#h-dur', w).value || 55, filas = [];
        for (let s = 0; s < rep; s++) for (const h of horas) { const x = new Date($('#h-dia', w).value + 'T' + h.padStart(5, '0')); filas.push({ titulo: 'Entrenamiento personal', disciplina: 'Personal', nivel: 'Todos', tipo: 'personal', plazas: 1, duracion_min: dur, inicio: M.masDias(x, 7 * s).toISOString() }); }
        const { error } = await sb.from('clases').insert(filas);
        if (error) return M.error(error);
        cerrar(); M.toast(filas.length + ' huecos abiertos'); refrescar();
      });
    });
  };

  async function verClase(id) {
    const { data: c } = await sb.from('clases').select('*').eq('id', id).single();
    const res = R.filter((r) => r.clase_id === id && r.estado !== 'cancelada');
    const libres = alumnas().filter((a) => a.estado === 'activa' && !res.some((r) => r.cliente_id === a.id));
    const tels = res.map((r) => cli[r.cliente_id] && cli[r.cliente_id].telefono).filter(Boolean);
    M.modal('<h3>' + esc(c.titulo) + '</h3><p class="muted">' + M.fecha(c.inicio) + ' · ' + M.hora(c.inicio) + ' · ' + c.duracion_min + ' min · ' + res.length + ' de ' + c.plazas + ' plazas</p>' +
      '<p class="small">Llama a cada alumna por <b>videollamada de WhatsApp</b> a la hora de la clase. ' + (c.tipo === 'grupo' ? 'Para el grupo, crea un grupo de WhatsApp con estos números y haz una videollamada de grupo.' : '') + '</p>' +
      (res.length ? res.map((r) => { const a = cli[r.cliente_id] || {}; return '<div class="row"><div class="l"><b>' + esc(a.nombre) + '</b><span>' + esc(a.telefono || 'sin teléfono') + (r.enfoque ? ' · ' + esc(r.enfoque) : '') + (r.estado !== 'confirmada' ? ' · ' + (r.estado === 'asistio' ? 'asistió' : 'faltó') : '') + '</span></div><div class="acts">' +
        (a.telefono ? '<a class="btn btn-wa btn-xs" target="_blank" rel="noopener" href="' + esc(M.wa('', M.telWa(a.telefono))) + '">WhatsApp</a>' : '') +
        '<button class="btn btn-g btn-xs" data-asis="' + r.id + '" data-e="asistio">Asistió</button><button class="btn btn-g btn-xs" data-asis="' + r.id + '" data-e="falta">Faltó</button><button class="btn btn-l btn-xs" data-quitar="' + r.id + '">Quitar</button></div></div>'; }).join('') : '<p class="empty">Nadie ha reservado todavía.</p>') +
      (tels.length > 1 ? '<button class="btn btn-g btn-s" id="v-tels" style="justify-self:start">Copiar teléfonos</button>' : '') +
      (res.length < c.plazas && libres.length ? '<div class="row"><select class="inp" id="v-add" style="flex:1"><option value="">Apuntar a una alumna…</option>' + libres.map((a) => '<option value="' + a.id + '">' + esc(a.nombre || a.email) + '</option>').join('') + '</select><button class="btn btn-p btn-xs" id="v-addb">Apuntar</button></div><p class="tiny muted">Apuntarla desde aquí no descuenta clases de su bono.</p>' : '') +
      '<div class="foot"><button class="btn btn-p btn-s" data-cerrar>Cerrar</button></div>', (w, cerrar) => {
      w.querySelectorAll('[data-asis]').forEach((b) => (b.onclick = async () => { const { error } = await sb.from('reservas').update({ estado: b.dataset.e }).eq('id', +b.dataset.asis); if (error) return M.error(error); cerrar(); await refrescar(); verClase(id); }));
      w.querySelectorAll('[data-quitar]').forEach((b) => (b.onclick = async () => { const { error } = await sb.rpc('cancelar_reserva', { p_reserva: +b.dataset.quitar }); if (error) return M.error(error); cerrar(); await refrescar(); verClase(id); }));
      const t = $('#v-tels', w); if (t) t.onclick = () => navigator.clipboard.writeText(tels.join(', ')).then(() => M.toast('Teléfonos copiados'), () => M.toast(tels.join(', ')));
      const ab = $('#v-addb', w); if (ab) ab.onclick = async () => { const v = $('#v-add', w).value; if (!v) return; const { error } = await sb.from('reservas').insert({ clase_id: id, cliente_id: v }); if (error) return M.error(error); cerrar(); await refrescar(); verClase(id); };
    });
  }

  // ================= ALUMNAS =================
  let filtroCli = 'activas';
  $$('#filtro-cli button').forEach((b) => (b.onclick = () => { filtroCli = b.dataset.f; $$('#filtro-cli button').forEach((x) => x.setAttribute('aria-selected', x === b)); pClientes(); }));
  $('#buscar').oninput = () => pClientes();
  function pClientes() {
    const q = $('#buscar').value.trim().toLowerCase();
    const sinAct = new Set(sinActivar().map((c) => c.id));
    const lista = alumnas().filter((c) => filtroCli === 'todas' || (filtroCli === 'bajas' ? c.estado === 'baja' : filtroCli === 'sinactivar' ? sinAct.has(c.id) : c.estado === 'activa'))
      .filter((c) => !q || [c.nombre, c.email, c.telefono].join(' ').toLowerCase().includes(q));
    $('#n-cli').textContent = lista.length + (lista.length === 1 ? ' alumna' : ' alumnas');
    $('#t-cli').innerHTML = lista.length ? lista.map((c) => {
      const act = activosDe(c.id), ult = ultimaClase(c.id), pend = bonosDe(c.id).some((b) => b.estado_pago === 'pendiente');
      return '<tr><td><b>' + esc(c.nombre || '—') + '</b>' + (c.estado === 'baja' ? ' <span class="pill warn">Baja</span>' : '') + (pend ? ' <span class="pill s">Pide activación</span>' : sinAct.has(c.id) ? ' <span class="pill">Sin activar</span>' : '') + '</td><td class="small">' + esc(c.email) + '<br>' + esc(c.telefono) + '</td><td class="small">' + (act.length ? act.map((b) => esc(b.nombre) + (quedan(b) != null ? ' (' + quedan(b) + ')' : '')).join('<br>') : '<span class="muted">Sin bono</span>') + '</td><td class="small">' + (ult ? M.fechaCorta(ult) : '<span class="muted">—</span>') + '</td><td class="small">' + M.fechaCorta(c.fecha_alta) + '</td><td><button class="btn btn-g btn-xs" data-ficha="' + c.id + '">Ficha</button></td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty">No hay alumnas en esta lista. Comparte el enlace de registro con «Invitar a una alumna».</td></tr>';
    $$('[data-ficha]').forEach((b) => (b.onclick = () => ficha(b.dataset.ficha)));
  }
  function ficha(id) {
    const c = cli[id], bs = bonosDe(id), rs = resDe(id).slice(0, 10);
    M.modal('<h3>' + esc(c.nombre || c.email) + '</h3><p class="small muted">' + esc(c.email) + ' · ' + esc(c.telefono) + ' · alta el ' + M.fechaCorta(c.fecha_alta) + (c.estado === 'baja' ? ' · <b>baja el ' + M.fechaCorta(c.fecha_baja) + '</b> (' + esc(c.motivo_baja || 'sin motivo') + ')' : '') + '</p>' +
      (c.objetivo ? '<p class="small"><b>Objetivo:</b> ' + esc(c.objetivo) + '</p>' : '') +
      '<div class="acts">' + (c.telefono ? '<a class="btn btn-wa btn-xs" target="_blank" rel="noopener" href="' + esc(M.wa('Hola ' + (c.nombre || '').split(' ')[0] + ', ', M.telWa(c.telefono))) + '">WhatsApp</a>' : '') + '<button class="btn btn-g btn-xs" id="f-clave">Nueva contraseña</button><button class="btn btn-p btn-xs" id="f-vender">Vender bono</button>' +
      (c.estado === 'activa' ? '<button class="btn btn-l btn-xs" id="f-baja">Dar de baja</button>' : '<button class="btn btn-l btn-xs" id="f-alta">Reactivar</button>') + '<button class="btn btn-l btn-xs" id="f-borrar">Eliminar cuenta</button></div>' +
      '<p class="eyebrow">Bonos</p>' + (bs.length ? bs.map((b) => '<div class="row"><div class="l"><b>' + esc(b.nombre) + '</b><span>' + M.eur(b.precio) + ' · ' + esc(b.metodo_pago) + ' · ' + (b.estado_pago === 'pagado' ? (quedan(b) != null ? quedan(b) + ' de ' + b.clases_total + ' · ' : '') + 'hasta ' + M.fechaCorta(b.caduca) : b.estado_pago) + '</span></div>' + (b.estado_pago === 'pendiente' ? '<button class="btn btn-p btn-xs" data-pag="' + b.id + '">Confirmar pago</button>' : activo(b) ? '<span class="pill ok">Activo</span>' : '<span class="pill">' + (b.estado_pago === 'anulado' ? 'Anulado' : 'Terminado') + '</span>') + '</div>').join('') : '<p class="empty">Sin bonos.</p>') +
      '<p class="eyebrow">Últimas clases</p>' + (rs.length ? rs.map((r) => '<div class="row"><div class="l"><b>' + esc(r.clases.titulo) + '</b><span>' + M.fechaCorta(r.clases.inicio) + ' · ' + M.hora(r.clases.inicio) + (r.enfoque ? ' · ' + esc(r.enfoque) : '') + '</span></div><span class="tiny muted">' + ({ confirmada: 'Reservada', asistio: 'Asistió', falta: 'Faltó' }[r.estado] || '') + '</span></div>').join('') : '<p class="empty">Sin clases todavía.</p>') +
      '<label class="field">Notas privadas<textarea id="f-notas" placeholder="Lesiones, preferencias, progresos…">' + esc(c.notas || '') + '</textarea></label>' +
      '<div class="foot"><button class="btn btn-g btn-s" data-cerrar>Cerrar</button><button class="btn btn-p btn-s" id="f-guardar">Guardar notas</button></div>', (w, cerrar) => {
      $('#f-guardar', w).onclick = async () => { const { error } = await sb.from('perfiles').update({ notas: $('#f-notas', w).value }).eq('id', id); if (error) return M.error(error); c.notas = $('#f-notas', w).value; M.toast('Notas guardadas'); };
      w.querySelectorAll('[data-pag]').forEach((b) => (b.onclick = async () => { const { error } = await sb.rpc('confirmar_pago', { p_bono: +b.dataset.pag }); if (error) return M.error(error); cerrar(); await refrescar(); ficha(id); M.toast('Pago confirmado'); }));
      $('#f-vender', w).onclick = () => { cerrar(); venta(id); };
      $('#f-clave', w).onclick = async () => {
        const { data, error } = await sb.functions.invoke('admin-alumnas', { body: { accion: 'clave', cliente_id: id } });
        if (error || !data || !data.password) return M.toast((data && data.error) || 'No se ha podido crear la contraseña', true);
        cerrar();
        M.modal('<h3>Nueva contraseña</h3><p class="muted">Envíasela a ' + esc(c.nombre) + ' por WhatsApp. Podrá cambiarla en «Mi perfil».</p><p style="font-family:var(--f-mono);font-size:22px">' + esc(data.password) + '</p><div class="foot"><button class="btn btn-g btn-s" data-cerrar>Cerrar</button>' + (c.telefono ? '<a class="btn btn-wa btn-s" target="_blank" rel="noopener" href="' + esc(M.wa('Hola ' + pila(c) + ', tu nueva contraseña de Moba Training es: ' + data.password + '\nEntra con tu móvil en ' + BASE + 'cuenta.html y cámbiala en «Mi perfil».', M.telWa(c.telefono))) + '">Enviar por WhatsApp</a>' : '') + '</div>');
      };
      $('#f-borrar', w).onclick = () => {
        cerrar();
        M.modal('<h3>¿Eliminar la cuenta de ' + esc(c.nombre) + '?</h3><p class="muted">Se borran para siempre su cuenta, sus reservas y sus bonos, incluidas las ventas de la facturación. No se puede deshacer. Úsalo solo si te pide borrar sus datos; para dejar de atenderla, mejor «Dar de baja».</p><div class="foot"><button class="btn btn-g btn-s" data-cerrar>Volver</button><button class="btn btn-p btn-s" id="b-ok">Eliminar para siempre</button></div>', (w2, cerrar2) => {
          $('#b-ok', w2).onclick = async () => {
            const { data, error } = await sb.functions.invoke('admin-alumnas', { body: { accion: 'eliminar', cliente_id: id } });
            if (error || !data || !data.ok) return M.toast((data && data.error) || 'No se ha podido eliminar', true);
            cerrar2(); M.toast('Cuenta eliminada'); refrescar();
          };
        });
      };
      const fb = $('#f-baja', w); if (fb) fb.onclick = async () => { const { error } = await sb.from('perfiles').update({ estado: 'baja', fecha_baja: new Date().toISOString(), motivo_baja: 'Baja dada por María' }).eq('id', id); if (error) return M.error(error); cerrar(); refrescar(); M.toast('Alumna dada de baja'); };
      const fa = $('#f-alta', w); if (fa) fa.onclick = async () => { const { error } = await sb.from('perfiles').update({ estado: 'activa', fecha_baja: null, motivo_baja: null }).eq('id', id); if (error) return M.error(error); cerrar(); refrescar(); M.toast('Alumna reactivada'); };
    });
  }
  function venta(clienteId) {
    M.modal('<h3>Registrar venta</h3><p class="small muted">Para bonos que ya has cobrado. Queda pagado, activo y con número de factura.</p><form class="form" id="fv">' +
      '<label class="field">Alumna<select id="v-cli">' + alumnas().filter((a) => a.estado === 'activa').map((a) => '<option value="' + a.id + '"' + (a.id === clienteId ? ' selected' : '') + '>' + esc(a.nombre || a.email) + '</option>').join('') + '</select></label>' +
      '<label class="field">Producto<select id="v-prod">' + PROD.map((p) => '<option value="' + p.id + '">' + esc(p.nombre) + ' · ' + M.eur(p.precio) + '</option>').join('') + '</select></label>' +
      '<label class="field">Cobrado por<select id="v-met"><option value="bizum">Bizum</option><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option></select></label>' +
      '<div class="foot"><button type="button" class="btn btn-g btn-s" data-cerrar>Cerrar</button><button class="btn btn-p btn-s">Registrar</button></div></form>', (w, cerrar) => {
      $('#fv', w).addEventListener('submit', async (e) => {
        e.preventDefault(); const cid = $('#v-cli', w).value; if (!cid) return M.toast('No hay alumnas activas', true);
        const { error } = await sb.rpc('vender_bono', { p_cliente: cid, p_producto: $('#v-prod', w).value, p_metodo: $('#v-met', w).value });
        if (error) return M.error(error); cerrar(); M.toast('Venta registrada'); refrescar();
      });
    });
  }
  $('#vender').onclick = () => venta(null);
  $('#invitar').onclick = () => {
    const link = BASE + 'cuenta.html', txt = '¡Hola! Te paso el enlace para crear tu cuenta en Moba Training y reservar tus clases de pilates, yoga y funcional online. Solo necesitas tu móvil y una contraseña, y al entrar puedes ver gratis una clase de prueba: ' + link;
    M.modal('<h3>Invitar a una alumna</h3><p class="small muted">Las alumnas se dan de alta ellas mismas con este enlace. Después aparecen aquí y puedes venderles bonos.</p><input class="inp" readonly value="' + esc(link) + '" id="i-link"><div class="foot"><button class="btn btn-g btn-s" id="i-copy">Copiar enlace</button><a class="btn btn-wa btn-s" target="_blank" rel="noopener" href="' + esc(M.wa(txt, '')).replace('https://wa.me/?', 'https://wa.me/?') + '">Enviar por WhatsApp</a></div>', (w) => {
      $('#i-copy', w).onclick = () => navigator.clipboard.writeText(link).then(() => M.toast('Enlace copiado'), () => $('#i-link', w).select());
    });
  };

  // ================= FACTURACIÓN =================
  $('#mes').value = hoy.slice(0, 7);
  $('#mes').onchange = () => pFact();
  const pagadosMes = () => B.filter((b) => b.estado_pago === 'pagado' && b.precio > 0 && b.fecha_pago && new Date(b.fecha_pago).toLocaleDateString('sv-SE').startsWith($('#mes').value)).sort((a, b) => (a.numero_factura || 0) - (b.numero_factura || 0));
  function pFact() {
    const l = pagadosMes(), tot = l.reduce((s, b) => s + +b.precio, 0), iva = C.fiscal.iva / 100, base = tot / (1 + iva);
    const pend = B.filter((b) => b.estado_pago === 'pendiente');
    $('#kpis-fact').innerHTML = '<div class="kpi"><span>Facturado</span><b class="num">' + M.eur(tot) + '</b><span>' + l.length + ' ventas</span></div><div class="kpi"><span>Base imponible</span><b class="num">' + M.eur(Math.round(base * 100) / 100) + '</b><span>sin IVA</span></div><div class="kpi"><span>IVA (' + C.fiscal.iva + ' %)</span><b class="num">' + M.eur(Math.round((tot - base) * 100) / 100) + '</b><span>incluido en los precios</span></div><div class="kpi"><span>Pendiente de cobro</span><b class="num">' + M.eur(pend.reduce((s, b) => s + +b.precio, 0)) + '</b><span>' + pend.length + ' solicitudes</span></div>';
    $('#t-fact').innerHTML = l.length ? l.map((b) => '<tr><td class="num">' + (b.numero_factura || '—') + '</td><td class="small">' + M.fechaCorta(b.fecha_pago) + '</td><td>' + esc(nombre(b.cliente_id)) + '</td><td class="small">' + esc(b.nombre) + '</td><td class="small">' + esc(b.metodo_pago) + '</td><td class="r">' + M.eur(b.precio) + '</td><td><button class="btn btn-l btn-xs" data-fac="' + b.id + '">Factura</button></td></tr>').join('') : '<tr><td colspan="7" class="empty">No hay ventas este mes.</td></tr>';
    $$('[data-fac]').forEach((x) => (x.onclick = () => factura(B.find((b) => b.id === +x.dataset.fac))));
    pintarPendientes($('#fact-pend'));
    const tipos = {}; l.forEach((b) => (tipos[b.tipo] = (tipos[b.tipo] || 0) + +b.precio));
    const nomT = { grupo: 'Clases en grupo', personal: 'Entrenamiento personal', videoteca: 'Videoteca', completo: 'Moba Completo' };
    $('#fact-tipo').innerHTML = Object.keys(tipos).length ? Object.entries(tipos).map(([k, v]) => '<div class="row"><span>' + (nomT[k] || k) + '</span><b class="num">' + M.eur(v) + '</b></div>').join('') : '<p class="empty">Sin datos este mes.</p>';
  }
  function factura(b) {
    const c = cli[b.cliente_id] || {}, iva = C.fiscal.iva / 100, base = Math.round(b.precio / (1 + iva) * 100) / 100, cuota = Math.round((b.precio - base) * 100) / 100;
    M.modal('<div class="factura"><div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><b style="font-size:20px">Moba Training</b><br>' + esc(C.fiscal.titular) + '<br>NIF: ' + esc(C.fiscal.nif || '(pendiente)') + '<br>' + esc(C.fiscal.direccion || '') + '</div><div style="text-align:right"><b>FACTURA Nº ' + new Date(b.fecha_pago).getFullYear() + '-' + String(b.numero_factura || 0).padStart(4, '0') + '</b><br>Fecha: ' + M.fechaCorta(b.fecha_pago) + '</div></div>' +
      '<div><b>Cliente</b><br>' + esc(c.nombre) + '<br>' + esc(c.email) + '</div>' +
      '<table><thead><tr><th>Concepto</th><th style="text-align:right">Base</th><th style="text-align:right">IVA ' + C.fiscal.iva + ' %</th><th style="text-align:right">Total</th></tr></thead><tbody><tr><td>' + esc(b.nombre) + '</td><td style="text-align:right">' + M.eur(base) + '</td><td style="text-align:right">' + M.eur(cuota) + '</td><td style="text-align:right"><b>' + M.eur(b.precio) + '</b></td></tr></tbody></table>' +
      '<div class="tiny">Forma de pago: ' + esc(b.metodo_pago) + '</div></div><div class="foot"><button class="btn btn-g btn-s" data-cerrar>Cerrar</button><button class="btn btn-p btn-s" id="imp">Imprimir o guardar PDF</button></div>', (w) => { $('#imp', w).onclick = () => window.print(); });
  }
  $('#csv').onclick = () => {
    const l = pagadosMes(), iva = C.fiscal.iva / 100;
    const filas = [['Factura', 'Fecha', 'Alumna', 'Email', 'Concepto', 'Pago', 'Base', 'IVA', 'Total']].concat(l.map((b) => { const base = Math.round(b.precio / (1 + iva) * 100) / 100; return [b.numero_factura, new Date(b.fecha_pago).toLocaleDateString('es-ES'), nombre(b.cliente_id), (cli[b.cliente_id] || {}).email, b.nombre, b.metodo_pago, base.toFixed(2).replace('.', ','), (b.precio - base).toFixed(2).replace('.', ','), Number(b.precio).toFixed(2).replace('.', ',')]; }));
    const csv = '﻿' + filas.map((f) => f.map((x) => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'moba-facturacion-' + $('#mes').value + '.csv'; a.click();
  };

  // ================= BAJAS Y AVISOS =================
  function pRet() {
    const cad = caducanPronto();
    $('#ret-cad').innerHTML = cad.length ? cad.map(filaCad).join('') : '<p class="empty">Nada por ahora.</p>';
    const rg = enRiesgo();
    $('#ret-riesgo').innerHTML = rg.length ? rg.map(({ c, motivo }) => '<div class="row"><div class="l"><b>' + esc(c.nombre || c.email) + '</b><span>' + esc(motivo) + '</span>' + avisadoTxt(c.id) + '</div><div class="acts">' + (c.telefono ? '<a class="btn btn-wa btn-xs" target="_blank" rel="noopener" data-avisar="vuelve" data-cli="' + c.id + '" href="' + esc(waVuelve(c)) + '">Avisar por WhatsApp</a>' : '') + '</div></div>').join('') : '<p class="empty">Todas las alumnas activas están entrenando.</p>';
    const bajas = alumnas().filter((c) => c.estado === 'baja').sort((a, b) => (b.fecha_baja || '').localeCompare(a.fecha_baja || ''));
    $('#ret-bajas').innerHTML = bajas.length ? bajas.map((c) => '<div class="row"><div class="l"><b>' + esc(c.nombre || c.email) + '</b><span>' + (c.fecha_baja ? M.fechaCorta(c.fecha_baja) + ' · ' : '') + esc(c.motivo_baja || 'sin motivo') + '</span></div><button class="btn btn-g btn-xs" data-ficha="' + c.id + '">Ficha</button></div>').join('') : '<p class="empty">No hay bajas.</p>';
    botonAvisar($('#ret-cad')); botonAvisar($('#ret-riesgo'));
    $$('#ret-bajas [data-ficha]').forEach((b) => (b.onclick = () => ficha(b.dataset.ficha)));
  }

  // ================= VÍDEOS =================
  function pVideos() {
    $('#t-vid').innerHTML = V.length ? V.map((v) => '<tr><td><b>' + esc(v.titulo) + '</b><br><span class="tiny muted">' + esc(v.nivel) + '</span></td><td>' + esc(v.disciplina) + '</td><td class="num">' + v.duracion_min + ' min</td><td>' + (v.gratis ? '<span class="pill g">Clase de prueba</span>' : '<span class="pill a">Con plan</span>') + '</td><td>' + (v.publicado ? '<span class="pill ok">Publicado</span>' : '<span class="pill">Borrador</span>') + '</td><td><button class="btn btn-g btn-xs" data-vid="' + v.id + '">Editar</button></td></tr>').join('') : '<tr><td colspan="6" class="empty">Todavía no hay vídeos. Cuando los grabes, súbelos y añádelos aquí.</td></tr>';
    $$('[data-vid]').forEach((b) => (b.onclick = () => formVideo(V.find((v) => v.id === +b.dataset.vid))));
  }
  async function formVideo(v) {
    if (v) { const { data } = await sb.rpc('ver_video', { p_id: v.id }); v = { ...v, url: data }; }
    M.modal('<h3>' + (v ? 'Editar vídeo' : 'Añadir vídeo') + '</h3><form class="form" id="fvid">' +
      '<label class="field">Título<input id="vi-tit" value="' + esc(v ? v.titulo : '') + '"></label>' +
      '<div class="g2" style="grid-template-columns:1fr 1fr"><label class="field">Disciplina<select id="vi-dis">' + ['Pilates', 'Yoga', 'Funcional'].map((x) => '<option' + (v && v.disciplina === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label><label class="field">Nivel<select id="vi-niv">' + ['Todos', 'Inicial', 'Medio', 'Avanzado'].map((x) => '<option' + (v && v.nivel === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label></div>' +
      '<label class="field">Duración (min)<input type="number" id="vi-dur" value="' + (v ? v.duracion_min : 20) + '"></label>' +
      '<label class="field">Enlace del vídeo<input id="vi-url" value="' + esc(v && v.url || '') + '" placeholder="https://vimeo.com/… o https://drive.google.com/…"></label>' +
      '<label class="field">Descripción<textarea id="vi-desc">' + esc(v && v.descripcion || '') + '</textarea></label>' +
      '<label class="check"><input type="checkbox" id="vi-gratis"' + (v && v.gratis ? ' checked' : '') + '> Clase de prueba: la ven gratis todas las cuentas registradas, aunque no hayan pagado</label>' +
      '<label class="check"><input type="checkbox" id="vi-pub"' + (!v || v.publicado ? ' checked' : '') + '> Publicado</label>' +
      '<div class="foot">' + (v ? '<button type="button" class="btn btn-l" id="vi-del" style="margin-right:auto">Eliminar</button>' : '') + '<button type="button" class="btn btn-g btn-s" data-cerrar>Cerrar</button><button class="btn btn-p btn-s">Guardar</button></div></form>', (w, cerrar) => {
      $('#fvid', w).addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = { titulo: $('#vi-tit', w).value.trim(), disciplina: $('#vi-dis', w).value, nivel: $('#vi-niv', w).value, duracion_min: +$('#vi-dur', w).value || 20, url: $('#vi-url', w).value.trim() || null, descripcion: $('#vi-desc', w).value.trim() || null, gratis: $('#vi-gratis', w).checked, publicado: $('#vi-pub', w).checked };
        if (!f.titulo) return M.toast('Pon un título', true);
        const { error } = v ? await sb.from('videos').update(f).eq('id', v.id) : await sb.from('videos').insert(f);
        if (error) return M.error(error); cerrar(); M.toast('Vídeo guardado'); refrescar();
      });
      const d = $('#vi-del', w); if (d) d.onclick = async () => { const { error } = await sb.from('videos').delete().eq('id', v.id); if (error) return M.error(error); cerrar(); M.toast('Vídeo eliminado'); refrescar(); };
    });
  }
  $('#nuevo-video').onclick = () => formVideo(null);

  // ================= TARIFAS =================
  function pTarifas() {
    $('#t-prod').innerHTML = PROD.map((p) => '<tr><td><b>' + esc(p.nombre) + '</b><br><span class="tiny muted">' + esc(p.descripcion || '') + '</span></td><td class="num">' + (p.clases == null ? 'Ilimitado' : p.clases) + '</td><td class="num">' + p.dias_validez + ' días</td><td class="r"><input class="inp" type="number" step="0.01" min="0" style="max-width:100px;text-align:right" id="pr-' + p.id + '" value="' + p.precio + '"></td><td><input type="checkbox" id="ac-' + p.id + '"' + (p.activo ? ' checked' : '') + ' aria-label="En venta"></td><td><button class="btn btn-g btn-xs" data-prod="' + p.id + '">Guardar</button></td></tr>').join('');
    $$('[data-prod]').forEach((b) => (b.onclick = async () => { const id = b.dataset.prod; const { error } = await sb.from('productos').update({ precio: +$('#pr-' + id).value, activo: $('#ac-' + id).checked }).eq('id', id); if (error) return M.error(error); M.toast('Precio guardado'); refrescar(); }));
  }

  await refrescar();
})();
