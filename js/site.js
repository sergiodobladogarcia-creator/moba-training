/* Web pública: horario real, tarifas, videoteca, test y formularios */
(async function () {
  const C = window.MOBA, sb = M.sb, esc = M.esc, $ = M.$;

  // ---------- cabecera según sesión ----------
  const perfil = await M.perfil().catch(() => null);
  if (perfil) {
    const b = $('#btn-cuenta');
    if (perfil.rol === 'admin') { b.textContent = 'Mi panel'; b.href = 'panel.html'; }
    else { b.textContent = 'Mi cuenta'; }
  }

  // ---------- WhatsApp y pie ----------
  $('#wa-float').href = M.wa('Hola María, tengo una pregunta sobre las clases de Moba Training.');
  $('#wa-hora').href = M.wa('Hola María, ¿tienes algún hueco para entrenamiento personal fuera del horario publicado?');
  $('#f-wa').textContent = C.whatsappVisible;
  if (C.email) { const e = $('#f-mail'); e.hidden = false; e.textContent = C.email; }
  if (C.instagram) { const e = $('#f-ig'); e.hidden = false; e.innerHTML = '<a href="https://instagram.com/' + esc(C.instagram) + '" target="_blank" rel="noopener">@' + esc(C.instagram) + '</a>'; }
  $('#year').textContent = new Date().getFullYear();
  M.$$('[data-reto]').forEach((a) => (a.href = M.wa('Hola María, quiero apuntarme al reto «' + a.dataset.reto + '». ¿Cuándo empieza la próxima edición?')));
  M.$$('.dots').forEach((d) => (d.innerHTML = '<i></i>'.repeat(+d.dataset.n)));

  // ---------- animación de respiración ----------
  const cv = $('#breath'), cx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tok = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  (function draw(t) {
    const w = cv.width, h = cv.height; cx.clearRect(0, 0, w, h);
    const a = tok('--accent'), sg = tok('--sage'), ink = tok('--muted');
    const p = reduce ? 0.5 : (Math.sin((t || 0) / 1400) + 1) / 2;
    for (let i = 4; i >= 1; i--) { cx.beginPath(); cx.arc(w / 2, h / 2, 40 + i * 26 + p * 22, 0, Math.PI * 2); cx.fillStyle = i % 2 ? sg : a; cx.globalAlpha = 0.12 + 0.06 * (4 - i); cx.fill(); }
    cx.globalAlpha = 1; cx.beginPath(); cx.arc(w / 2, h / 2, 40 + p * 18, 0, Math.PI * 2); cx.fillStyle = a; cx.fill();
    cx.fillStyle = ink; cx.font = '600 18px Figtree, sans-serif'; cx.textAlign = 'center';
    cx.fillText(p > 0.5 ? 'inhala' : 'exhala', w / 2, h - 28);
    if (!reduce) requestAnimationFrame(draw);
  })();

  // ---------- próxima clase ----------
  async function proxima() {
    const { data } = await sb.rpc('horario', { desde: new Date().toISOString(), hasta: M.masDias(new Date(), 21).toISOString() });
    const c = (data || []).find((x) => x.tipo === 'grupo' && x.ocupadas < x.plazas);
    if (!c) { $('#next-t').textContent = 'Nuevo horario muy pronto'; $('#next-s').textContent = 'Crea tu cuenta y te aviso de las primeras clases.'; $('#next-b').textContent = 'Crear cuenta'; $('#next-b').href = 'cuenta.html'; return; }
    $('#next-t').textContent = c.titulo;
    $('#next-s').textContent = M.fecha(c.inicio) + ' · ' + M.hora(c.inicio) + ' · ' + c.duracion_min + ' min · ' + (c.plazas - c.ocupadas) + ' de ' + c.plazas + ' plazas libres';
    $('#next-b').textContent = 'Reservar mi plaza'; $('#next-b').href = 'cuenta.html?reservar=' + c.id;
    const cd = $('#cd'), t0 = new Date(c.inicio);
    const tick = () => {
      let s = Math.max(0, Math.floor((t0 - new Date()) / 1000));
      const d = Math.floor(s / 86400); s %= 86400;
      const p = (n) => String(n).padStart(2, '0');
      cd.textContent = 'empieza en ' + (d ? d + ' d ' : '') + p(Math.floor(s / 3600)) + ':' + p(Math.floor((s % 3600) / 60)) + ':' + p(s % 60);
    };
    tick(); setInterval(tick, 1000);
  }
  proxima();

  // ---------- test ----------
  const QS = [
    ['¿Qué buscas sobre todo?', [['Fuerza y tono', 'f'], ['Flexibilidad y calma', 'y'], ['Postura y espalda', 'p'], ['Recuperar una lesión', 'l']]],
    ['¿Qué nivel tienes?', [['Empiezo de cero', '0'], ['Algo de experiencia', '1'], ['Entreno a menudo', '2']]],
    ['¿Cómo prefieres entrenar?', [['En grupo reducido', 'g'], ['Solo conmigo', 'p'], ['A mi ritmo, con vídeos', 'v']]]
  ];
  const ans = ['p', '0', 'g'];
  const REC = {
    f: ['Funcional', 'Trabajo de fuerza con tu peso: notarás el cambio en pocas semanas.'],
    y: ['Yoga', 'Movimiento fluido y respiración para ganar flexibilidad y desconectar.'],
    p: ['Pilates', 'Core y movilidad para mejorar la postura y aliviar la espalda.'],
    l: ['Entrenamiento personal', 'Un plan solo para ti, adaptado a tu lesión y a tu ritmo de recuperación.']
  };
  function renderQ() {
    $('#quiz-q').innerHTML = QS.map((q, k) => '<div class="q"><p>' + q[0] + '</p><div class="o">' + q[1].map((o) => '<button data-k="' + k + '" data-v="' + o[1] + '" aria-pressed="' + (ans[k] === o[1]) + '">' + o[0] + '</button>').join('') + '</div></div>').join('');
    M.$$('#quiz-q button').forEach((b) => (b.onclick = () => { ans[+b.dataset.k] = b.dataset.v; renderQ(); }));
    let [cl, why] = REC[ans[0]];
    let plan = 'Bono 4 clases en grupo', dest = '#horario', modo = 'grupo';
    if (ans[0] === 'l' || ans[2] === 'p') { cl = ans[0] === 'l' ? cl : 'Entrenamiento personal de ' + cl.toLowerCase(); plan = 'Bono 4 entrenamientos personales'; modo = 'personal'; if (ans[0] !== 'l') why = 'Toda mi atención para ti: ' + why.charAt(0).toLowerCase() + why.slice(1); }
    else if (ans[2] === 'v') { plan = 'Moba Completo (clases + videoteca)'; }
    else if (ans[1] === '2') { plan = 'Clases en grupo ilimitadas'; }
    if (ans[1] === '0' && modo === 'grupo') why += ' Empieza por las clases de nivel inicial o «todos».';
    $('#quiz-r').innerHTML = '<span class="eyebrow">Te recomiendo</span><h3>' + esc(cl) + '</h3><p class="muted">' + esc(why) + '</p><div class="prow"><span>Plan ideal</span><b>' + esc(plan) + '</b></div><a class="btn btn-p" href="' + dest + '" data-modo="' + modo + '">' + (modo === 'grupo' ? 'Ver clases y probar gratis' : 'Ver huecos de entrenamiento personal') + '</a>';
    $('#quiz-r [data-modo]').onclick = () => setModo(modo);
  }
  renderQ();

  // ---------- horario semanal ----------
  let semana = M.lunes(), dia = (new Date().getDay() + 6) % 7, modo = 'grupo', clases = [];
  async function cargarSemana() {
    const { data, error } = await sb.rpc('horario', { desde: semana.toISOString(), hasta: M.masDias(semana, 7).toISOString() });
    clases = error ? [] : data;
    const fin = M.masDias(semana, 6);
    $('#w-lbl').textContent = semana.getDate() + ' ' + semana.toLocaleDateString('es-ES', { month: 'short' }) + ' – ' + fin.getDate() + ' ' + fin.toLocaleDateString('es-ES', { month: 'short' });
    $('#w-prev').disabled = semana <= M.lunes();
    render();
  }
  function render() {
    const delModo = clases.filter((c) => c.tipo === modo);
    $('#days').innerHTML = M.DN.map((n, i) => {
      const d = M.masDias(semana, i), k = delModo.filter((c) => M.mismoDia(c.inicio, d)).length;
      return '<button aria-pressed="' + (i === dia) + '" data-i="' + i + '"><small>' + n + '</small><b class="num">' + d.getDate() + '</b><i>' + (k ? k + (k === 1 ? ' clase' : ' clases') : '') + '</i></button>';
    }).join('');
    M.$$('#days button').forEach((b) => (b.onclick = () => { dia = +b.dataset.i; render(); }));
    const hoy = delModo.filter((c) => M.mismoDia(c.inicio, M.masDias(semana, dia)) && new Date(c.inicio) > new Date());
    const el = $('#slots');
    if (!hoy.length) { el.innerHTML = '<p class="empty">' + (modo === 'grupo' ? 'No hay clases en grupo este día.' : 'No hay huecos de entrenamiento personal libres este día.') + ' Prueba otro día o escríbeme por WhatsApp.</p>'; return; }
    el.innerHTML = hoy.map((c) => {
      const libres = c.plazas - c.ocupadas, llena = libres <= 0;
      const cap = modo === 'grupo' ? '<div class="cap"><span class="bar"><i style="width:' + (c.ocupadas / c.plazas * 100) + '%"></i></span><span class="num">' + (llena ? 'Completa' : libres + (libres === 1 ? ' plaza libre' : ' plazas libres') + ' de ' + c.plazas) + '</span></div>' : '';
      return '<div class="slot"><time>' + M.hora(c.inicio) + '</time><div class="info"><b>' + esc(c.titulo) + '</b><span>' + esc(c.disciplina) + ' · ' + c.duracion_min + ' min · ' + esc(c.nivel) + '</span>' + cap + '</div>' +
        (llena ? '<button class="btn btn-g btn-s" disabled>Completa</button>' : '<a class="btn btn-p btn-s" href="cuenta.html?reservar=' + c.id + '">Reservar</a>') + '</div>';
    }).join('');
  }
  function setModo(m) {
    modo = m; $('#t-grupo').setAttribute('aria-selected', m === 'grupo'); $('#t-personal').setAttribute('aria-selected', m === 'personal');
    $('#hint-personal').hidden = m !== 'personal'; render();
  }
  $('#t-grupo').onclick = () => setModo('grupo');
  $('#t-personal').onclick = () => setModo('personal');
  $('#w-prev').onclick = () => { semana = M.masDias(semana, -7); cargarSemana(); };
  $('#w-next').onclick = () => { semana = M.masDias(semana, 7); dia = 0; cargarSemana(); };
  cargarSemana();

  // ---------- videoteca ----------
  const ICON = {
    Pilates: '<svg viewBox="0 0 120 60" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><circle cx="22" cy="40" r="7" fill="currentColor" stroke="none"/><path d="M30 42 L70 44 L100 18"/><path d="M60 43 L58 28"/><path d="M8 54 H112" stroke-width="3" opacity=".4"/></svg>',
    Yoga: '<svg viewBox="0 0 120 60" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><circle cx="60" cy="10" r="7" fill="currentColor" stroke="none"/><path d="M60 18 V36"/><path d="M60 36 L40 54 M60 36 L80 54"/><path d="M34 22 L60 26 L86 22"/><path d="M8 56 H112" stroke-width="3" opacity=".4"/></svg>',
    Funcional: '<svg viewBox="0 0 120 60" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M20 30 H100"/><rect x="10" y="18" width="10" height="24" rx="3" fill="currentColor" stroke="none"/><rect x="100" y="18" width="10" height="24" rx="3" fill="currentColor" stroke="none"/><path d="M8 56 H112" stroke-width="3" opacity=".4"/></svg>'
  };
  window.MOBA_ICON = ICON;
  const { data: vids } = await sb.from('videos').select('id,titulo,disciplina,nivel,duracion_min,gratis').order('creado', { ascending: false });
  let filtro = 'Todo';
  function renderV() {
    const lista = (vids || []).filter((v) => filtro === 'Todo' || v.disciplina === filtro);
    if (!vids || !vids.length) {
      $('#chips').hidden = true;
      $('#vids').outerHTML = '<div class="soon"><span class="pill s">Muy pronto</span><h3>Estoy grabando los primeros vídeos</h3><p class="muted">Pilates, yoga y funcional para entrenar a tu ritmo. Si te suscribes a la videoteca o a Moba Completo, te aviso en cuanto estén.</p></div>';
      return;
    }
    $('#chips').innerHTML = ['Todo', 'Pilates', 'Yoga', 'Funcional'].map((x) => '<button aria-pressed="' + (x === filtro) + '">' + x + '</button>').join('');
    M.$$('#chips button').forEach((b) => (b.onclick = () => { filtro = b.textContent; renderV(); }));
    $('#vids').innerHTML = lista.map((v) => '<a class="vid" href="cuenta.html#videoteca" style="color:inherit;text-decoration:none"><div class="thumb" data-d="' + esc(v.disciplina) + '">' + (ICON[v.disciplina] || '') + '<span class="dur num">' + v.duracion_min + ' min</span><span class="lock pill ' + (v.gratis ? 'g">Gratis' : 'a">Suscriptoras') + '</span></div><div class="body"><b>' + esc(v.titulo) + '</b><span>' + esc(v.disciplina) + ' · ' + esc(v.nivel) + '</span></div></a>').join('') || '<p class="empty">No hay vídeos de esta disciplina todavía.</p>';
  }
  renderV();

  // ---------- tarifas ----------
  const { data: prods } = await sb.from('productos').select('*').eq('activo', true).order('orden');
  const P = Object.fromEntries((prods || []).map((p) => [p.id, p]));
  const fila = (p, extra) => p ? '<div class="prow num"><span>' + esc(extra || p.nombre) + '</span><span><b>' + M.eur(p.precio) + (p.mensual ? '/mes' : '') + '</b> <a href="cuenta.html?comprar=' + p.id + '">Elegir</a></span></div>' : '';
  const grupo = (prods || []).filter((p) => p.tipo === 'grupo'), pers = (prods || []).filter((p) => p.tipo === 'personal');
  const minPrecio = (l) => l.length ? Math.min(...l.map((p) => +p.precio)) : 0;
  $('#plans').innerHTML =
    '<div class="plan"><span class="pill a" style="justify-self:start">En grupo</span><h3>Clases en directo</h3><div class="price num"><small>desde </small>' + M.eur(minPrecio(grupo)) + '<small> / clase</small></div>' + grupo.map((p) => fila(p, p.clases === 1 ? 'Clase suelta' : p.clases ? 'Bono ' + p.clases : 'Ilimitado')).join('') + '<ul><li>Grupos de máximo 6 personas</li><li>Correcciones en directo</li><li>Primera clase gratis</li></ul></div>' +
    '<div class="plan"><span class="pill g" style="justify-self:start">1 a 1</span><h3>Entrenamiento personal</h3><div class="price num"><small>desde </small>' + M.eur(minPrecio(pers.filter((p) => p.id !== 'duo'))) + '<small> / sesión</small></div>' + pers.map((p) => fila(p, p.id === 'duo' ? 'Dúo (2 personas)' : p.clases === 1 ? 'Sesión suelta' : 'Bono ' + p.clases)).join('') + '<p class="small">Tú eliges el enfoque:</p><ul><li>Fuerza y tonificación</li><li>Recuperación y prevención de lesiones</li><li>Pilates, yoga o funcional a tu medida</li><li>La actividad u objetivo que tú decidas</li></ul></div>' +
    (P.vid ? '<div class="plan"><span class="pill s" style="justify-self:start">Bajo demanda</span><h3>Videoteca</h3><div class="price num">' + M.eur(P.vid.precio) + '<small> / mes</small></div><ul><li>Todos los vídeos</li><li>Nuevos vídeos cada semana</li><li>Sin permanencia</li></ul><a class="btn btn-g btn-s" href="cuenta.html?comprar=vid">Suscribirme</a></div>' : '') +
    (P.comp ? '<div class="plan hl"><span class="pill a" style="justify-self:start">Más completo</span><h3>Moba Completo</h3><div class="price num"><small>desde </small>' + M.eur(P.comp.precio) + '<small> / mes</small></div><ul><li>Clases en grupo ilimitadas</li><li>Videoteca incluida</li><li class="muted">Sin permanencia</li></ul><a class="btn btn-p btn-s" href="cuenta.html?comprar=comp">Lo quiero</a></div>' : '');

  // ---------- tarjeta regalo ----------
  const GIFTS = ['g1', 'g4', 'p1', 'comp'].map((k) => P[k]).filter(Boolean);
  let gi = Math.min(1, GIFTS.length - 1);
  function renderG() {
    if (!GIFTS.length) return;
    $('#gift-o').innerHTML = GIFTS.map((g, i) => '<button data-i="' + i + '" aria-pressed="' + (i === gi) + '">' + esc(g.nombre) + '</button>').join('');
    M.$$('#gift-o button').forEach((b) => (b.onclick = () => { gi = +b.dataset.i; renderG(); }));
    const g = GIFTS[gi];
    $('#gift-v').textContent = g.nombre + ' · ' + M.eur(g.precio);
    $('#gift-b').href = M.wa('Hola María, quiero regalar «' + g.nombre + '» (' + M.eur(g.precio) + ') como tarjeta regalo.');
  }
  renderG();

  // ---------- guía gratis ----------
  $('#guide-wa').href = M.wa('Hola María, me gustaría recibir la guía gratis de 7 ejercicios para la espalda.');
})();
