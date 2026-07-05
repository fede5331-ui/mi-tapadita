let celular = localStorage.getItem('tapadita_celular');
let cartonActual = null;
let modoEditar = false;
let paginaActual = 0;

// Si no hay sesión, volver al login
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

// ===== CREAR CARTON =====
async function crearCarton(tamaño) {
  cerrarNuevo();

  // Marcar cartón anterior como historial
  if (cartonActual) {
    await db.from('cartones').update({ estado: 'historial' }).eq('id', cartonActual.id);
  }

  const { data, error } = await db
    .from('cartones')
    .insert({ celular, tamaño, premio: '', costo: '', estado: 'activo' })
    .select()
    .single();

  if (error) { alert('Error al crear el cartón.'); return; }

  // Crear celdas vacías
  const celdas = [];
  for (let i = 1; i <= tamaño; i++) {
    celdas.push({ carton_id: data.id, numero: i, nombre: '' });
  }
  await db.from('celdas').insert(celdas);

  cartonActual = data;
  cartonActual.celdas = celdas;
  paginaActual = 0;
  renderizarCarton();
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

  // Info del cartón
  const info = document.createElement('div');
  info.className = 'carton-info';
  info.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div style="flex:1">
        <div class="info-fila">
          <span class="etiqueta">Premio:</span>
          <input class="info-input" id="input-premio" value="${cartonActual.premio || ''}" placeholder="—" ${modoEditar ? '' : 'readonly'}>
        </div>
        <div class="info-fila" style="margin-top:6px">
          <span class="etiqueta">Costo:</span>
          <input class="info-input" id="input-costo" value="${cartonActual.costo || ''}" placeholder="—" ${modoEditar ? '' : 'readonly'}>
        </div>
      </div>
      <div class="carton-titulo">
        CARTON CON<br><span>${tamaño}</span>NOMBRES<br>1 PREMIO
      </div>
    </div>
  `;
  container.appendChild(info);

  // Paginación si hay más de 25
  if (paginas > 1) {
    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex; gap:8px; margin-bottom:10px; justify-content:center;';
    for (let p = 0; p < paginas; p++) {
      const btn = document.createElement('button');
      btn.textContent = `${p * 25 + 1}–${(p + 1) * 25}`;
      btn.style.cssText = `padding:6px 14px; border-radius:20px; border:2px solid #1a5fa8; background:${p === paginaActual ? '#1a5fa8' : 'white'}; color:${p === paginaActual ? 'white' : '#1a5fa8'}; cursor:pointer; font-size:13px;`;
      btn.onclick = () => { paginaActual = p; renderizarCarton(); };
      nav.appendChild(btn);
    }
    container.appendChild(nav);
  }

  // Grilla
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

    const input = document.createElement('textarea');
    input.className = 'celda-nombre' + (modoEditar ? ' editable' : '');
    input.value = celda.nombre || '';
    input.placeholder = modoEditar ? 'Nombre' : '';
    input.rows = 2;
    input.readOnly = !modoEditar;

    input.addEventListener('change', () => guardarCelda(celda.id, input.value));

    div.appendChild(numero);
    div.appendChild(input);
    grilla.appendChild(div);
  });

  container.appendChild(grilla);

  // Eventos para premio y costo
  if (modoEditar) {
    document.getElementById('input-premio').addEventListener('change', guardarInfo);
    document.getElementById('input-costo').addEventListener('change', guardarInfo);
    document.getElementById('input-premio').classList.add('editable');
    document.getElementById('input-costo').classList.add('editable');
  }
}

// ===== GUARDAR CELDA =====
async function guardarCelda(id, nombre) {
  await db.from('celdas').update({ nombre }).eq('id', id);
}

// ===== GUARDAR INFO =====
async function guardarInfo() {
  const premio = document.getElementById('input-premio').value;
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

  const ocupadas = cartonActual.celdas.filter(c => c.nombre && c.nombre.trim() !== '');
  if (ocupadas.length === 0) {
    alert('No hay nombres cargados para sortear.');
    return;
  }

  document.getElementById('sorteo-overlay').classList.add('visible');
  document.getElementById('sorteo-cerrar').style.display = 'none';
  document.getElementById('sorteo-nombre').textContent = '';

  let i = 0;
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
      document.getElementById('sorteo-nombre').textContent = ganador.nombre;
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

// ===== ARRANCAR =====
init();