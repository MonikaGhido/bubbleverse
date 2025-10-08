// ===== Bubbleverse — dreamy wander (solid collisions + stable clock) =====

// ---------- Stars with twinkle (stable clock) ----------
const starsCanvas = document.getElementById('stars');
const sctx = starsCanvas.getContext('2d');
let stars = [];
let lastStar = performance.now();
let starSim = 0;
function resizeStars(){
  starsCanvas.width = innerWidth;
  starsCanvas.height = innerHeight;
  stars = Array.from({length: 160}, () => ({
    x: Math.random()*starsCanvas.width,
    y: Math.random()*starsCanvas.height,
    r: Math.random()*1.25 + 0.25,
    a: Math.random()*0.45 + 0.25,
    v: Math.random()*0.20 + 0.05,
    ph: Math.random()*Math.PI*2,
    tf: 0.04 + Math.random()*0.06
  }));
}
function drawStars(){
  const now = performance.now();
  let dt = (now - lastStar)/1000;
  lastStar = now;
  dt = Math.min(dt, 1/30); // clamp
  starSim += dt;

  sctx.clearRect(0,0,starsCanvas.width, starsCanvas.height);
  for(const s of stars){
    const twAlpha = s.a * (0.72 + 0.28*Math.sin(starSim*s.tf*2*Math.PI + s.ph));
    sctx.beginPath(); sctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    sctx.fillStyle = `rgba(255,255,255,${twAlpha})`; sctx.fill();
    s.x += s.v; if(s.x > starsCanvas.width+6) s.x = -6;
  }
  requestAnimationFrame(drawStars);
}
resizeStars(); drawStars();
addEventListener('resize', resizeStars);

// ---------- DOM refs ----------
const stage = document.getElementById('stage');
const mainScroll = document.getElementById('main-scroll');

const modal = document.getElementById('modal');
const bubbleText = document.getElementById('bubbleText');
const saveBubble = document.getElementById('saveBubble');
const cancelBubble = document.getElementById('cancelBubble');
const deleteBubble = document.getElementById('deleteBubble');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');

const hero = document.getElementById('hero');
const orbits = hero.querySelector('.orbits');

const composer = document.getElementById('composer');
const compPanel = composer.querySelector('.composer-panel');
const composerText = document.getElementById('composerText');
const composerSave = document.getElementById('composerSave');
const composerCancel = document.getElementById('composerCancel');
const composerClose = document.getElementById('composerClose');

// ---------- Config ----------
const SPEED = 0.7;             // <1 = più rilassato
const EDGE_PAD = 8;
const ADD_ID = '__addBubble__';

// collisioni “rigide”
const COLL_ITER_BASE = 12;
const COLL_EPS       = 3;      // margine visivo (include alone)
const COLL_OVERSHOOT = 0.18;

// finder
const GOLDEN_ANGLE   = Math.PI * (3 - Math.sqrt(5));

const clamp = (v,min,max)=>Math.min(max,Math.max(min,v));

// ---------- State ----------
let bubbles = [];
let editingId = null;
let bubbleMotion = []; // id -> motion state

// clock simulato per evitare “turbo” quando torni alla tab
let lastRAF = performance.now();
let simTime = 0;

// keep-out del titolo
let heroRect = {left:0, top:0, right:0, bottom:0, pad: 16};
function updateHeroRect(){
  if(!hero) return;
  const r = hero.getBoundingClientRect();
  heroRect.left = r.left; heroRect.top = r.top;
  heroRect.right = r.right; heroRect.bottom = r.bottom;

  // Centro reale delle orbite (sul blocco hero)
  const cx = r.width/2, cy = r.height/2;
  orbits.style.setProperty('--cx', `${cx}px`);
  orbits.style.setProperty('--cy', `${cy}px`);
}
window.addEventListener('load', updateHeroRect);
window.addEventListener('resize', updateHeroRect);

// ---------- Storage ----------
const uid = () => Math.random().toString(36).slice(2, 9);
function saveState(){
  const toSave = bubbles.filter(b => b.id !== ADD_ID);
  localStorage.setItem('bubbleverse.bubbles', JSON.stringify(toSave));
}
function loadState(){
  const raw = localStorage.getItem('bubbleverse.bubbles');
  if(raw){ try { bubbles = JSON.parse(raw); } catch{ bubbles = []; } }
}
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
function ensureAddBubble(){
  const exists = bubbles.some(b => b.id === ADD_ID);
  if(!exists){
    const x = 75 + Math.random()*20;
    const y = 18 + Math.random()*10;
    const size = 120, hue = 205, z = 0;
    bubbles.push({ id: ADD_ID, isAdd:true, text:"+", x, y, z, size, hue });
  }
}

// ---------- Helpers ----------
function percentToPxX(p){ return (p/100) * stage.clientWidth; }
function percentToPxY(p){ return (p/100) * stage.clientHeight; }
function easeInOut(t){ if(t<0) t=0; else if(t>1) t=1; return (1 - Math.cos(Math.PI*t))/2; }
function newTarget(m){
  const depth=m.depth;
  const maxX=(stage.clientWidth*0.18)*depth;
  const maxY=(stage.clientHeight*0.16)*depth;
  return { x:(Math.random()*2-1)*maxX, y:(Math.random()*2-1)*maxY };
}
function clampBasePercent(b, effSize){
  const maxXPercent = Math.max(0, ((stage.clientWidth  - effSize - EDGE_PAD*2) / stage.clientWidth) * 100);
  const maxYPercent = Math.max(0, ((stage.clientHeight - effSize - EDGE_PAD*2) / stage.clientHeight) * 100);
  b.x = Math.min(maxXPercent, Math.max(0, b.x));
  b.y = Math.min(maxYPercent, Math.max(0, b.y));
}

// snapshot per finder
function snapshotBubbles() {
  const snap = [];
  for (const id in bubbleMotion) {
    const m = bubbleMotion[id];
    if (!m) continue;
    const ox = parseFloat(m.el.style.getPropertyValue('--x') || '0');
    const oy = parseFloat(m.el.style.getPropertyValue('--y') || '0');
    const cx = percentToPxX(m.baseX) + ox + m.size/2;
    const cy = percentToPxY(m.baseY) + oy + m.size/2;
    snap.push({ cx, cy, r: m.radius });
  }
  return snap;
}
function distPointRect(px, py, r) {
  const pad = heroRect.pad;
  const left   = (heroRect.left   - pad);
  const right  = (heroRect.right  + pad);
  const top    = (heroRect.top    - pad);
  const bottom = (heroRect.bottom + pad);
  const nx = Math.max(left, Math.min(px, right));
  const ny = Math.max(top , Math.min(py, bottom));
  const dx = px - nx, dy = py - ny;
  return Math.hypot(dx, dy) - r; // >0 => fuori
}
function findFreeSlotNear({ preferXPercent = 50, preferYPercent = 50, size, z = 0 }) {
  const scale = 1 + (z || 0) / 200;
  const rNew  = size * scale * 0.5 + 12;
  const snap  = snapshotBubbles();

  const w = stage.clientWidth, h = stage.clientHeight;

  let startLeft = percentToPxX(preferXPercent);
  let startTop  = percentToPxY(preferYPercent);
  startLeft = Math.min(w - size - EDGE_PAD, Math.max(EDGE_PAD, startLeft));
  startTop  = Math.min(h - size - EDGE_PAD, Math.max(EDGE_PAD, startTop));
  const startCx = startLeft + size/2, startCy = startTop + size/2;

  const step = Math.max(18, size * 0.28);
  const MAX  = 180;

  for (let i = 0; i < MAX; i++) {
    const r   = step * Math.sqrt(i);
    const ang = i * GOLDEN_ANGLE;

    let cx = startCx + r * Math.cos(ang);
    let cy = startCy + r * Math.sin(ang);

    cx = Math.min(w - EDGE_PAD - size/2, Math.max(EDGE_PAD + size/2, cx));
    cy = Math.min(h - EDGE_PAD - size/2, Math.max(EDGE_PAD + size/2, cy));

    if (distPointRect(cx, cy, rNew) < 1.0) continue;

    let ok = true;
    for (const b of snap) {
      const minDist = (rNew + b.r + COLL_EPS);
      if (Math.hypot(cx - b.cx, cy - b.cy) < minDist) { ok = false; break; }
    }
    if (!ok) continue;

    const left = cx - size/2;
    const top  = cy - size/2;
    return { x: (left / w) * 100, y: (top / h) * 100 };
  }
  return { x: ((startCx - size/2) / w) * 100, y: ((startCy - size/2) / h) * 100 };
}

// ---------- Render ----------
function render(){
  stage.innerHTML = '';
  bubbleMotion = [];
  ensureAddBubble();

  for(const b of bubbles){
    const scale = 1 + (b.z||0)/200;
    const size  = (b.size || 160);
    const effSize = size * scale;
    clampBasePercent(b, effSize);

    const el = document.createElement('div');
    el.className = 'bubble' + (b.isAdd ? ' add' : '');
    el.style.setProperty('--size', `${size}px`);
    el.style.setProperty('--hue', b.hue || 220);
    el.style.left = percentToPxX(b.x) + 'px';
    el.style.top  = percentToPxY(b.y) + 'px';
    el.style.setProperty('--x','0px'); el.style.setProperty('--y','0px');
    el.style.setProperty('--float', (8 + (size%6)) + 's');
    el.style.setProperty('--scale', scale);

    const text = document.createElement('div');
    text.className = 'text'; text.textContent = b.isAdd ? '+' : b.text;
    el.appendChild(text);

    // click vs drag
    let dragging=false, startX=0, startY=0, initX=0, initY=0, dragMoved=false;

    el.addEventListener('click', (e) => {
      if (dragMoved) { e.preventDefault(); e.stopPropagation(); return; }
      e.stopPropagation();
      if (b.isAdd) openComposerFor(b.id);
      else openModal(b.id);
    });

    el.addEventListener('pointerdown', (e) => {
      if(e.button !== 0) return;
      dragging = true; el.setPointerCapture(e.pointerId);
      dragMoved = false;
      startX = e.clientX; startY = e.clientY;
      initX = percentToPxX(b.x); initY = percentToPxY(b.y);
      el.classList.add('focused');
      const m = bubbleMotion[b.id]; if (m) m.dragging = true;
    });

    el.addEventListener('pointermove', (e) => {
      if(!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragMoved && (Math.abs(dx) + Math.abs(dy) > 3)) dragMoved = true;

      const maxLeft = stage.clientWidth  - effSize - EDGE_PAD;
      const maxTop  = stage.clientHeight - effSize - EDGE_PAD;
      let nx = Math.min(maxLeft, Math.max(EDGE_PAD, initX + dx));
      let ny = Math.min(maxTop , Math.max(EDGE_PAD, initY + dy));

      b.x = (nx / stage.clientWidth) * 100;
      b.y = (ny / stage.clientHeight) * 100;

      el.style.left = percentToPxX(b.x) + 'px';
      el.style.top  = percentToPxY(b.y) + 'px';
      el.style.setProperty('--x','0px'); el.style.setProperty('--y','0px');

      const m = bubbleMotion[b.id]; if (m){ m.baseX = b.x; m.baseY = b.y; }
    });

    el.addEventListener('pointerup', (e) => {
      if(!dragging) return;
      dragging = false; el.releasePointerCapture(e.pointerId);
      el.classList.remove('focused');
      if(!b.isAdd) saveState();
      const m = bubbleMotion[b.id];
      if (m){
        m.dragging = false;
        m.from = { x: parseFloat(el.style.getPropertyValue('--x')) || 0,
                   y: parseFloat(el.style.getPropertyValue('--y')) || 0 };
        m.to   = newTarget(m);
        m.t0   = simTime; // usa clock simulato
        m.dur  = (6 + Math.random()*6) / SPEED;
      }
    });

    stage.appendChild(el);

    // stato moto
    const depth = scale;
    const speedBias = (0.6 + Math.random()*0.25) * SPEED;
    bubbleMotion[b.id]={
      el, baseX:b.x, baseY:b.y, dragging:false, depth,
      size, radius: size*depth*0.5 + 12,
      from:{x:0,y:0}, to:{x:0,y:0},
      t0: simTime, dur:(6 + Math.random()*6)/SPEED,
      phase: Math.random()*Math.PI*2,
      microAmp: 8 + Math.random()*14,
      microFreq: (0.12 + Math.random()*0.12) * SPEED,
      breathFreq: 0.06 + Math.random()*0.04,
      speedBias
    };
    bubbleMotion[b.id].to = newTarget(bubbleMotion[b.id]);
  }
  updateHeroRect();
}

// ---------- Composer (modale) ----------
let composerAnchor = null;
function openComposerFor(anchorId){
  composerAnchor = anchorId;
  composer.classList.add('show');
  composer.setAttribute('aria-hidden','false');
  composerText.value = '';
  composerText.focus();
}
function closeComposer(){
  composer.classList.remove('show');
  composer.setAttribute('aria-hidden','true');
  composerAnchor = null;
}
composerCancel.addEventListener('click', closeComposer);
composerClose.addEventListener('click', closeComposer);
composer.addEventListener('click', (e)=>{ if(e.target === composer) closeComposer(); });

composerSave.addEventListener('click', () => {
  const txt = composerText.value.trim();
  if(!txt){ closeComposer(); return; }

  const addM = bubbleMotion[composerAnchor];
  let baseX = addM ? addM.baseX : 50;
  let baseY = addM ? addM.baseY : 50;

  const size = 120 + Math.round(Math.random()*80);
  const hue  = Math.round(160 + Math.random()*200);
  const z    = Math.round(-50 + Math.random()*50);

  const spot = findFreeSlotNear({
    preferXPercent: baseX, preferYPercent: baseY, size, z
  });
  bubbles.push({ id: uid(), text: txt, x: spot.x, y: spot.y, z, size, hue });
  saveState(); render(); closeComposer();
});

// ---------- Edit modal ----------
function openModal(id=null){
  editingId = id;
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
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
function closeModalFn(){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); editingId = null; }
closeModal.addEventListener('click', closeModalFn);
cancelBubble.addEventListener('click', closeModalFn);
modal.addEventListener('click', (e)=>{ if(e.target === modal) closeModalFn(); });

saveBubble.addEventListener('click', () => {
  const txt = bubbleText.value.trim() || '...';
  if(editingId){
    const b = bubbles.find(x => x.id === editingId);
    if(b){ b.text = txt; saveState(); }
  }else{
    const size = 120 + Math.round(Math.random()*80);
    const hue = Math.round(160 + Math.random()*200);
    const z = Math.round(-50 + Math.random()*50);
    const spot = findFreeSlotNear({
      preferXPercent: 10 + Math.random()*80,
      preferYPercent: 15 + Math.random()*65,
      size, z
    });
    bubbles.push({ id: uid(), text: txt, x: spot.x, y: spot.y, z, size, hue });
    saveState();
  }
  render(); closeModalFn();
});
deleteBubble.addEventListener('click', () => {
  if(!editingId) return;
  bubbles = bubbles.filter(b => b.id !== editingId);
  saveState(); render(); closeModalFn();
});

// ---------- Parallax desktop ----------
stage.addEventListener('mousemove', (e)=>{
  const cx = (e.clientX / stage.clientWidth - .5);
  const cy = (e.clientY / stage.clientHeight - .5);
  for(const el of stage.children){
    const depth = parseFloat(getComputedStyle(el).getPropertyValue('--scale')) || 1;
    const dx = -cx * 18 * depth;
    const dy = -cy * 10 * depth;
    el.dataset.parallaxX = dx; el.dataset.parallaxY = dy;
  }
});

// ---------- Mobile pan ----------
if(window.matchMedia('(max-width: 768px)').matches){
  let lastTouch=null;
  mainScroll.addEventListener('touchstart',(e)=>{ if(e.touches.length===1) lastTouch={x:e.touches[0].clientX,y:e.touches[0].clientY,sx:mainScroll.scrollLeft,sy:mainScroll.scrollTop};});
  mainScroll.addEventListener('touchmove',(e)=>{ if(e.touches.length===1&&lastTouch){ const dx=lastTouch.x-e.touches[0].clientX; const dy=lastTouch.y-e.touches[0].clientY; mainScroll.scrollLeft=lastTouch.sx+dx; mainScroll.scrollTop=lastTouch.sy+dy; e.preventDefault();}}, {passive:false});
  mainScroll.addEventListener('touchend',()=>{ lastTouch=null; });
}

// ---------- Animation loop (rigid collisions + keepout + stable clock) ----------
function animateBubbles(){
  const now = performance.now();
  let dt = (now - lastRAF)/1000;
  lastRAF = now;
  dt = Math.min(dt, 1/30); // 33ms max step (no turbo)
  simTime += dt;

  const ids=[], basePx={}, off={}, adj={}, mass={};
  for(const b of bubbles){
    const m=bubbleMotion[b.id];
    if(!m) continue;
    ids.push(b.id); adj[b.id]={x:0,y:0}; mass[b.id]=Math.max(1,m.radius*m.radius);
    basePx[b.id]={x:percentToPxX(m.baseX), y:percentToPxY(m.baseY)};

    if(!m.dragging){
      const pRaw=(simTime - m.t0) / (m.dur / m.speedBias);
      const p = (pRaw <= 0) ? 0 : (pRaw >= 1 ? 1 : easeInOut(pRaw));
      const curX=m.from.x+(m.to.x-m.from.x)*p;
      const curY=m.from.y+(m.to.y-m.from.y)*p;

      const breath=0.85+0.15*Math.sin(simTime*m.breathFreq*2*Math.PI+m.phase);
      const microX=Math.sin(simTime*2*Math.PI*(m.microFreq*0.9)+m.phase)*(m.microAmp*0.5);
      const microY=Math.cos(simTime*2*Math.PI*(m.microFreq*1.1)+m.phase*1.3)*(m.microAmp*0.5);

      const px=parseFloat(m.el.dataset.parallaxX||'0')*0.9;
      const py=parseFloat(m.el.dataset.parallaxY||'0')*0.9;

      off[b.id]={x:(curX+microX)*breath+px, y:(curY+microY)*breath+py};

      if(pRaw>=1){ m.from={x:curX,y:curY}; m.to=newTarget(m); m.t0=simTime; m.dur=(6+Math.random()*6)/SPEED; }
    } else { off[b.id]={x:0,y:0}; }
  }

  // Collisions “rigide”
  const ITER = Math.max(COLL_ITER_BASE, Math.ceil(ids.length/2));
  for (let k=0;k<ITER;k++){
    for (let i=0;i<ids.length;i++){
      const idA=ids[i], mA=bubbleMotion[idA]; if(!mA) continue;
      const ax=basePx[idA].x+off[idA].x+adj[idA].x+mA.size/2;
      const ay=basePx[idA].y+off[idA].y+adj[idA].y+mA.size/2;

      for (let j=i+1;j<ids.length;j++){
        const idB=ids[j], mB=bubbleMotion[idB]; if(!mB) continue;

        const bx=basePx[idB].x+off[idB].x+adj[idB].x+mB.size/2;
        const by=basePx[idB].y+off[idB].y+adj[idB].y+mB.size/2;

        let dx=bx-ax, dy=by-ay;
        let dist=Math.hypot(dx,dy)||0.0001;
        const minDist=(mA.radius+mB.radius)+COLL_EPS;

        if(dist<minDist){
          const overlap=(minDist-dist)*(1+COLL_OVERSHOOT);
          const nx=dx/dist, ny=dy/dist;

          let wA, wB;
          if (mA.dragging && !mB.dragging){ wA = 0; wB = 1; }
          else if (mB.dragging && !mA.dragging){ wA = 1; wB = 0; }
          else {
            const invA=1/mass[idA], invB=1/mass[idB];
            const sum=invA+invB; wA=invA/sum; wB=invB/sum;
          }

          adj[idA].x += -nx * overlap * wA; adj[idA].y += -ny * overlap * wA;
          adj[idB].x +=  nx * overlap * wB; adj[idB].y +=  ny * overlap * wB;

          const bounceK=0.22;
          mA.to.x += -nx*overlap*bounceK; mA.to.y += -ny*overlap*bounceK;
          mB.to.x +=  nx*overlap*bounceK; mB.to.y +=  ny*overlap*bounceK;
        }
      }
    }
  }

  // Keep-out titolo
  updateHeroRect();
  const pad = heroRect.pad;
  for(const id of ids){
    const m=bubbleMotion[id]; if(!m || m.dragging) continue;
    const cx=basePx[id].x+off[id].x+adj[id].x+m.size/2;
    const cy=basePx[id].y+off[id].y+adj[id].y+m.size/2;
    const left=heroRect.left-pad, right=heroRect.right+pad, top=heroRect.top-pad, bottom=heroRect.bottom+pad;

    const nx=Math.max(left, Math.min(cx, right));
    const ny=Math.max(top,  Math.min(cy, bottom));
    const dx=cx-nx, dy=cy-ny, dist=Math.hypot(dx,dy);
    const minDist=m.radius+1.0;
    if(dist<minDist){
      const overlap=(minDist-(dist||0.0001))*(1+COLL_OVERSHOOT*0.6);
      const kx=dist?dx/dist:0, ky=dist?dy/dist:-1;
      adj[id].x+=kx*overlap; adj[id].y+=ky*overlap;
      m.to.x+=kx*overlap*0.35; m.to.y+=ky*overlap*0.35;
    }
  }

  // Soft boundary + apply
  for(const id of ids){
    const m=bubbleMotion[id]; if(!m) continue;
    let finalX=off[id].x+adj[id].x, finalY=off[id].y+adj[id].y;
    let left=percentToPxX(m.baseX)+finalX, top=percentToPxY(m.baseY)+finalY;

    const maxLeft=stage.clientWidth-m.size-EDGE_PAD, maxTop=stage.clientHeight-m.size-EDGE_PAD;
    const minLeft=EDGE_PAD, minTop=EDGE_PAD;

    if(left<minLeft){ const d=(minLeft-left); finalX+=d; m.to.x+=d*0.5; }
    else if(left>maxLeft){ const d=(left-maxLeft); finalX-=d; m.to.x-=d*0.5; }
    if(top<minTop){ const d=(minTop-top); finalY+=d; m.to.y+=d*0.5; }
    else if(top>maxTop){ const d=(top-maxTop); finalY-=d; m.to.y-=d*0.5; }

    m.el.style.setProperty('--x', `${finalX.toFixed(2)}px`);
    m.el.style.setProperty('--y', `${finalY.toFixed(2)}px`);
  }

  requestAnimationFrame(animateBubbles);
}

// ---------- Init ----------
loadState();
seedIfEmpty();
ensureAddBubble();
render();
animateBubbles();
