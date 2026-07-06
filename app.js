let celular = localStorage.getItem('tapadita_celular');
let cartonActual = null;
let modoEditar = false;
let paginaActual = 0;
let tapaditaRevelada = []; // ahora es un array: una posición por cada premio
let indexPendiente = null; // qué tapadita se está por raspar/confirmar

if (!celular) window.location.href = 'index.html';

// ===== INICIO =====
async function init() {
  const { data, error } = await db
    .from('cartones')
    .select('*')
    .eq('celular', celular)
    .eq('estado', 'activo')
    .single();

  if (data) {
    cartonActual = data;
    renderizarCarton();
  } else {
    abrirNuevo();
  }
}

let tamañoElegido = 25;

function elegirTamaño(tamaño) {
  tamañoElegido = tamaño;
  document.getElementById('paso-tamaño').style.display = 'none';
  document.getElementById('paso-premios').style.display = 'block';
}

// ===== CREAR CARTON =====
async function crearCarton(premios) {
  const tamaño = tamañoElegido;
  cerrarNuevo();

  if (cartonActual) {
    await db.from('cartones').update({ estado: 'historial' }).eq('id', cartonActual.id);
  }

  const { data, error } = await db
    .from('cartones')
    .insert({ celular, tamaño, premio: '', costo: '', estado: 'activo', premios: premios })
    .select()
    .single();

  if (error) { alert('Error al crear el cartón.'); return; }

  const { data: nombresData } = await db.from('nombres').select('nombre');

  const nombresmezclados = nombresData
    .map(n => n.nombre)
    .sort(() => Math.random() - 0.5)
    .slice(0, tamaño);

  const celdas = [];
  for (let i = 1; i <= tamaño; i++) {
    celdas.push({ carton_id: data.id, numero: i, nombre_predefinido: nombresmezclados[i - 1], nombre: '' });
  }
  await db.from('celdas').insert(celdas);

  cartonActual = data;
  cartonActual.celdas = celdas;
  paginaActual = 0;
  tapaditaRevelada = []; // cartón nuevo => tapaditas nuevas, sin revelar
  renderizarCarton();
}

function generarCamposPremios() {
  const cantPremios = cartonActual.premios || 1;
  const premios = cartonActual.premio ? cartonActual.premio.split('|') : [];
  const etiquetas = ['Premio:', '1er Premio:', '2do Premio:', '3er Premio:'];

  if (cantPremios === 1) {
    return `
      <div class="info-fila">
        <span class="etiqueta">Premio:</span>
        <input class="info-input" id="input-premio-0" value="${premios[0] || ''}" placeholder="—" ${modoEditar ? '' : 'readonly'}>
      </div>`;
  }

  let html = '';
  for (let i = 0; i < cantPremios; i++) {
    html += `
      <div class="info-fila" style="margin-top:${i > 0 ? '6px' : '0'}">
        <span class="etiqueta">${etiquetas[i + 1]}</span>
        <input class="info-input" id="input-premio-${i}" value="${premios[i] || ''}" placeholder="—" ${modoEditar ? '' : 'readonly'}>
      </div>`;
  }
  return html;
}

// ===== RENDERIZAR CARTON =====
async function renderizarCarton() {
  const { data: celdas } = await db
    .from('celdas')
    .select('*')
    .eq('carton_id', cartonActual.id)
    .order('numero');

  cartonActual.celdas = celdas;

  const container = document.getElementById('carton-container');
  container.innerHTML = '';

  const tamaño = cartonActual.tamaño;
  const paginas = tamaño / 25;
  const cantPremiosTap = cartonActual.premios || 1;

  // ----- BLOQUE DE INFO (premios + costo) -----
  const info = document.createElement('div');
  info.className = 'carton-info';
  info.innerHTML = `
    ${generarCamposPremios()}
    <div class="info-fila" style="margin-top:6px">
      <span class="etiqueta">Costo:</span>
      <input class="info-input" id="input-costo" value="${cartonActual.costo || ''}" placeholder="—" ${modoEditar ? '' : 'readonly'}>
    </div>
  `;
  container.appendChild(info);

  // ----- TAPADITAS: entre el costo y la cuadrícula -----
  // Tamaño de cada cuadradito según cuántos premios haya (para que entren en pantallas chicas)
  let anchoCanvas = 130, altoCanvas = 80;
  if (cantPremiosTap === 2) { anchoCanvas = 120; altoCanvas = 75; }
  if (cantPremiosTap >= 3) { anchoCanvas = 96; altoCanvas = 68; }

  const tapaditasWrap = document.createElement('div');
  tapaditasWrap.className = 'tapaditas-container' + (cantPremiosTap > 1 ? ' multi' : '');
  let tapaditasHtml = '';
  for (let i = 0; i < cantPremiosTap; i++) {
    tapaditasHtml += `
      <div class="tapadita-container" style="width:${anchoCanvas}px; height:${altoCanvas}px;">
        <div class="tapadita-resultado" id="tapadita-resultado-${i}">
          <span id="tapadita-numero-${i}">?</span>
          <span id="tapadita-nombre-${i}"></span>
        </div>
        <canvas id="tapadita-canvas-${i}" width="${anchoCanvas}" height="${altoCanvas}"></canvas>
      </div>`;
  }
  tapaditasWrap.innerHTML = tapaditasHtml;
  container.appendChild(tapaditasWrap);

  // ----- NAV DE PAGINAS (si el cartón tiene más de 25 números) -----
  if (paginas > 1) {
    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex; gap:8px; margin-bottom:10px; justify-content:center;';
    for (let p = 0; p < paginas; p++) {
      const btn = document.createElement('button');
      btn.textContent = `${p * 25 + 1}–${(p + 1) * 25}`;
      btn.style.cssText = `padding:6px 14px; border-radius:20px; border:2px solid #4caf50; background:${p === paginaActual ? '#4caf50' : 'white'}; color:${p === paginaActual ? 'white' : '#4caf50'}; cursor:pointer; font-size:13px;`;
      btn.onclick = () => { paginaActual = p; renderizarCarton(); };
      nav.appendChild(btn);
    }
    container.appendChild(nav);
  }

  // ----- CUADRICULA -----
  const grilla = document.createElement('div');
  grilla.className = 'grilla';

  const inicio = paginaActual * 25;
  const fin = inicio + 25;
  const celdasPagina = celdas.slice(inicio, fin);

  celdasPagina.forEach(celda => {
    const div = document.createElement('div');
    div.className = 'celda';

    const numero = document.createElement('span');
    numero.className = 'celda-numero';
    numero.textContent = celda.numero;

    const nombrePredefinido = document.createElement('span');
    nombrePredefinido.className = 'celda-nombre-predefinido';
    nombrePredefinido.textContent = celda.nombre_predefinido || '';

    const input = document.createElement('textarea');
    const yaEscrito = celda.nombre && celda.nombre.trim() !== '';
    input.className = 'celda-comprador' + (modoEditar && !yaEscrito ? ' editable' : '');
    input.value = celda.nombre || '';
    input.placeholder = modoEditar && !yaEscrito ? 'Apodo' : '';
    input.rows = 1;
    input.readOnly = !modoEditar || yaEscrito;

    input.addEventListener('change', () => guardarCelda(celda.id, input.value));

    div.appendChild(numero);
    div.appendChild(input);
    div.appendChild(nombrePredefinido);
    grilla.appendChild(div);
  });

  container.appendChild(grilla);

  if (modoEditar) {
    const cantPremios = cartonActual.premios || 1;
    for (let i = 0; i < cantPremios; i++) {
      const input = document.getElementById(`input-premio-${i}`);
      if (input) {
        input.addEventListener('change', guardarInfo);
        input.classList.add('editable');
      }
    }
    const inputCosto = document.getElementById('input-costo');
    if (inputCosto) {
      inputCosto.addEventListener('change', guardarInfo);
      inputCosto.classList.add('editable');
    }
  }

  setTimeout(iniciarTapaditas, 100);
}

// ===== GUARDAR CELDA =====
async function guardarCelda(id, nombre) {
  await db.from('celdas').update({ nombre }).eq('id', id);
}

// ===== GUARDAR INFO =====
async function guardarInfo() {
  const cantPremios = cartonActual.premios || 1;
  const premiosArr = [];
  for (let i = 0; i < cantPremios; i++) {
    const input = document.getElementById(`input-premio-${i}`);
    if (input) premiosArr.push(input.value);
  }
  const premio = premiosArr.join('|');
  const costo = document.getElementById('input-costo').value;
  await db.from('cartones').update({ premio, costo }).eq('id', cartonActual.id);
  cartonActual.premio = premio;
  cartonActual.costo = costo;
}

// ===== EDITAR =====
function toggleEditar() {
  modoEditar = !modoEditar;
  renderizarCarton();
}

// ===== MENU =====
function abrirMenu() {
  document.getElementById('menu-overlay').classList.add('visible');
}

function cerrarMenu(e) {
  if (!e || e.target === document.getElementById('menu-overlay')) {
    document.getElementById('menu-overlay').classList.remove('visible');
  }
}

// ===== NUEVO CARTON =====
function abrirNuevo() {
  cerrarMenu();
  document.getElementById('nuevo-overlay').classList.add('visible');
}

function cerrarNuevo(e) {
  if (!e || e.target === document.getElementById('nuevo-overlay')) {
    document.getElementById('nuevo-overlay').classList.remove('visible');
    document.getElementById('paso-tamaño').style.display = 'block';
    document.getElementById('paso-premios').style.display = 'none';
  }
}

// ===== HISTORIAL =====
async function abrirHistorial() {
  cerrarMenu();
  const { data } = await db
    .from('cartones')
    .select('*')
    .eq('celular', celular)
    .eq('estado', 'historial')
    .order('created_at', { ascending: false });

  const lista = document.getElementById('historial-lista');
  lista.innerHTML = '';

  if (!data || data.length === 0) {
    lista.innerHTML = '<p style="color:#aaa; text-align:center;">No hay cartones anteriores.</p>';
  } else {
    data.forEach(c => {
      const div = document.createElement('div');
      div.className = 'historial-item';
      const fecha = new Date(c.created_at).toLocaleDateString('es-AR');
      div.innerHTML = `<strong>${c.tamaño} números</strong> — Premio: ${c.premio || '—'} — Costo: ${c.costo || '—'}<br><small>${fecha}</small>`;
      lista.appendChild(div);
    });
  }

  document.getElementById('historial-overlay').classList.add('visible');
}

function cerrarHistorial(e) {
  if (!e || e.target === document.getElementById('historial-overlay')) {
    document.getElementById('historial-overlay').classList.remove('visible');
  }
}

// ===== SORTEO =====
async function iniciarSorteo() {
  cerrarMenu();

  const { data: celdas } = await db
    .from('celdas')
    .select('*')
    .eq('carton_id', cartonActual.id);

  const ocupadas = celdas.filter(c => c.nombre && c.nombre.trim() !== '');

  if (ocupadas.length === 0) {
    alert('No hay apodos cargados para sortear.');
    return;
  }

  document.getElementById('sorteo-overlay').classList.add('visible');
  document.getElementById('sorteo-cerrar').style.display = 'none';
  document.getElementById('sorteo-nombre').textContent = '';

  let velocidad = 60;
  let ticks = 0;
  const totalTicks = 40;

  const ganador = ocupadas[Math.floor(Math.random() * ocupadas.length)];

  const intervalo = setInterval(() => {
    const random = ocupadas[Math.floor(Math.random() * ocupadas.length)];
    document.getElementById('sorteo-numero').textContent = random.numero;
    ticks++;

    if (ticks > totalTicks * 0.6) velocidad += 30;

    if (ticks >= totalTicks) {
      clearInterval(intervalo);
      document.getElementById('sorteo-numero').textContent = ganador.numero;
      document.getElementById('sorteo-nombre').textContent = ganador.nombre + ' - ' + ganador.nombre_predefinido;
      document.getElementById('sorteo-cerrar').style.display = 'inline-block';
    }
  }, velocidad);
}

function cerrarSorteo() {
  document.getElementById('sorteo-overlay').classList.remove('visible');
}

// ===== CAPTURA =====
async function capturar() {
  const elemento = document.getElementById('carton-container');
  try {
    const canvas = await html2canvas(elemento, { backgroundColor: '#f0ede6', scale: 2 });
    canvas.toBlob(async blob => {
      const file = new File([blob], 'tapadita.png', { type: 'image/png' });
      if (navigator.share) {
        await navigator.share({ files: [file], title: 'Mi Tapadita' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tapadita.png';
        a.click();
      }
    });
  } catch (err) {
    alert('No se pudo capturar. Intentá desde el celular.');
  }
}

// ===== CERRAR SESION =====
function cerrarSesion() {
  localStorage.removeItem('tapadita_celular');
  window.location.href = 'index.html';
}

// ===== TAPADITAS (una por cada premio) =====
function iniciarTapaditas() {
  const cantPremiosTap = cartonActual.premios || 1;
  for (let i = 0; i < cantPremiosTap; i++) {
    iniciarTapaditaIndex(i);
  }
}

function iniciarTapaditaIndex(i) {
  const canvas = document.getElementById(`tapadita-canvas-${i}`);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Si esta tapadita ya fue revelada antes, no la tapamos de nuevo
  if (tapaditaRevelada[i]) {
    canvas.style.pointerEvents = 'none';
    return;
  }

  const ocupadas = cartonActual.celdas ? cartonActual.celdas.filter(c => c.nombre && c.nombre.trim() !== '') : [];
  const todas = cartonActual.celdas || [];
  const pool = ocupadas.length > 0 ? ocupadas : todas;
  const ganador = pool[Math.floor(Math.random() * pool.length)];

  document.getElementById(`tapadita-numero-${i}`).textContent = ganador.numero;
  document.getElementById(`tapadita-nombre-${i}`).textContent = ganador.nombre || ganador.nombre_predefinido;

  // Dibujar sticker plateado
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#b0b0b0');
  grad.addColorStop(0.3, '#e8e8e8');
  grad.addColorStop(0.5, '#f5f5f5');
  grad.addColorStop(0.7, '#e8e8e8');
  grad.addColorStop(1, '#909090');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 10);
  ctx.fill();

  ctx.fillStyle = '#666';
  ctx.font = w < 110 ? 'bold 8px Arial' : 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🍀 RASPAR', w / 2, h / 2 - 6);
  ctx.fillText('PARA REVELAR', w / 2, h / 2 + 10);

  function hacerSonido() {
    try {
      const audioCtx = hacerSonido._ctx || (hacerSonido._ctx = new (window.AudioContext || window.webkitAudioContext)());
      const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.04, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < data.length; j++) {
        data[j] = (Math.random() * 2 - 1) * 0.25;
      }
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    } catch (e) {}
  }

  ctx.globalCompositeOperation = 'destination-out';

  // Mostrar popup de confirmación en vez de raspar directo
  canvas.addEventListener('click', () => {
    indexPendiente = i;
    document.getElementById('confirmar-overlay').classList.add('visible');
  });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    indexPendiente = i;
    document.getElementById('confirmar-overlay').classList.add('visible');
  }, { passive: false });

  // Guardar referencias para usar después de confirmar
  canvas._ctx = ctx;
  canvas._hacerSonido = hacerSonido;
}

function cerrarConfirmar() {
  document.getElementById('confirmar-overlay').classList.remove('visible');
}

async function confirmarTapadita() {
  cerrarConfirmar();
  const i = indexPendiente;
  if (i === null || i === undefined) return;

  let mediaRecorder = null;
  let chunks = [];

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: 'screen' },
      audio: false
    });

    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tapadita-sorteo.webm';
      a.click();
    };
    mediaRecorder.start();
  } catch (err) {
    console.log('Grabación no disponible:', err);
  }

  const canvas = document.getElementById(`tapadita-canvas-${i}`);
  const ctx = canvas._ctx;
  const hacerSonido = canvas._hacerSonido;
  let raspando = false;

  function raspar(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    hacerSonido();

    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    let transparentes = 0;
    for (let k = 3; k < imageData.data.length; k += 4) {
      if (imageData.data[k] === 0) transparentes++;
    }
    const progreso = transparentes / (w * h);
    if (progreso > 0.6) {
      ctx.clearRect(0, 0, w, h);
      canvas.style.pointerEvents = 'none';
      tapaditaRevelada[i] = true;
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        setTimeout(() => {
          mediaRecorder.stop();
          mediaRecorder.stream.getTracks().forEach(t => t.stop());
        }, 2000);
      }
    }
  }

  canvas.addEventListener('mousedown', () => { raspando = true; });
  canvas.addEventListener('mouseup', () => { raspando = false; });
  canvas.addEventListener('mouseleave', () => { raspando = false; });
  canvas.addEventListener('mousemove', e => {
    if (!raspando) return;
    const rect = canvas.getBoundingClientRect();
    raspar(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener('touchstart', e => { e.preventDefault(); raspando = true; }, { passive: false });
  canvas.addEventListener('touchend', () => { raspando = false; });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!raspando) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    raspar(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: false });
}

// ===== ARRANCAR =====
init();
