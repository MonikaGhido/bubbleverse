// ===== Bubbleverse — Add bubble vagante + composer custom + collisions =====

// ---- Stars with twinkle -------------------------------------------------------
const starsCanvas = document.getElementById('stars');
const ctx = starsCanvas.getContext('2d');
let stars = [];
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
  ctx.clearRect(0,0,starsCanvas.width, starsCanvas.height);
  const t = performance.now()/1000;
  for(const s of stars){
    const twAlpha = s.a * (0.72 + 0.28*Math.sin(t*s.tf*2*Math.PI + s.ph));
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,255,255,${twAlpha})`; ctx.fill();
    s.x += s.v; if(s.x > starsCanvas.width+6) s.x = -6;
  }
  requestAnimationFrame(drawStars);
}
resizeStars(); drawStars();
addEventListener('resize', resizeStars);

// ---- DOM refs --------------------------------------------------------------
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

// Composer refs
const composer = document.getElementById('composer');
const compPanel = composer.querySelector('.composer-panel');
const composerText = document.getElementById('composerText');
const composerSave = document.getElementById('composerSave');
const composerCancel = document.getElementById('composerCancel');
const composerClose = document.getElementById('composerClose');

// keep-out area del titolo
let heroRect = {left:0, top:0, right:0, bottom:0, pad: 28};
function updateHeroRect(){
  if(!hero) return;
  const r = hero.getBoundingClientRect();
  heroRect.left = r.left; heroRect.top = r.top;
  heroRect.right = r.right; heroRect.bottom = r.bottom;
}
addEventListener('resize', updateHeroRect);

// ---- Config motion / physics ----------------------------------------------
const SPEED = 0.7;   // <1 = più lento
const EDGE_PAD = 8;  // distanza dai bordi
const ADD_ID = '__addBubble__';

let bubbles = [];
let editingId = null;
let bubbleMotion = [];

const uid = () => Math.random().toString(36).slice(2, 9);
function saveState(){
  // NON salvare la bolla “+”
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
    // spawn in alto a destra
    const x = 75 + Math.random()*20;
    const y = 18 + Math.random()*10;
    const size = 120;
    const hue = 205; const z = 0;
    bubbles.push({ id: ADD_ID, isAdd:true, text:"+", x, y, z, size, hue });
  }
}

function percentToPxX(p){ return (p/100) * stage.clientWidth; }
function percentToPxY(p){ return (p/100) * stage.clientHeight; }
function easeInOut(t){ if (t<0) t=0; else if (t>1) t=1; return (1 - Math.cos(Math.PI*t))/2; }

function newTarget(m){
  const depth = m.depth;
  const maxX = (stage.clientWidth  * 0.18) * depth;
  const maxY = (stage.clientHeight * 0.16) * depth;
  return { x: (Math.random()*2 - 1) * maxX, y: (Math.random()*2 - 1) * maxY };
}
function clampBasePercent(b, effSize){
  const maxXPercent = Math.max(0, ((stage.clientWidth  - effSize - EDGE_PAD*2) / stage.clientWidth) * 100);
  const maxYPercent = Math.max(0, ((stage.clientHeight - effSize - EDGE_PAD*2) / stage.clientHeight) * 100);
  b.x = Math.min(maxXPercent, Math.max(0, b.x));
  b.y = Math.min(maxYPercent, Math.max(0, b.y));
}

// ---- Render -----------------------------------------------------------------
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

    // --- Click vs Drag ---
    let dragging=false, startX=0, startY=0, initX=0, initY=0, dragMoved=false;

    el.addEventListener('click', (e) => {
      if (dragMoved) { e.preventDefault(); e.stopPropagation(); return; }
      e.stopPropagation();
      if (b.isAdd){
        openComposerFor(b.id);
      } else {
        openModal(b.id);
      }
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
      if(!b.isAdd) saveState(); // non serve salvare la “+”
      const m = bubbleMotion[b.id];
      if (m){
        m.dragging = false;
        m.from = { x: parseFloat(el.style.getPropertyValue('--x')) || 0,
                   y: parseFloat(el.style.getPropertyValue('--y')) || 0 };
        m.to   = newTarget(m);
        m.t0   = performance.now()/1000;
        m.dur  = (6 + Math.random()*6) / SPEED;
      }
    });

    stage.appendChild(el);

    // stato di moto
    const depth = scale;
    const speedBias = (0.6 + Math.random()*0.25) * SPEED;
    bubbleMotion[b.id]={
      el, baseX:b.x, baseY:b.y, dragging:false, depth,
      size, radius: size*depth*0.5, from:{x:0,y:0}, to:{x:0,y:0},
      t0: performance.now()/1000, dur:(6 + Math.random()*6)/SPEED,
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

// ---- Composer (custom prompt) ----------------------------------------------
let composerAnchor = null;
function openComposerFor(anchorId){
  composerAnchor = anchorId;
  const m = bubbleMotion[anchorId];
  if(!m) return;
  const r = m.el.getBoundingClientRect();
  compPanel.style.left = (r.left + r.width/2) + 'px';
  compPanel.style.top  = (r.top) + 'px';
  composer.classList.add('show'); composer.setAttribute('aria-hidden','false');
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
// chiudi cliccando fuori
composer.addEventListener('click', (e)=>{ if(e.target === composer) closeComposer(); });

composerSave.addEventListener('click', () => {
  const txt = composerText.value.trim();
  if(!txt){ closeComposer(); return; }
  // crea nuova bolla vicino alla bolla “+”
  const addM = bubbleMotion[composerAnchor];
  let baseX = addM ? addM.baseX : 50;
  let baseY = addM ? addM.baseY : 50;
  const jitter = () => (Math.random()*8 - 4); // ±4%
  const x = Math.min(96, Math.max(2, baseX + jitter()));
  const y = Math.min(96, Math.max(2, baseY + jitter()));
  const size = 120 + Math.round(Math.random()*80);
  const hue  = Math.round(160 + Math.random()*200);
  const z    = Math.round(-50 + Math.random()*50);
  bubbles.push({ id: uid(), text: txt, x, y, z, size, hue });
  saveState();
  render();
  closeComposer();
});

// ---- Edit modal -------------------------------------------------------------
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
    const x = 10 + Math.random()*80;
    const y = 15 + Math.random()*65;
    const size = 120 + Math.round(Math.random()*80);
    const hue = Math.round(160 + Math.random()*200);
    const z = Math.round(-50 + Math.random()*50);
    bubbles.push({ id: uid(), text: txt, x, y, z, size, hue });
    saveState();
  }
  render(); closeModalFn();
});
deleteBubble.addEventListener('click', () => {
  if(!editingId) return;
  bubbles = bubbles.filter(b => b.id !== editingId);
  saveState(); render(); closeModalFn();
});

// ---- Parallax desktop ----
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

// ---- Mobile pan/scroll ----
if(window.matchMedia('(max-width: 768px)').matches){
  let lastTouch=null;
  mainScroll.addEventListener('touchstart',(e)=>{ if(e.touches.length===1) lastTouch={x:e.touches[0].clientX,y:e.touches[0].clientY,sx:mainScroll.scrollLeft,sy:mainScroll.scrollTop};});
  mainScroll.addEventListener('touchmove',(e)=>{ if(e.touches.length===1&&lastTouch){ const dx=lastTouch.x-e.touches[0].clientX; const dy=lastTouch.y-e.touches[0].clientY; mainScroll.scrollLeft=lastTouch.sx+dx; mainScroll.scrollTop=lastTouch.sy+dy; e.preventDefault();}}, {passive:false});
  mainScroll.addEventListener('touchend',()=>{ lastTouch=null; });
}

// ---- Animazione con collisioni rigide + keepout hero + soft boundary -------
function animateBubbles(){
  const t = performance.now()/1000;

  const ids=[], basePx={}, off={}, adj={};
  for(const b of bubbles){
    const m=bubbleMotion[b.id]; if(!m) continue;
    ids.push(b.id); adj[b.id]={x:0,y:0};
    basePx[b.id]={x:percentToPxX(m.baseX), y:percentToPxY(m.baseY)};

    if(!m.dragging){
      const pRaw=(t-m.t0)/(m.dur/m.speedBias), p=(pRaw<=0)?0:((pRaw>=1)?1:easeInOut(pRaw));
      const curX=m.from.x+(m.to.x-m.from.x)*p; const curY=m.from.y+(m.to.y-m.from.y)*p;
      const breath=0.85+0.15*Math.sin(t*m.breathFreq*2*Math.PI+m.phase);
      const microX=Math.sin(t*2*Math.PI*(m.microFreq*0.9)+m.phase)*(m.microAmp*0.5);
      const microY=Math.cos(t*2*Math.PI*(m.microFreq*1.1)+m.phase*1.3)*(m.microAmp*0.5);
      const px=parseFloat(m.el.dataset.parallaxX||'0')*0.9, py=parseFloat(m.el.dataset.parallaxY||'0')*0.9;
      off[b.id]={x:(curX+microX)*breath+px, y:(curY+microY)*breath+py};
      if(pRaw>=1){ m.from={x:curX,y:curY}; m.to=newTarget(m); m.t0=t; m.dur=(6+Math.random()*6)/SPEED; }
    } else { off[b.id]={x:0,y:0}; }
  }

  // Pairwise strict separation
  const ITER=6, EPS=1.2, margin=0, bounceK=0.18;
  for(let k=0;k<ITER;k++){
    for(let i=0;i<ids.length;i++){
      const idA=ids[i], mA=bubbleMotion[idA]; if(!mA||mA.dragging) continue;
      const cxA=basePx[idA].x+off[idA].x+adj[idA].x+mA.size/2;
      const cyA=basePx[idA].y+off[idA].y+adj[idA].y+mA.size/2;
      for(let j=i+1;j<ids.length;j++){
        const idB=ids[j], mB=bubbleMotion[idB]; if(!mB||mB.dragging) continue;
        const cxB=basePx[idB].x+off[idB].x+adj[idB].x+mB.size/2;
        const cyB=basePx[idB].y+off[idB].y+adj[idB].y+mB.size/2;
        const dx=cxB-cxA, dy=cyB-cyA, dist=Math.hypot(dx,dy)||0.0001;
        const minDist=(mA.radius+mB.radius)+margin+EPS;
        if(dist<minDist){
          const overlap=minDist-dist, nx=dx/dist, ny=dy/dist;
          const shareA=0.5, shareB=0.5;
          adj[idA].x+=-nx*overlap*shareA; adj[idA].y+=-ny*overlap*shareA;
          adj[idB].x+= nx*overlap*shareB; adj[idB].y+= ny*overlap*shareB;
          mA.to.x+=-nx*overlap*bounceK; mA.to.y+=-ny*overlap*bounceK;
          mB.to.x+= nx*overlap*bounceK; mB.to.y+= ny*overlap*bounceK;
        }
      }
    }
  }

  // Keepout rettangolare del titolo
  updateHeroRect();
  const pad = heroRect.pad;
  for(const id of ids){
    const m=bubbleMotion[id]; if(!m||m.dragging) continue;
    const cx=basePx[id].x+off[id].x+adj[id].x+m.size/2;
    const cy=basePx[id].y+off[id].y+adj[id].y+m.size/2;
    const left=heroRect.left-pad, right=heroRect.right+pad, top=heroRect.top-pad, bottom=heroRect.bottom+pad;
    const nearestX=Math.max(left, Math.min(cx, right));
    const nearestY=Math.max(top,  Math.min(cy, bottom));
    const dx=cx-nearestX, dy=cy-nearestY, dist=Math.hypot(dx,dy);
    const minDist=m.radius+1.0;
    if(dist<minDist){
      const overlap=minDist-(dist||0.0001), nx=(dist?dx/dist:0), ny=(dist?dy/dist:-1);
      adj[id].x+=nx*overlap; adj[id].y+=ny*overlap;
      m.to.x+=nx*overlap*0.35; m.to.y+=ny*overlap*0.35;
    }
  }

  // Soft boundary + apply
  for(const id of ids){
    const m=bubbleMotion[id]; if(!m) continue;
    let finalX=off[id].x+adj[id].x, finalY=off[id].y+adj[id].y;
    let left=percentToPxX(m.baseX)+finalX, top=percentToPxY(m.baseY)+finalY;
    const maxLeft=stage.clientWidth-m.size-EDGE_PAD, maxTop=stage.clientHeight-m.size-EDGE_PAD;
    const minLeft=EDGE_PAD, minTop=EDGE_PAD;
    if(left<minLeft){ const d=(minLeft-left); finalX+=d; left+=d; m.to.x+=d*0.5; }
    else if(left>maxLeft){ const d=(left-maxLeft); finalX-=d; left-=d; m.to.x-=d*0.5; }
    if(top<minTop){ const d=(minTop-top); finalY+=d; top+=d; m.to.y+=d*0.5; }
    else if(top>maxTop){ const d=(top-maxTop); finalY-=d; top-=d; m.to.y-=d*0.5; }
    m.el.style.setProperty('--x', `${finalX.toFixed(2)}px`);
    m.el.style.setProperty('--y', `${finalY.toFixed(2)}px`);
  }

  requestAnimationFrame(animateBubbles);
}

// ---- Init -------------------------------------------------------------------
loadState(); seedIfEmpty(); ensureAddBubble(); render(); animateBubbles();
