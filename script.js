// ===== Bubbleverse — Vanilla JS (dreamy + no-click-after-drag + collisions + soft-boundary) =====

// Simple star field
const starsCanvas = document.getElementById('stars');
const ctx = starsCanvas.getContext('2d');
let stars = [];
function resizeStars(){
  starsCanvas.width = innerWidth;
  starsCanvas.height = innerHeight;
  stars = Array.from({length: 140}, () => ({
    x: Math.random()*starsCanvas.width,
    y: Math.random()*starsCanvas.height,
    r: Math.random()*1.2 + 0.2,
    a: Math.random()*0.5 + 0.2,
    v: Math.random()*0.2 + 0.05
  }));
}
function drawStars(){
  ctx.clearRect(0,0,starsCanvas.width, starsCanvas.height);
  for(const s of stars){
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.fill();
    s.x += s.v; if(s.x > starsCanvas.width+6) s.x = -6;
  }
  requestAnimationFrame(drawStars);
}
resizeStars();
drawStars();
addEventListener('resize', resizeStars);

// Bubbles state
const stage = document.getElementById('stage');
const mainScroll = document.getElementById('main-scroll');
const addBtn = document.getElementById('addBtn');
const modal = document.getElementById('modal');
const bubbleText = document.getElementById('bubbleText');
const saveBubble = document.getElementById('saveBubble');
const cancelBubble = document.getElementById('cancelBubble');
const deleteBubble = document.getElementById('deleteBubble');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');

// Manopola globale ( <1 più lento / rilassante )
const SPEED = 0.65;

// bordo “sicuro” in px (evita attaccarsi al bordo)
const EDGE_PAD = 6;

let bubbles = [];
let editingId = null;
let bubbleMotion = [];

const uid = () => Math.random().toString(36).slice(2, 9);
function saveState(){ localStorage.setItem('bubbleverse.bubbles', JSON.stringify(bubbles)); }
function loadState(){
  const raw = localStorage.getItem('bubbleverse.bubbles');
  if(raw){
    try { bubbles = JSON.parse(raw); }
    catch{ bubbles = []; }
  }
}

// Default seed
function seedIfEmpty(){
  if(bubbles.length) return;
  const seed = [
    { text: "Follow the quiet curiosity.", x: 20,  y: 24,  z: 0,  size: 170, hue: 260 },
    { text: "Ideas drift. Catch one.",     x: 65,  y: 58,  z: -20, size: 150, hue: 190 },
    { text: "Dream > Plan > Build.",       x: 72,  y: 30,  z: -40, size: 130, hue: 220 },
    { text: "Be soft. Be bold.",           x: 38,  y: 68,  z: -10, size: 160, hue: 310 }
  ];
  bubbles = seed.map(s => ({ id: uid(), ...s }));
  saveState();
}

function percentToPxX(p){ return (p/100) * stage.clientWidth; }
function percentToPxY(p){ return (p/100) * stage.clientHeight; }

// Easing morbido (cosine ease-in-out)
function easeInOut(t){
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return (1 - Math.cos(Math.PI * t)) / 2;
}

// Nuovo target (offset in px attorno alla base)
function newTarget(m){
  const depth = m.depth; // ~0.75..1.25
  const maxX = (stage.clientWidth  * 0.18) * depth;
  const maxY = (stage.clientHeight * 0.16) * depth;
  return {
    x: (Math.random()*2 - 1) * maxX,
    y: (Math.random()*2 - 1) * maxY
  };
}

// Clamp percentuale base in modo che la bolla stia dentro anche senza offset
function clampBasePercent(b, effSize){
  const maxXPercent = Math.max(0, ((stage.clientWidth  - effSize - EDGE_PAD*2) / stage.clientWidth) * 100);
  const maxYPercent = Math.max(0, ((stage.clientHeight - effSize - EDGE_PAD*2) / stage.clientHeight) * 100);
  b.x = Math.min(maxXPercent, Math.max(0, b.x));
  b.y = Math.min(maxYPercent, Math.max(0, b.y));
}

function render(){
  stage.innerHTML = '';
  bubbleMotion = [];

  for(const b of bubbles){
    const scale = 1 + (b.z||0)/200;
    const size  = (b.size || 160);
    const effSize = size * scale;

    // clampa la posizione base per non farla nascere/finire fuori
    clampBasePercent(b, effSize);

    const el = document.createElement('div');
    el.className = 'bubble';
    el.style.setProperty('--size', `${size}px`);
    el.style.setProperty('--hue', b.hue || 220);
    el.style.left = percentToPxX(b.x) + 'px';
    el.style.top  = percentToPxY(b.y) + 'px';
    el.style.setProperty('--x', '0px');
    el.style.setProperty('--y', '0px');
    el.style.setProperty('--float', (8 + (size%6)) + 's');
    el.style.setProperty('--scale', scale);

    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = b.text;
    el.appendChild(text);

    // --- Distinzione click vs drag ---
    let dragging = false, startX=0, startY=0, initX=0, initY=0;
    let dragMoved = false;

    // Apri modal SOLO se non hai drag-gato
    el.addEventListener('click', (e) => {
      if (dragMoved) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      openModal(b.id);
    });

    el.addEventListener('pointerdown', (e) => {
      if(e.button !== 0) return;
      dragging = true; el.setPointerCapture(e.pointerId);
      dragMoved = false;
      startX = e.clientX; startY = e.clientY;
      initX = percentToPxX(b.x); initY = percentToPxY(b.y);
      el.classList.add('focused');
      const m = bubbleMotion[b.id];
      if (m) m.dragging = true;
    });

    el.addEventListener('pointermove', (e) => {
      if(!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!dragMoved && (Math.abs(dx) + Math.abs(dy) > 3)) dragMoved = true;

      // clamp in px, tenendo conto della dimensione bolla
      const maxLeft = stage.clientWidth  - effSize - EDGE_PAD;
      const maxTop  = stage.clientHeight - effSize - EDGE_PAD;
      let nx = Math.min(maxLeft, Math.max(EDGE_PAD, initX + dx));
      let ny = Math.min(maxTop , Math.max(EDGE_PAD, initY + dy));

      // aggiorna percentuali base
      b.x = (nx / stage.clientWidth) * 100;
      b.y = (ny / stage.clientHeight) * 100;

      el.style.left = percentToPxX(b.x) + 'px';
      el.style.top  = percentToPxY(b.y) + 'px';
      el.style.setProperty('--x','0px');
      el.style.setProperty('--y','0px');

      // tieni allineata la base per l'animazione successiva
      const m = bubbleMotion[b.id];
      if (m){
        m.baseX = b.x; m.baseY = b.y;
      }
    });

    el.addEventListener('pointerup', (e) => {
      if(!dragging) return;
      dragging = false; el.releasePointerCapture(e.pointerId);
      el.classList.remove('focused');
      saveState();
      const m = bubbleMotion[b.id];
      if (m){
        m.dragging = false;
        // riparti morbido da dove sei
        m.from = { x: parseFloat(el.style.getPropertyValue('--x')) || 0,
                   y: parseFloat(el.style.getPropertyValue('--y')) || 0 };
        m.to   = newTarget(m);
        m.t0   = performance.now()/1000;
        m.dur  = (6 + Math.random()*6) / SPEED; // 6–12s modulato da SPEED
      }
    });

    stage.appendChild(el);

    // Stato moto “dreamy” per questa bolla
    const depth = scale; // stesso concetto del --scale CSS
    const speedBias = (0.6 + Math.random()*0.25) * SPEED;
    bubbleMotion[b.id] = {
      el,
      baseX: b.x, baseY: b.y,    // percentuali
      dragging: false,
      depth,
      size,
      radius: size * depth * 0.5 * 0.95,
      from: {x:0, y:0},
      to:   {x:0, y:0},
      t0: performance.now()/1000,
      dur: (6 + Math.random()*6) / SPEED, // lento / rilassato
      phase: Math.random()*Math.PI*2,
      microAmp: 8 + Math.random()*14,
      microFreq: (0.12 + Math.random()*0.12) * SPEED,
      breathFreq: 0.06 + Math.random()*0.04,
      speedBias
    };
    bubbleMotion[b.id].to = newTarget(bubbleMotion[b.id]);
  }
}

// Modal
function openModal(id=null){
  editingId = id;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  if(id){
    const b = bubbles.find(x => x.id === id);
    modalTitle.textContent = 'Edit Bubble';
    bubbleText.value = b?.text || '';
    deleteBubble.hidden = false;
  }else{
    modalTitle.textContent = 'New Bubble';
    bubbleText.value = '';
    deleteBubble.hidden = true;
  }
  bubbleText.focus();
}
function closeModalFn(){
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  editingId = null;
}
closeModal.addEventListener('click', closeModalFn);
cancelBubble.addEventListener('click', closeModalFn);
modal.addEventListener('click', (e)=>{ if(e.target === modal) closeModalFn(); });

addBtn.addEventListener('click', ()=> openModal());

saveBubble.addEventListener('click', () => {
  const txt = bubbleText.value.trim() || '...';
  if(editingId){
    const b = bubbles.find(x => x.id === editingId);
    if(b){ b.text = txt; }
  }else{
    const x = 10 + Math.random()*80;
    const y = 15 + Math.random()*65;
    const size = 120 + Math.round(Math.random()*80);
    const hue = Math.round(160 + Math.random()*200);
    const z = Math.round(-50 + Math.random()*50);
    bubbles.push({ id: uid(), text: txt, x, y, z, size, hue });
  }
  saveState();
  render();
  closeModalFn();
});

deleteBubble.addEventListener('click', () => {
  if(!editingId) return;
  bubbles = bubbles.filter(b => b.id !== editingId);
  saveState();
  render();
  closeModalFn();
});

// Parallax (desktop) — salva sui dataset, somma in animazione
stage.addEventListener('mousemove', (e)=>{
  const cx = (e.clientX / stage.clientWidth - .5);
  const cy = (e.clientY / stage.clientHeight - .5);
  for(const el of stage.children){
    const depth = parseFloat(getComputedStyle(el).getPropertyValue('--scale')) || 1;
    const dx = -cx * 18 * depth;
    const dy = -cy * 10 * depth;
    el.dataset.parallaxX = dx;
    el.dataset.parallaxY = dy;
  }
});

// Pan/scroll (mobile)
if(window.matchMedia('(max-width: 768px)').matches){
  let lastTouch = null;
  mainScroll.addEventListener('touchstart', (e) => {
    if(e.touches.length === 1) lastTouch = {x: e.touches[0].clientX, y: e.touches[0].clientY, sx: mainScroll.scrollLeft, sy: mainScroll.scrollTop};
  });
  mainScroll.addEventListener('touchmove', (e) => {
    if(e.touches.length === 1 && lastTouch) {
      const dx = lastTouch.x - e.touches[0].clientX;
      const dy = lastTouch.y - e.touches[0].clientY;
      mainScroll.scrollLeft = lastTouch.sx + dx;
      mainScroll.scrollTop = lastTouch.sy + dy;
      e.preventDefault();
    }
  }, {passive:false});
  mainScroll.addEventListener('touchend', ()=>{ lastTouch = null; });
}

// Animazione “dreamy” con collisioni + soft-boundary
function animateBubbles(){
  const t = performance.now()/1000;

  // Pass 1: offset “dreamy” per ogni bolla
  const ids = [];
  const basePx = {};
  const off = {};
  const adj = {};

  for(const b of bubbles){
    const m = bubbleMotion[b.id];
    if(!m){ continue; }
    ids.push(b.id);
    adj[b.id] = {x:0, y:0};

    const baseXpx = percentToPxX(m.baseX);
    const baseYpx = percentToPxY(m.baseY);
    basePx[b.id] = { x: baseXpx, y: baseYpx };

    if(!m.dragging){
      const pRaw = (t - m.t0) / (m.dur / m.speedBias);
      const p = (pRaw <= 0) ? 0 : (pRaw >= 1 ? 1 : easeInOut(pRaw));

      const curX = m.from.x + (m.to.x - m.from.x) * p;
      const curY = m.from.y + (m.to.y - m.from.y) * p;

      const breath = 0.85 + 0.15 * Math.sin(t * m.breathFreq * 2*Math.PI + m.phase);
      const microX = Math.sin(t * 2*Math.PI * (m.microFreq*0.9) + m.phase) * (m.microAmp * 0.5);
      const microY = Math.cos(t * 2*Math.PI * (m.microFreq*1.1) + m.phase*1.3) * (m.microAmp * 0.5);

      const px = parseFloat(m.el.dataset.parallaxX || '0') * 0.9;
      const py = parseFloat(m.el.dataset.parallaxY || '0') * 0.9;

      const offX = (curX + microX) * breath + px;
      const offY = (curY + microY) * breath + py;

      off[b.id] = { x: offX, y: offY };

      if (pRaw >= 1){
        m.from = { x: curX, y: curY };
        m.to   = newTarget(m);
        m.t0   = t;
        m.dur  = (6 + Math.random()*6) / SPEED;
      }
    } else {
      off[b.id] = { x: 0, y: 0 };
    }
  }

  // Pass 2: collisioni soft (repulsione)
  const margin = 6;
  const bounceK = 0.35;

  for (let i = 0; i < ids.length; i++){
    const idA = ids[i];
    const mA = bubbleMotion[idA];
    if (!mA || mA.dragging) continue;

    const cxA = basePx[idA].x + off[idA].x + mA.size/2;
    const cyA = basePx[idA].y + off[idA].y + mA.size/2;

    for (let j = i+1; j < ids.length; j++){
      const idB = ids[j];
      const mB = bubbleMotion[idB];
      if (!mB || mB.dragging) continue;

      const cxB = basePx[idB].x + off[idB].x + mB.size/2;
      const cyB = basePx[idB].y + off[idB].y + mB.size/2;

      const dx = cxB - cxA;
      const dy = cyB - cyA;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const minDist = (mA.radius + mB.radius) + margin;

      if (dist < minDist){
        const overlap = (minDist - dist);
        const nx = dx / dist;
        const ny = dy / dist;

        const push = overlap * 0.5;
        const dampA = 1 / mA.depth;
        const dampB = 1 / mB.depth;

        adj[idA].x += -(nx * push) * dampA;
        adj[idA].y += -(ny * push) * dampA;

        adj[idB].x +=  (nx * push) * dampB;
        adj[idB].y +=  (ny * push) * dampB;

        // devia anche i target per divergere
        mA.to.x += -(nx * overlap) * bounceK;
        mA.to.y += -(ny * overlap) * bounceK;
        mB.to.x +=  (nx * overlap) * bounceK;
        mB.to.y +=  (ny * overlap) * bounceK;
      }
    }
  }

  // Pass 3: soft-boundary (non uscire dai bordi) + applica offset finale
  for (const id of ids){
    const m = bubbleMotion[id];
    if (!m) continue;

    let finalX = off[id].x + adj[id].x;
    let finalY = off[id].y + adj[id].y;

    // posizione candidata in px
    let left = basePx[id].x + finalX;
    let top  = basePx[id].y + finalY;

    const maxLeft = stage.clientWidth  - m.size - EDGE_PAD;
    const maxTop  = stage.clientHeight - m.size - EDGE_PAD;
    const minLeft = EDGE_PAD;
    const minTop  = EDGE_PAD;

    // clamp + “steer back” del target per un effetto rimbalzo morbido
    if (left < minLeft){
      const d = (minLeft - left);
      finalX += d; left += d;
      m.to.x += d * 0.5;   // spingi il prossimo target verso l’interno
    } else if (left > maxLeft){
      const d = (left - maxLeft);
      finalX -= d; left -= d;
      m.to.x -= d * 0.5;
    }

    if (top < minTop){
      const d = (minTop - top);
      finalY += d; top += d;
      m.to.y += d * 0.5;
    } else if (top > maxTop){
      const d = (top - maxTop);
      finalY -= d; top -= d;
      m.to.y -= d * 0.5;
    }

    m.el.style.setProperty('--x', `${finalX.toFixed(2)}px`);
    m.el.style.setProperty('--y', `${finalY.toFixed(2)}px`);
  }

  requestAnimationFrame(animateBubbles);
}

// Init
loadState();
seedIfEmpty();
render();
animateBubbles();
