(() => {
  const bootScreen = document.getElementById('bootScreen');
  const bootProgress = document.getElementById('bootProgress');
  const bootStatus = document.getElementById('bootStatus');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Intro de arranque visual; no ejecuta comandos del sistema.
  const bootSteps = [
    [25, 'Inicializando interfaz...'],
    [52, 'Cargando módulos visuales...'],
    [78, 'Preparando laboratorio demo...'],
    [100, 'Entorno listo. Bienvenido.']
  ];
  let bootIndex = 0;
  function advanceBoot() {
    if (bootIndex >= bootSteps.length) {
      setTimeout(() => bootScreen.classList.add('done'), reduceMotion ? 0 : 450);
      return;
    }
    const [progress, status] = bootSteps[bootIndex++];
    bootProgress.style.width = `${progress}%`;
    bootStatus.textContent = status;
    setTimeout(advanceBoot, reduceMotion ? 10 : 360);
  }
  advanceBoot();

  // Fondo Matrix decorativo, con densidad reducida en pantallas pequeñas.
  const canvas = document.getElementById('matrixCanvas');
  const ctx = canvas.getContext('2d');
  let columns = 0;
  let drops = [];
  const glyphs = '01アカサタナハマヤラワ<>/{}[]';
  let frame = 0;
  function resizeMatrix() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    columns = Math.ceil(window.innerWidth / 18);
    drops = Array.from({ length: columns }, () => Math.random() * -50);
  }
  function drawMatrix() {
    if (reduceMotion) return;
    ctx.fillStyle = 'rgba(7,10,14,0.12)';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.font = '12px monospace';
    for (let i = 0; i < drops.length; i++) {
      const char = glyphs[Math.floor(Math.random() * glyphs.length)];
      ctx.fillStyle = Math.random() > 0.94 ? '#a4ff8b' : '#36bcae';
      ctx.fillText(char, i * 18, drops[i] * 18);
      if (drops[i] * 18 > window.innerHeight && Math.random() > 0.975) drops[i] = 0;
      drops[i] += 0.45;
    }
    frame = requestAnimationFrame(drawMatrix);
  }
  resizeMatrix();
  if (!reduceMotion) drawMatrix();
  window.addEventListener('resize', resizeMatrix);

  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('mainNav');
  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    nav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
  }));

  const typedCommand = document.getElementById('typedCommand');
  const command = 'status --summary';
  if (reduceMotion) {
    typedCommand.textContent = command;
  } else {
    let charIndex = 0;
    const typeNext = () => {
      typedCommand.textContent = command.slice(0, charIndex++);
      if (charIndex <= command.length) setTimeout(typeNext, 95);
    };
    setTimeout(typeNext, 1300);
  }

  // Datos SOC simulados: no se conecta a ninguna red ni recopila telemetría real.
  const eventCount = document.getElementById('eventCount');
  const alertCount = document.getElementById('alertCount');
  const logStream = document.getElementById('logStream');
  const labels = ['-23m', '-20m', '-17m', '-14m', '-11m', '-8m', '-5m', '-2m'];
  let eventTotal = 24;
  let alertTotal = 3;
  const chartCanvas = document.getElementById('eventsChart');
  let chart = null;

  if (window.Chart && chartCanvas) {
    chart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Eventos (simulados)',
          data: [4, 7, 5, 10, 8, 12, 9, 14],
          borderColor: '#52f7e4',
          backgroundColor: 'rgba(82,247,228,.08)',
          fill: true,
          tension: .35,
          pointRadius: 2,
          pointBackgroundColor: '#a4ff8b',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          x: { grid: { color: 'rgba(130,145,158,.10)' }, ticks: { color: '#71838d', font: { family: 'IBM Plex Mono', size: 9 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(130,145,158,.10)' }, ticks: { color: '#71838d', precision: 0, font: { family: 'IBM Plex Mono', size: 9 } } }
        }
      }
    });
  }

  const logMessages = [
    ['INFO', 'Módulo de documentación listo', 'green'],
    ['INFO', 'Verificación local completada', 'green'],
    ['WARN', 'Alerta de prueba generada', 'orange'],
    ['INFO', 'Entorno educativo activo', 'green'],
    ['INFO', 'Panel de demostración actualizado', 'green']
  ];
  function addLog() {
    const [level, message, color] = logMessages[Math.floor(Math.random() * logMessages.length)];
    const now = new Date().toLocaleTimeString('es-ES', { hour12: false });
    const p = document.createElement('p');
    const time = document.createElement('time');
    time.textContent = now;
    const span = document.createElement('span');
    span.className = color;
    span.textContent = level;
    p.append(time, span, document.createTextNode(` ${message}`));
    logStream.prepend(p);
    while (logStream.children.length > 4) logStream.lastElementChild.remove();
    eventTotal += 1;
    eventCount.textContent = String(eventTotal).padStart(3, '0');
    if (level === 'WARN') {
      alertTotal += 1;
      alertCount.textContent = String(alertTotal).padStart(3, '0');
    }
    if (chart) {
      chart.data.labels.push(now.slice(0, 5));
      chart.data.datasets[0].data.push(Math.floor(Math.random() * 14) + 2);
      if (chart.data.labels.length > 8) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      chart.update('none');
    }
  }
  let logTimer;
  if (!reduceMotion) logTimer = setInterval(addLog, 4200);

  // Formulario de demostración. No finge haber enviado datos a un servidor.
  const form = document.getElementById('infoForm');
  const formMessage = document.getElementById('formMessage');
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const name = document.getElementById('nombre').value.trim();
    formMessage.textContent = `Demo completada, ${name}. No se han enviado ni almacenado datos.`;
    formMessage.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    alert(`[RETR0SEC // DEMO]\n\nInformación Solicitada\n\nEsta es una confirmación local. Para recibir solicitudes reales, configura un backend.`);
  });

  window.addEventListener('pagehide', () => {
    if (frame) cancelAnimationFrame(frame);
    if (logTimer) clearInterval(logTimer);
  });
})();
