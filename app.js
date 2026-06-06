/* ============== 闇黑龍王 互動攻略模擬器 — 核心邏輯 ============== */
const ROLES = {
  hero:{f:'assets/jobs/hero.jpg', n:'英雄'}, long:{f:'assets/jobs/long.jpg', n:'龍騎'},
  dao :{f:'assets/jobs/dao.jpg',  n:'刀賊'}, biao:{f:'assets/jobs/biao.jpg', n:'標賊'},
  nu  :{f:'assets/jobs/nu.jpg',   n:'弩手'}, qiang:{f:'assets/jobs/qiang.jpg', n:'槍神'},
  gong:{f:'assets/jobs/gong.jpg', n:'箭神'}, fa:{f:'assets/jobs/fa.jpg', n:'冰雷'},
  quan:{f:'assets/jobs/quan.jpg', n:'拳霸'},
  bishop:{f:'assets/jobs/bishop.jpg', n:'主教'}, fp:{f:'assets/jobs/fp.jpg', n:'火毒'}, pala:{f:'assets/jobs/pala.jpg', n:'聖騎士'},
};
const GLOBAL_ZONES = [
  {kind:'green', x:87.2, y:47.4, w:9.5, h:80,   t:'安全區'},
  {kind:'red',   x:33.2, y:47.9, w:7.9, h:77.6, t:'危險區'},
  {kind:'red',   x:16.7, y:47.7, w:7.9, h:77.6, t:'危險區'},
  {kind:'red',   x:70.8, y:47.3, w:7.9, h:77.6, t:'危險區'},
  {kind:'red',   x:84.8, y:48.5, w:7.9, h:77.6, t:'危險區'},
];
const STAGES = [
  {"name":"開場 ・ 就定位","color":"#64748b","marks":[],"zones":[],"pos":{},"notes":[["","空白範本 ・ 進「編輯模式」擺放職業站位、新增說明；下方階段已照建議攻略順序排好"],["warn","紅框＝危險區、綠框＝安全區（每階段固定顯示，可於編輯模式調整）"]]},
  {"name":"第一階段 ・ 開始攻略（斷尾）","color":"#14b8a6","marks":[],"zones":[],"pos":{},"notes":[]},
  {"name":"第二階段 ・ 左手","color":"#3b82f6","marks":[],"zones":[],"pos":{},"notes":[]},
  {"name":"第三階段 ・ 左頭 + 中頭","color":"#a855f7","marks":[],"zones":[],"pos":{},"notes":[]},
  {"name":"第四階段 ・ 右手 → 右頭 + 中頭","color":"#f97316","marks":[],"zones":[],"pos":{},"notes":[]},
  {"name":"第五階段 ・ 狂暴下煙","color":"#e11d48","marks":[],"zones":[],"pos":{},"notes":[]},
  {"name":"最後階段 ・ 收尾雙腿","color":"#22c55e","marks":[],"zones":[],"pos":{},"notes":[]}
];

let cur=0, editMode=false, sel=null, dirty=false, playing=false, dragNoteIdx=null;
const app=document.getElementById('app');
const arena=document.getElementById('arena');
let roleEls={}, markEls=[], zoneEls=[], textEls=[];
let zoneVis={red:true, green:true};
try{ const zv=JSON.parse(localStorage.getItem('horntail_zonevis')||'null'); if(zv&&typeof zv==='object'){ zoneVis.red=zv.red!==false; zoneVis.green=zv.green!==false; } }catch(e){}
const DEFAULT_BOARD=JSON.parse(JSON.stringify({STAGES,GLOBAL_ZONES}));
const Xsvg='<svg viewBox="0 0 10 10" class="xmark"><line x1="1.6" y1="1.6" x2="8.4" y2="8.4"/><line x1="8.4" y1="1.6" x2="1.6" y2="8.4"/></svg>';

function roleId(k,inst){ return k+'#'+inst; }
function toPairs(v){ if(Array.isArray(v)&&v.length&&Array.isArray(v[0])) return v; if(Array.isArray(v)&&typeof v[0]==='number') return [v]; return []; }
function migrate(){ STAGES.forEach(st=>{ const p=st.pos||(st.pos={});
  for(const k in p) p[k]=toPairs(p[k]);
  [['hero','hero2'],['fa','fa2'],['long','long2']].forEach(([base,clone])=>{ if(p[clone]){ p[base]=(p[base]||[]).concat(p[clone]); delete p[clone]; } });
}); }
function clearRoles(){ for(const id in roleEls) roleEls[id].remove(); roleEls={}; }

/* ---------- 職業列（地圖上方・編輯模式才顯示） ---------- */
function renderJobTray(){
  const tray=document.getElementById('jobTray'); if(!tray) return;
  if(!editMode){ tray.style.display='none'; tray.innerHTML=''; return; }
  tray.style.display='flex'; tray.innerHTML='';
  const st=STAGES[cur];
  // 第一排：標記工具（純圖示，拖到地圖）
  const r1=document.createElement('div'); r1.className='jt-row';
  const l1=document.createElement('span'); l1.className='jt-lab'; l1.textContent='標記'; r1.appendChild(l1);
  const tools=[
    {item:'mark:O', cls:'tt-o', glyph:'',  title:'目標〇（拖到地圖）'},
    {item:'mark:X', cls:'tt-x', glyph:'✕', title:'已斷✕（拖到地圖）'},
    {item:'zone:smoke', cls:'tt-s', glyph:'💨', title:'下煙區（拖到地圖）'},
    {item:'text:', cls:'tt-t', glyph:'T', title:'文字（拖到地圖後直接打字）'},
  ];
  tools.forEach(o=>{ const c=document.createElement('div'); c.className='jt-cell jt-tool'; c.title=o.title; c.draggable=true;
    c.addEventListener('dragstart',ev=>{ ev.dataTransfer.setData('text/item',o.item); ev.dataTransfer.effectAllowed='copy'; c.classList.add('dragging'); });
    c.addEventListener('dragend',()=>c.classList.remove('dragging'));
    const p=document.createElement('span'); p.className='tt-prev '+o.cls; if(o.glyph)p.textContent=o.glyph; c.appendChild(p);
    r1.appendChild(c); });
  tray.appendChild(r1);
  // 第二排：職業（純拖曳）
  const r2=document.createElement('div'); r2.className='jt-row';
  const l2=document.createElement('span'); l2.className='jt-lab'; l2.textContent='職業'; r2.appendChild(l2);
  for(const k in ROLES){ const n=(st.pos[k]?st.pos[k].length:0);
    const c=document.createElement('div'); c.className='jt-cell'+(n?' on':''); c.title=ROLES[k].n+'（拖到地圖）'; c.draggable=true;
    c.addEventListener('dragstart',ev=>{ ev.dataTransfer.setData('text/role',k); ev.dataTransfer.effectAllowed='copy'; c.classList.add('dragging'); });
    c.addEventListener('dragend',()=>c.classList.remove('dragging'));
    const img=document.createElement('img'); img.src=ROLES[k].f; img.alt=ROLES[k].n; img.draggable=false; c.appendChild(img);
    const nm=document.createElement('span'); nm.className='jt-n'; nm.textContent=ROLES[k].n; c.appendChild(nm);
    if(n){ const b=document.createElement('span'); b.className='jt-ct'; b.textContent='×'+n; c.appendChild(b); }
    r2.appendChild(c);
  }
  tray.appendChild(r2);
}

/* ---------- 進度點 + 階段軌 ---------- */
const stepsEl=document.getElementById('steps');
const railEl=document.getElementById('phaseRail');
function shortName(n){ return (n||'').replace(/^[^・]*・\s*/,'').replace(/^.*?[:：]\s*/,'').trim()||n; }
function rebuildSteps(){
  stepsEl.innerHTML='';
  STAGES.forEach((s,i)=>{ const d=document.createElement('div'); d.className='dot'; d.textContent=i; d.title=s.name; d.onclick=()=>go(i); stepsEl.appendChild(d); });
}

/* ---------- 主渲染 ---------- */
function render(i){
  const st=STAGES[i];
  const need={};
  for(const k in st.pos){ if(!ROLES[k]) continue; (st.pos[k]||[]).forEach((xy,inst)=>{ need[roleId(k,inst)]={k,inst,xy}; }); }
  for(const id in roleEls){ if(!need[id]){ const el=roleEls[id]; el.style.opacity=0; el.style.pointerEvents='none'; } }
  for(const id in need){ const o=need[id]; let e=roleEls[id];
    if(!e){ e=document.createElement('div'); e.className='role'; e.dataset.k=o.k; e.dataset.inst=o.inst;
      e.innerHTML='<div class="role-av"><img src="'+ROLES[o.k].f+'" alt="'+ROLES[o.k].n+'" draggable="false"></div><div class="nm"></div><div class="lbl"></div>';
      arena.appendChild(e); roleEls[id]=e;
      attachDrag(e,(x,y)=>{ const a=STAGES[cur].pos[o.k]; if(a&&a[o.inst]){ a[o.inst][0]=x; a[o.inst][1]=y; e.style.left=x+'%'; e.style.top=y+'%'; } },save,()=>selectRole(o.k,o.inst)); }
    e.querySelector('.nm').textContent=ROLES[o.k].n;
    const _l=e.querySelector('.lbl'), _t=(o.xy[2]||'');
    const _selR = !!(editMode&&sel&&sel.type==='role'&&sel.key===o.k&&sel.inst===o.inst);
    _l.textContent=_t; _l.dataset.ph='＋備註';
    _l.style.display=(_t||_selR)?'block':'none';
    if(_selR){ _l.contentEditable='true'; _l.spellcheck=false; _l.classList.add('lbl-edit');
      _l.oninput=()=>{ const a=STAGES[cur].pos[o.k]; if(a&&a[o.inst]){ a[o.inst][2]=_l.textContent; save(); } };
      _l.onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); _l.blur(); } e.stopPropagation(); };
      _l.onpointerdown=(e)=>{ e.stopPropagation(); };
    } else { _l.contentEditable='false'; _l.classList.remove('lbl-edit'); }
    e.style.left=o.xy[0]+'%'; e.style.top=o.xy[1]+'%'; e.style.opacity=1; e.style.pointerEvents=editMode?'auto':'none';
    e.classList.toggle('sel', _selR);
  }
  markEls.forEach(m=>m.remove()); markEls=[];
  (st.marks||[]).forEach((m,idx)=>{ const d=document.createElement('div'); d.className='mark '+m.kind;
    d.style.left=m.x+'%'; d.style.top=m.y+'%'; d.style.width=(m.r*2)+'%';
    if(m.kind==='X') d.innerHTML=Xsvg;
    if(editMode){ d.classList.add('editable'); if(sel&&sel.type==='mark'&&sel.index===idx) d.classList.add('sel');
      attachDrag(d,(x,y)=>{m.x=x;m.y=y;d.style.left=x+'%';d.style.top=y+'%';},save,()=>selectItem('mark',idx)); }
    arena.appendChild(d); markEls.push(d); });
  zoneEls.forEach(z=>z.remove()); zoneEls=[];
  (st.zones||[]).forEach((z,idx)=>{ const d=document.createElement('div'); d.className='zone '+z.kind;
    d.style.left=z.x+'%'; d.style.top=z.y+'%'; d.style.width=z.w+'%'; d.style.height=z.h+'%';
    d.innerHTML = (z.kind==='smoke'&&!z.t) ? '<span class="zsmoke">💨</span>' : '<span>'+(z.t||'')+'</span>';
    if(editMode){ d.classList.add('editable'); if(sel&&sel.type==='zone'&&sel.index===idx) d.classList.add('sel');
      attachDrag(d,(x,y)=>{z.x=x;z.y=y;d.style.left=x+'%';d.style.top=y+'%';},save,()=>selectItem('zone',idx)); }
    arena.appendChild(d); zoneEls.push(d); });
  GLOBAL_ZONES.forEach(z=>{ if(z.kind==='red'&&!zoneVis.red) return; if(z.kind==='green'&&!zoneVis.green) return;
    const d=document.createElement('div'); d.className='zone '+z.kind;
    d.style.left=z.x+'%'; d.style.top=z.y+'%'; d.style.width=z.w+'%'; d.style.height=z.h+'%';
    d.innerHTML='<span>'+(z.t||'')+'</span>';
    arena.appendChild(d); zoneEls.push(d); });
  textEls.forEach(t=>t.remove()); textEls=[];
  (st.texts||[]).forEach((tx,idx)=>{ const d=document.createElement('div'); d.className='atext';
    d.style.left=tx.x+'%'; d.style.top=tx.y+'%'; d.style.fontSize=(tx.size||16)+'px'; d.style.color=tx.color||'#ffffff'; d.textContent=tx.t||'';
    if(editMode){ d.classList.add('editable'); d.dataset.ph='輸入文字…';
      const isSel = sel&&sel.type==='text'&&sel.index===idx;
      if(isSel){ d.classList.add('sel'); d.contentEditable='true'; d.spellcheck=false;
        d.oninput=()=>{ tx.t=d.textContent; save(); placeSelBar(); };
        d.onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); d.blur(); } e.stopPropagation(); };
      }
      attachDrag(d,(x,y)=>{tx.x=x;tx.y=y;d.style.left=x+'%';d.style.top=y+'%';},save,()=>selectItem('text',idx));
    }
    arena.appendChild(d); textEls.push(d); });
  mountHandle();
  placeSelBar();
  renderTitle();
  renderJobTray();
  const ul=document.getElementById('plist'); ul.innerHTML=''; ul.classList.toggle('editing', editMode);
  (st.notes||[]).forEach((n,idx)=>{
    const li=document.createElement('li'); if(n[0]) li.className=n[0];
    if(!editMode){ li.textContent=n[1]; ul.appendChild(li); return; }
    li.classList.add('edit-li');
    const grip=document.createElement('span'); grip.className='note-grip'; grip.textContent='⠿'; grip.draggable=true; grip.title='拖曳調整順序';
    grip.addEventListener('dragstart',ev=>{ dragNoteIdx=idx; ev.dataTransfer.effectAllowed='move'; try{ev.dataTransfer.setData('text/plain','note');}catch(e){} li.classList.add('dragging'); });
    grip.addEventListener('dragend',()=>{ dragNoteIdx=null; li.classList.remove('dragging'); ul.querySelectorAll('.drop-target').forEach(e=>e.classList.remove('drop-target')); });
    li.addEventListener('dragover',ev=>{ if(dragNoteIdx===null) return; ev.preventDefault(); ev.dataTransfer.dropEffect='move'; li.classList.add('drop-target'); });
    li.addEventListener('dragleave',()=>li.classList.remove('drop-target'));
    li.addEventListener('drop',ev=>{ if(dragNoteIdx===null) return; ev.preventDefault(); li.classList.remove('drop-target');
      if(dragNoteIdx!==idx){ const arr=STAGES[cur].notes; const m=arr.splice(dragNoteIdx,1)[0]; arr.splice(idx,0,m); } dragNoteIdx=null; render(cur); save(); });
    const tb=document.createElement('button'); tb.type='button'; tb.className='note-type '+(n[0]||'base');
    tb.textContent = n[0]==='warn'?'⚠':(n[0]==='safe'?'✓':'›'); tb.title='類型：一般 → 注意 → 安全（點一下切換）';
    tb.onclick=()=>{ n[0]= n[0]===''?'warn':(n[0]==='warn'?'safe':''); render(cur); save(); };
    const tx=document.createElement('div'); tx.className='note-tx'; tx.contentEditable='true'; tx.spellcheck=false; tx.dataset.ph='輸入說明…'; tx.textContent=n[1];
    tx.oninput=()=>{ n[1]=tx.textContent; save(); };
    tx.onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); tx.blur(); } };
    const del=document.createElement('button'); del.type='button'; del.className='note-del'; del.textContent='×'; del.title='刪除這行';
    del.onclick=()=>{ st.notes.splice(idx,1); render(cur); save(); };
    li.append(grip,tb,tx,del); ul.appendChild(li);
  });
  if(editMode){ const add=document.createElement('button'); add.type='button'; add.className='note-add'; add.textContent='＋ 新增說明';
    add.onclick=()=>{ (st.notes=st.notes||[]).push(['','']); render(cur); save(); setTimeout(()=>{ const xs=ul.querySelectorAll('.note-tx'); const last=xs[xs.length-1]; if(last) last.focus(); },0); };
    ul.appendChild(add); }
  // phase rail
  railEl.innerHTML='';
  STAGES.forEach((s,j)=>{ const it=document.createElement('div'); it.className='pr-item'+(j===i?' on':'')+(j<i?' done':'');
    it.innerHTML='<span class="pr-n">'+j+'</span><span class="pr-t">'+shortName(s.name)+'</span>';
    it.onclick=()=>go(j); railEl.appendChild(it); });
  [...stepsEl.children].forEach((d,j)=>d.classList.toggle('on',j===i));
  updateEmptyHint();
}
function renderTitle(){ const st=STAGES[cur]; const el=document.getElementById('ptName');
  if(document.activeElement!==el) el.textContent=st.name;
  el.contentEditable = editMode?'true':'false'; el.classList.toggle('title-edit', editMode); el.title = editMode?'點一下可改階段標題':'';
  document.getElementById('ptTag').textContent=cur+' / '+(STAGES.length-1); }

/* ---------- toast ---------- */
let toastTimer=null;
function showToast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1400); }

/* ---------- 導覽 ---------- */
function go(i){
  if(i<0){ showToast('已是第一階段'); i=0; }
  else if(i>STAGES.length-1){ showToast('已是最後階段'); i=STAGES.length-1; }
  cur=i; render(cur); if(editMode) renderEditor();
}
document.getElementById('next').onclick=()=>go(cur+1);
document.getElementById('prev').onclick=()=>go(cur-1);
document.addEventListener('keydown',e=>{
  if(e.target&&/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if(e.key==='Escape'){ if(helpEl.classList.contains('show')){ closeHelp(); } else if(sel){ sel=null; refreshSel(); } else if(editMode){ setEdit(false); } return; }
  if(editMode&&(e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); return; }
  if(editMode&&(e.ctrlKey||e.metaKey)&&(e.key==='y'||e.key==='Y')){ e.preventDefault(); redo(); return; }
  if(editMode&&sel&&(e.key==='Delete'||e.key==='Backspace')){ e.preventDefault(); deleteSelected(); return; }
  if(editMode&&sel&&(e.ctrlKey||e.metaKey)&&(e.key==='d'||e.key==='D')){ e.preventDefault(); duplicateSelected(); return; }
  if(editMode&&sel&&/^Arrow/.test(e.key)){ e.preventDefault(); nudgeSel(e.key, e.shiftKey?2:0.5); return; }
  if(e.key==='ArrowRight'){ e.preventDefault(); go(cur+1); }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); go(cur-1); }
});

/* ---------- 主題切換 ---------- */
const SKINS=['skin-b','skin-a','skin-c'];
let skin='skin-b';
function applySkin(s){ skin=SKINS.includes(s)?s:'skin-b';
  app.classList.remove('skin-a','skin-b','skin-c'); app.classList.add(skin);
  document.querySelectorAll('#themeSwitch button').forEach(b=>b.classList.toggle('on', b.dataset.skin===skin));
  try{ localStorage.setItem('horntail_skin', skin); }catch(e){}
  if(editMode) renderTitle();
}
document.querySelectorAll('#themeSwitch button').forEach(b=>{ b.onclick=()=>applySkin(b.dataset.skin); });

/* ---------- 拖曳 / 縮放把手 ---------- */
function attachDrag(el,onMove,onEnd,onSelect){
  el.addEventListener('pointerdown',e=>{
    if(!editMode) return;
    const editing = el.isContentEditable;
    if(!editing){ e.preventDefault(); }
    e.stopPropagation();
    if(onSelect) onSelect();
    const r=arena.getBoundingClientRect();
    const sx=e.clientX, sy=e.clientY; let moved=false, capturing=false;
    const begin=()=>{ capturing=true; try{el.setPointerCapture(e.pointerId);}catch(_){}
      const sb=document.getElementById('selBar'); if(sb) sb.style.display='none'; };
    const move=ev=>{
      if(!capturing){ if(Math.abs(ev.clientX-sx)+Math.abs(ev.clientY-sy)<5) return; begin(); if(editing){ try{el.blur();}catch(_){}} }
      moved=true;
      const x=Math.max(0,Math.min(100,+(((ev.clientX-r.left)/r.width)*100).toFixed(1)));
      const y=Math.max(0,Math.min(100,+(((ev.clientY-r.top)/r.height)*100).toFixed(1)));
      onMove(x,y); showToast(x+'% , '+y+'%'); };
    const up=()=>{ if(capturing){ try{el.releasePointerCapture(e.pointerId);}catch(_){} }
      el.removeEventListener('pointermove',move); el.removeEventListener('pointerup',up);
      if(onEnd) onEnd(moved); placeSelBar(); };
    el.addEventListener('pointermove',move); el.addEventListener('pointerup',up);
  });
}
function addHandle(el, apply){
  const h=document.createElement('div'); h.className='rsz';
  h.addEventListener('pointerdown',e=>{ if(!editMode) return; e.preventDefault(); e.stopPropagation(); h.setPointerCapture(e.pointerId);
    const r=arena.getBoundingClientRect();
    const bar=document.getElementById('selBar'); if(bar) bar.style.display='none';
    let raf=0, lx=0, ly=0;
    const flush=()=>{ raf=0; apply(lx,ly,r.height,r.width); };
    const move=ev=>{ lx=((ev.clientX-r.left)/r.width)*100; ly=((ev.clientY-r.top)/r.height)*100; if(!raf) raf=requestAnimationFrame(flush); };
    const up=()=>{ if(raf) cancelAnimationFrame(raf); apply(lx,ly,r.height,r.width); h.releasePointerCapture(e.pointerId); h.removeEventListener('pointermove',move); h.removeEventListener('pointerup',up); placeSelBar(); save(); };
    h.addEventListener('pointermove',move); h.addEventListener('pointerup',up); });
  el.appendChild(h);
}
function mountHandle(){
  arena.querySelectorAll('.rsz').forEach(h=>h.remove());
  if(!editMode||!sel) return;
  const st=STAGES[cur];
  if(sel.type==='mark'){ const el=markEls[sel.index], m=st.marks&&st.marks[sel.index]; if(el&&m) addHandle(el,(px,py)=>{ m.r=Math.max(1,+Math.max(Math.abs(px-m.x),Math.abs(py-m.y)).toFixed(1)); el.style.width=(m.r*2)+'%'; const num=el.querySelector('.onum'); if(num) num.style.fontSize=((arena.clientWidth||700)*(m.r*2/100)*0.55)+'px'; }); }
  else if(sel.type==='zone'){ const el=zoneEls[sel.index], z=st.zones&&st.zones[sel.index]; if(el&&z) addHandle(el,(px,py)=>{ z.w=Math.max(2,+(2*Math.abs(px-z.x)).toFixed(1)); z.h=Math.max(2,+(2*Math.abs(py-z.y)).toFixed(1)); el.style.width=z.w+'%'; el.style.height=z.h+'%'; }); }
  else if(sel.type==='text'){ const el=textEls[sel.index], tx=st.texts&&st.texts[sel.index]; if(el&&tx) addHandle(el,(px,py,rh)=>{ tx.size=Math.max(8,Math.round(rh*Math.abs(py-tx.y)/100*2)); el.style.fontSize=tx.size+'px'; }); }
}
function selEl(){ if(!sel) return null;
  if(sel.type==='mark') return markEls[sel.index];
  if(sel.type==='zone') return zoneEls[sel.index];
  if(sel.type==='text') return textEls[sel.index];
  if(sel.type==='role') return roleEls[sel.key+'#'+sel.inst];
  return null; }
function placeSelBar(){ const bar=document.getElementById('selBar'); if(!bar) return;
  if(!editMode||!sel){ bar.style.display='none'; bar.innerHTML=''; return; }
  const el=selEl(); if(!el){ bar.style.display='none'; bar.innerHTML=''; return; }
  bar.innerHTML='';
  const mk=(txt,fn,cls)=>{ const b=document.createElement('button'); b.className='sb'+(cls?' '+cls:''); b.textContent=txt;
    b.onpointerdown=e=>e.stopPropagation(); b.onclick=e=>{ e.stopPropagation(); fn(); }; return b; };
  if(sel.type==='text'){ const tx=STAGES[cur].texts&&STAGES[cur].texts[sel.index];
    const c=document.createElement('input'); c.type='color'; c.className='sb-col'; c.title='文字顏色'; c.value=(tx&&tx.color)||'#ffffff';
    c.onpointerdown=e=>e.stopPropagation(); c.oninput=e=>{ e.stopPropagation(); if(tx){ tx.color=c.value; const el2=selEl(); if(el2) el2.style.color=c.value; save(); } };
    bar.append(c); }
  if(sel.type==='zone'){ const z=STAGES[cur].zones&&STAGES[cur].zones[sel.index];
    const e=mk('✏',()=>{ const t=prompt('區域文字（留空＝只顯示煙圖示）', (z&&z.t)||''); if(t!==null&&z){ z.t=t; render(cur); placeSelBar(); save(); } },'note'); e.title='改文字'; bar.append(e); }
  if(sel.type!=='role'){ const d=mk('⧉',duplicateSelected,'dup'); d.title='複製一份'; bar.append(d); }
  const x=mk('🗑',deleteSelected,'del'); x.title='刪除'; bar.append(x);
  const ar=arena.getBoundingClientRect(), r=el.getBoundingClientRect();
  const above=(r.top-ar.top)>42;
  bar.classList.toggle('below',!above);
  bar.style.display='flex';
  const bw=bar.offsetWidth||132, cx=Math.max(bw/2+4, Math.min(ar.width-bw/2-4, (r.left+r.right)/2-ar.left));
  bar.style.left=cx+'px';
  bar.style.top=(above ? (r.top-ar.top-6) : (r.bottom-ar.top+6))+'px';
}
function selectItem(type,index){ sel={type,index}; refreshSel(); }
function focusSelText(selectAll){ setTimeout(()=>{ const el=selEl(); if(el&&el.isContentEditable){ el.focus();
  if(selectAll){ try{ const r=document.createRange(); r.selectNodeContents(el); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }catch(_){} } } },0); }
function selectRole(key,inst){ sel={type:'role',key,inst}; refreshSel(); }
function refreshSel(){
  markEls.forEach((el,i)=>el.classList.toggle('sel', !!(sel&&sel.type==='mark'&&sel.index===i)));
  zoneEls.forEach((el,i)=>el.classList.toggle('sel', !!(sel&&sel.type==='zone'&&sel.index===i)));
  textEls.forEach((el,i)=>el.classList.toggle('sel', !!(sel&&sel.type==='text'&&sel.index===i)));
  for(const id in roleEls){ const el=roleEls[id];
    const on = !!(sel&&sel.type==='role'&&sel.key===el.dataset.k&&+el.dataset.inst===sel.inst);
    el.classList.toggle('sel', on);
    const _l=el.querySelector('.lbl'); if(_l){ const _t=_l.textContent;
      _l.style.display=(_t||on)?'block':'none';
      if(on){ _l.contentEditable='true'; _l.classList.add('lbl-edit'); _l.dataset.ph='＋備註';
        const k=el.dataset.k, inst=+el.dataset.inst;
        _l.oninput=()=>{ const a=STAGES[cur].pos[k]; if(a&&a[inst]){ a[inst][2]=_l.textContent; save(); } };
        _l.onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); _l.blur(); } e.stopPropagation(); };
        _l.onpointerdown=(e)=>{ e.stopPropagation(); };
      }
      else { _l.contentEditable='false'; _l.classList.remove('lbl-edit'); } } }
  mountHandle(); renderEditor(); placeSelBar();
}
function clamp01(v){ return Math.max(0,Math.min(100,+(+v).toFixed(1))); }
function nudgeSel(key,step){ if(!sel) return; const st=STAGES[cur]; let p;
  if(sel.type==='role'){ const a=st.pos[sel.key]; p=a&&a[sel.inst]; }
  else if(sel.type==='mark'){ p=st.marks&&st.marks[sel.index]; }
  else if(sel.type==='zone'){ p=st.zones&&st.zones[sel.index]; }
  else if(sel.type==='text'){ p=st.texts&&st.texts[sel.index]; }
  if(!p) return;
  const dx=key==='ArrowLeft'?-step:key==='ArrowRight'?step:0;
  const dy=key==='ArrowUp'?-step:key==='ArrowDown'?step:0;
  if(sel.type==='role'){ p[0]=clamp01(p[0]+dx); p[1]=clamp01(p[1]+dy); }
  else { p.x=clamp01(p.x+dx); p.y=clamp01(p.y+dy); }
  render(cur); save();
}
function resizeSel(dir){ if(!sel) return; const st=STAGES[cur];
  if(sel.type==='mark'){ const m=st.marks&&st.marks[sel.index]; if(m) m.r=Math.max(1,+(m.r+dir*0.5).toFixed(1)); }
  else if(sel.type==='text'){ const t=st.texts&&st.texts[sel.index]; if(t) t.size=Math.max(8,(t.size||16)+dir*2); }
  else if(sel.type==='zone'){ const z=st.zones&&st.zones[sel.index]; if(z){ const f=dir>0?1.12:0.89; z.w=Math.max(2,+(z.w*f).toFixed(1)); z.h=Math.max(2,+(z.h*f).toFixed(1)); } }
  render(cur); save();
}

/* ---------- 編輯器 ---------- */
function toHex(c){ return /^#[0-9a-fA-F]{6}$/.test(c)?c:'#888888'; }
function ebtn(txt,fn,cls){ const b=document.createElement('button'); b.className='mini'+(cls?' '+cls:''); b.textContent=txt; b.onclick=fn; return b; }
let arenaDropInit=false;
function initArenaDrop(){ if(arenaDropInit) return; arenaDropInit=true;
  arena.addEventListener('dragover',ev=>{ if(editMode){ ev.preventDefault(); ev.dataTransfer.dropEffect='copy'; arena.classList.add('drop-on'); } });
  arena.addEventListener('dragleave',()=>arena.classList.remove('drop-on'));
  arena.addEventListener('drop',ev=>{ arena.classList.remove('drop-on'); if(!editMode) return;
    const r=arena.getBoundingClientRect(); const x=clamp01((ev.clientX-r.left)/r.width*100); const y=clamp01((ev.clientY-r.top)/r.height*100);
    const st2=STAGES[cur];
    const k=ev.dataTransfer.getData('text/role');
    if(k&&ROLES[k]){ ev.preventDefault(); (st2.pos[k]=st2.pos[k]||[]).push([x,y]); sel={type:'role',key:k,inst:st2.pos[k].length-1}; render(cur); renderEditor(); save(); showToast(ROLES[k].n+' 已放置'); return; }
    const item=ev.dataTransfer.getData('text/item'); if(!item) return; ev.preventDefault();
    if(item==='mark:O'){ (st2.marks=st2.marks||[]).push({kind:'O',x,y,r:4}); sel={type:'mark',index:st2.marks.length-1}; render(cur); renderEditor(); save(); }
    else if(item==='mark:X'){ (st2.marks=st2.marks||[]).push({kind:'X',x,y,r:4}); sel={type:'mark',index:st2.marks.length-1}; render(cur); renderEditor(); save(); }
    else if(item==='zone:smoke'){ (st2.zones=st2.zones||[]).push({kind:'smoke',x,y,w:15,h:15,t:''}); sel={type:'zone',index:st2.zones.length-1}; render(cur); renderEditor(); save(); }
    else if(item==='text:'){ (st2.texts=st2.texts||[]).push({x,y,t:'文字',size:22,color:'#ffffff'}); sel={type:'text',index:st2.texts.length-1}; render(cur); renderEditor(); save(); focusSelText(true); }
  });
}
function selSizeCtl(){ const w=document.createElement('div'); w.className='sel-ctl';
  const l=document.createElement('span'); l.className='lab'; l.textContent='大小';
  const m=document.createElement('button'); m.className='stp'; m.textContent='－'; m.title='縮小'; m.onclick=()=>resizeSel(-1);
  const p=document.createElement('button'); p.className='stp'; p.textContent='＋'; p.title='放大'; p.onclick=()=>resizeSel(1);
  w.append(l,m,p); return w; }
function selMoveCtl(){ const w=document.createElement('div'); w.className='sel-ctl';
  const l=document.createElement('span'); l.className='lab'; l.textContent='位置'; const pad=document.createElement('div'); pad.className='nudge';
  [['◀','ArrowLeft'],['▲','ArrowUp'],['▼','ArrowDown'],['▶','ArrowRight']].forEach(([t,kk])=>{ const bb=document.createElement('button'); bb.textContent=t; bb.title='移動'; bb.onclick=()=>nudgeSel(kk,1); pad.appendChild(bb); });
  w.append(l,pad); return w; }
function renderEditor(){
  updateHistBtns();
  const box=document.getElementById('editor'); if(!box) return;
  if(!editMode){ box.style.display='none'; box.innerHTML=''; return; }
  const st=STAGES[cur]; box.style.display='flex'; box.innerHTML='';

  // 啟用地圖拖放（上方工具列拖入 O／X／煙／文字／職業）
  initArenaDrop();
  if(sel&&sel.type==='role'){ const arr=st.pos[sel.key]; if(!arr||!arr[sel.inst]) sel=null; }
  else if(sel&&sel.type==='text'){ const arr=st.texts; if(!(arr&&arr[sel.index])) sel=null; }
  else if(sel){ const arr=sel.type==='mark'?st.marks:st.zones; if(!(arr&&arr[sel.index])) sel=null; }

  // 輕量階段條：代表色 + 頁面管理（就在切換階段的地方管理階段）
  const lab=document.createElement('span'); lab.className='stb-lab'; lab.textContent='這一階段';
  const cw=document.createElement('label'); cw.className='stb-color'; cw.title='階段代表色';
  const col=document.createElement('input'); col.type='color'; col.value=toHex(st.color);
  col.oninput=()=>{ st.color=col.value; renderTitle(); save(); };
  cw.append('🎨', col);
  function sbtn(txt,fn,cls){ const b=document.createElement('button'); b.type='button'; b.className='stb-btn'+(cls?' '+cls:''); b.textContent=txt; b.onclick=fn; return b; }
  const grp=document.createElement('div'); grp.className='stb-grp';
  grp.append(
    sbtn('＋ 新增頁',addStage),
    sbtn('⧉ 複製頁',dupStage),
    sbtn('⤵ 沿用上一階段站位',inheritPrev,'wide'),
    sbtn('◀ 上移',()=>moveStage(-1)),
    sbtn('下移 ▶',()=>moveStage(1)),
    sbtn('🗑 刪除頁',delStage,'danger'));
  const reset=sbtn('↻ 還原範本',resetBoard,'ghost');
  box.append(lab, cw, grp, reset);
  save();
}

/* ---------- 匯出 PNG ---------- */
function roundRectPath(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
async function drawStageCanvas(idx, withTitle){
  const mapImg=arena.querySelector('.map'); const rect=arena.getBoundingClientRect();
  const ar=(mapImg&&mapImg.naturalWidth&&mapImg.naturalHeight)?mapImg.naturalWidth/mapImg.naturalHeight:(rect.width/rect.height);
  const W=1400, MH=Math.round(W/ar), sc=W/rect.width;
  const TH= withTitle ? Math.round(54*sc/2.86) : 0; // 標題列高度（依比例）
  const titleH = withTitle ? 46 : 0;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=MH+titleH; const g=cv.getContext('2d');
  if(withTitle){ g.fillStyle='#0e1726'; g.fillRect(0,0,W,titleH);
    g.fillStyle='#e8eef6'; g.font='900 24px "Noto Sans TC",sans-serif'; g.textAlign='left'; g.textBaseline='middle';
    g.fillText((idx)+'　'+(STAGES[idx].name||''), 18, titleH/2); }
  const oy=titleH;
  const PX=p=>p/100*W, PY=p=>p/100*MH+oy;
  try{ g.drawImage(mapImg,0,oy,W,MH); }catch(e){ g.fillStyle='#0b1320'; g.fillRect(0,oy,W,MH); }
  const st=STAGES[idx];
  const zones=[]; GLOBAL_ZONES.forEach(z=>{ if(z.kind==='red'&&!zoneVis.red)return; if(z.kind==='green'&&!zoneVis.green)return; zones.push(z); }); (st.zones||[]).forEach(z=>zones.push(z));
  zones.forEach(z=>{ const w=z.w/100*W,h=z.h/100*MH,x=PX(z.x)-w/2,y=PY(z.y)-h/2;
    let fill,stroke,dash=false;
    if(z.kind==='red'){fill='rgba(232,90,79,.18)';stroke='#e8645c';}
    else if(z.kind==='green'){fill='rgba(95,184,120,.18)';stroke='#3fae54';}
    else {fill='rgba(120,130,140,.20)';stroke='#aebccb';dash=true;}
    g.fillStyle=fill; g.fillRect(x,y,w,h);
    g.lineWidth=2*sc; g.strokeStyle=stroke; if(dash)g.setLineDash([7*sc,5*sc]); g.strokeRect(x,y,w,h); g.setLineDash([]);
    g.textAlign='center';
    if(z.kind==='smoke'&&!z.t){ g.textBaseline='middle'; g.font=(26*sc)+'px sans-serif'; g.fillText('💨',PX(z.x),PY(z.y)); }
    else if(z.t){ g.textBaseline='top'; g.font='800 '+(13*sc)+'px "Noto Sans TC",sans-serif'; g.fillStyle='#fff'; g.fillText(z.t,PX(z.x),y+4*sc); }
  });
  (st.marks||[]).forEach(m=>{ const cx=PX(m.x),cy=PY(m.y),rr=m.r/100*W;
    if(m.kind==='O'){ g.beginPath(); g.arc(cx,cy,rr,0,Math.PI*2); g.lineWidth=3.5*sc; g.strokeStyle='#ffc83d'; g.stroke(); }
    else { g.strokeStyle='#ff5a4f'; g.lineWidth=3.2*sc; g.lineCap='round'; const d=rr*0.72; g.beginPath(); g.moveTo(cx-d,cy-d); g.lineTo(cx+d,cy+d); g.moveTo(cx+d,cy-d); g.lineTo(cx-d,cy+d); g.stroke(); }
  });
  (st.texts||[]).forEach(tx=>{ g.font='900 '+((tx.size||22)*sc)+'px "Noto Sans TC",sans-serif'; g.fillStyle=tx.color||'#fff';
    g.textAlign='center'; g.textBaseline='middle'; g.shadowColor='rgba(0,0,0,.75)'; g.shadowBlur=4*sc; g.fillText(tx.t||'',PX(tx.x),PY(tx.y)); g.shadowBlur=0; });
  const tasks=[]; for(const k in st.pos){ (st.pos[k]||[]).forEach(p=>tasks.push({k,x:p[0],y:p[1],lbl:p[2]})); }
  await Promise.all(tasks.map(t=>new Promise(res=>{ const im=new Image(); im.onload=()=>{t.img=im;res();}; im.onerror=()=>res(); im.src=ROLES[t.k]?ROLES[t.k].f:''; })));
  const AV=42*sc, R=9*sc;
  tasks.forEach(t=>{ const cx=PX(t.x),cy=PY(t.y),x=cx-AV/2,y=cy-AV/2;
    if(t.img){ g.save(); roundRectPath(g,x,y,AV,AV,R); g.clip(); g.drawImage(t.img,x,y,AV,AV); g.restore(); g.lineWidth=2.2*sc; g.strokeStyle='#fff'; roundRectPath(g,x,y,AV,AV,R); g.stroke(); }
    const nm=ROLES[t.k]?ROLES[t.k].n:''; g.textAlign='center'; g.textBaseline='top'; g.shadowColor='#000'; g.shadowBlur=3*sc;
    g.font='800 '+(12*sc)+'px "Noto Sans TC",sans-serif'; g.fillStyle='#fff'; g.fillText(nm,cx,y+AV+2*sc);
    if(t.lbl){ g.fillStyle='#ffd479'; g.font='800 '+(11*sc)+'px "Noto Sans TC",sans-serif'; g.fillText(t.lbl,cx,y+AV+2*sc+14*sc); }
    g.shadowBlur=0;
  });
  return cv;
}
function canvasToBlob(cv){ return new Promise(res=>{ try{ cv.toBlob(res,'image/png'); }catch(e){ res(null); } }); }
const TAINT_MSG='產生圖片失敗：圖片受瀏覽器安全限制（多檔在本機 file:// 直接開會這樣）。請改用「單檔版」，或上傳到 GitHub Pages 後再試。';
async function exportPNG(){
  const cv=await drawStageCanvas(cur,false); const blob=await canvasToBlob(cv);
  if(!blob){ alert(TAINT_MSG); return; }
  try{ if(navigator.clipboard && window.ClipboardItem){ await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]); showToast('已複製圖片，可直接貼到 LINE／Discord'); return; } }catch(e){}
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='闇黑龍王_'+(shortName(STAGES[cur].name)||cur)+'.png'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('瀏覽器不支援複製圖片，已改為下載');
}
async function exportAllPNG(){
  showToast('合成全部階段圖片中…');
  const canvases=[]; for(let i=0;i<STAGES.length;i++){ canvases.push(await drawStageCanvas(i,true)); }
  const W=Math.max.apply(null,canvases.map(c=>c.width));
  const totalH=canvases.reduce((s,c)=>s+c.height,0)+ (canvases.length-1)*8;
  const big=document.createElement('canvas'); big.width=W; big.height=totalH; const g=big.getContext('2d');
  g.fillStyle='#0b1320'; g.fillRect(0,0,W,totalH);
  let y=0; canvases.forEach(c=>{ g.drawImage(c,0,y); y+=c.height+8; });
  const blob=await canvasToBlob(big);
  if(!blob){ alert(TAINT_MSG); return; }
  try{ if(navigator.clipboard && window.ClipboardItem){ await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]); showToast('已複製全部階段（合成一張長圖），可直接貼上'); return; } }catch(e){}
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='闇黑龍王_全部階段.png'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('瀏覽器不支援複製，已改為下載長圖');
}

/* ---------- 檔案 / 分享 ---------- */
function exportJSON(){ const data=JSON.stringify({version:1,STAGES,GLOBAL_ZONES},null,2);
  const blob=new Blob([data],{type:'application/json'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='horntail_stages.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); dirty=false; showToast('已匯出 JSON'); }
let fileHandle=null;
async function saveToFile(){
  const data=JSON.stringify({version:1,STAGES,GLOBAL_ZONES},null,2);
  try{
    if(!window.showSaveFilePicker) throw 0;
    if(!fileHandle){ fileHandle=await window.showSaveFilePicker({suggestedName:'horntail_stages.json',types:[{description:'JSON',accept:{'application/json':['.json']}}]}); }
    const w=await fileHandle.createWritable(); await w.write(data); await w.close();
    dirty=false; showToast('已存檔（覆蓋）');
  }catch(e){ if(e&&e.name==='AbortError') return; exportJSON(); }
}
function loadBoardObj(o){ if(!o) return false;
  if(Array.isArray(o.STAGES)){ STAGES.length=0; o.STAGES.forEach(s=>STAGES.push(s)); }
  if(Array.isArray(o.GLOBAL_ZONES)){ GLOBAL_ZONES.length=0; o.GLOBAL_ZONES.forEach(z=>GLOBAL_ZONES.push(z)); }
  migrate(); clearRoles(); rebuildSteps(); cur=Math.max(0,Math.min(cur,STAGES.length-1)); sel=null; render(cur); renderEditor(); return true; }
document.getElementById('importFile').onchange=ev=>{ const f=ev.target.files[0]; if(!f) return;
  const rd=new FileReader(); rd.onload=()=>{ const txt=String(rd.result||''); let o=null;
    try{ o=JSON.parse(txt); }
    catch(e){ const m=txt.match(/<script[^>]*id=["']board-data["'][^>]*>([\s\S]*?)<\/script>/i); if(m){ try{ o=JSON.parse(m[1]); }catch(_){} } }
    if(o && loadBoardObj(o)){ showToast('已讀取'); } else { alert('讀取失敗：這不是有效的戰術板檔（請選 .json，或本工具存出的 .html）'); }
  };
  rd.readAsText(f); ev.target.value=''; };

/* ---------- 存成「檢視版 HTML」：自含圖片，雙擊即看；回網站可再讀取續編 ---------- */
function loadImg(src){ return new Promise((res,rej)=>{ const im=new Image(); im.crossOrigin='anonymous'; im.onload=()=>res(im); im.onerror=()=>rej(new Error('img')); im.src=src; }); }
async function imgToData(src,maxW,q){ const im=await loadImg(src); let w=im.naturalWidth||maxW||64, h=im.naturalHeight||w;
  if(maxW&&w>maxW){ h=Math.round(h*maxW/w); w=maxW; }
  const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(im,0,0,w,h); return c.toDataURL('image/jpeg',q||0.82); }
async function bakeImages(){ const map=await imgToData('assets/map.jpg',1280,0.72);
  const jobs={}; for(const k in ROLES){ try{ jobs[k]=await imgToData(ROLES[k].f,96,0.85); }catch(e){ jobs[k]=''; } } return {map,jobs}; }
function buildViewHTML(board,imgs){
  const names={}; for(const k in ROLES) names[k]=ROLES[k].n;
  const dataJSON=JSON.stringify(board).replace(/<\//g,'<\\/');
  const css="*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,'Microsoft JhengHei','PingFang TC',sans-serif;background:linear-gradient(180deg,#081320,#0e2138);color:#e6f1ff;min-height:100vh;padding:16px}.vwrap{max-width:1180px;margin:0 auto}.vhd{display:flex;align-items:center;gap:8px;padding:2px 2px 12px}.vti{font-weight:900;font-size:20px;color:#7dd3fc}.vti .vv{font-size:.58em;opacity:.6;font-weight:700}.vmn{display:flex;gap:14px;align-items:stretch}.vac{flex:1 1 auto;min-width:0}@media(max-width:780px){.vmn{flex-direction:column}}"
    +".ar{position:relative;width:100%;aspect-ratio:1661/1077;border-radius:14px;overflow:hidden;border:2px solid #1e3a5f;background:#0b1320}.ar .mp{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.wm{position:absolute;right:7px;bottom:6px;z-index:9;font-size:11px;font-weight:700;color:rgba(255,255,255,.55);text-shadow:0 1px 2px #000}"
    +".ro{position:absolute;transform:translate(-50%,-50%);z-index:8;text-align:center;transition:left .9s cubic-bezier(.5,.05,.3,1),top .9s cubic-bezier(.5,.05,.3,1)}.av{width:38px;height:38px;border-radius:8px;overflow:hidden;border:2px solid #fff;box-shadow:0 2px 7px #000b}.av img{width:100%;height:100%;object-fit:cover;display:block}.nn{font-size:10px;font-weight:800;color:#fff;text-shadow:0 1px 2px #000,0 0 4px #000}.lb{font-size:9px;font-weight:800;color:#fde047;text-shadow:0 1px 2px #000}"
    +".mk{position:absolute;transform:translate(-50%,-50%);aspect-ratio:1;z-index:5}.mk.O{border:4px solid #fde047;border-radius:50%;box-shadow:0 0 14px 2px #fde04766}.mk.X svg{width:100%;height:100%}.mk.X line{stroke:#ff5a4f;stroke-width:2.2;stroke-linecap:round}.mk .on{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#fde047;font-weight:900;text-shadow:0 1px 3px #000}"
    +".zo{position:absolute;transform:translate(-50%,-50%);border-radius:10px;z-index:3;display:flex;align-items:flex-start;justify-content:center;padding-top:3px;font-size:11px;font-weight:800}.zo.green{background:#22c55e2e;border:2px dashed #22c55e}.zo.red{background:#ef44442e;border:2px dashed #ef4444}.zo.smoke{background:#12141bb0;border:2px dashed #475569;z-index:4}.zo span{color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;background:rgba(0,0,0,.34);padding:1px 6px;border-radius:5px}"
    +".tx{position:absolute;transform:translate(-50%,-50%);color:#fff;font-weight:800;text-shadow:0 1px 2px #000,0 0 5px #000;white-space:nowrap;z-index:7;text-align:center}"
    +".zt{display:flex;gap:8px;justify-content:center;margin:8px 0}.zt button{background:#13314f;color:#cfe8ff;border:1px solid #335f8c;border-radius:8px;padding:5px 12px;font-weight:700;cursor:pointer;opacity:.5}.zt button.on{opacity:1}"
    +".ct{display:flex;gap:8px;align-items:center;justify-content:center;margin:8px 0;flex-wrap:wrap}.ct button{background:#13314f;color:#cfe8ff;border:1px solid #335f8c;border-radius:9px;padding:8px 14px;font-weight:700;cursor:pointer}.st{display:flex;gap:7px;flex-wrap:wrap}.dt{width:14px;height:14px;border-radius:50%;background:#33597f;color:#0a1626;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;cursor:pointer}.dt.on{background:#38bdf8;box-shadow:0 0 8px #38bdf8}"
    +".pn{flex:0 0 300px;background:#10243b;border:1px solid #1f3b5c;border-radius:12px;padding:14px 16px;overflow:auto}@media(max-width:780px){.pn{flex:1 1 auto}}.pt{font-size:18px;font-weight:800;color:#e8eef6;margin-bottom:8px}.pl{list-style:none}.pl li{font-size:14px;line-height:1.7;padding-left:18px;position:relative;color:#dbeafe}.pl li:before{content:'\\203A';position:absolute;left:2px;color:#38bdf8;font-weight:900}.pl li.warn:before{content:'!';color:#fca5a5}.pl li.safe:before{content:'\\2713';color:#86efac}";
  const js="var B=JSON.parse(document.getElementById('board-data').textContent);var S=B.STAGES||[],GZ=B.GLOBAL_ZONES||[];var cur=0,zr=true,zg=true;var ar=document.getElementById('ar');"
    +"function rp(v){if(Array.isArray(v)&&v.length&&Array.isArray(v[0]))return v;if(Array.isArray(v)&&typeof v[0]==='number')return[v];return[];}"
    +"function rd(i){[].slice.call(ar.querySelectorAll('.ro,.mk,.zo,.tx')).forEach(function(e){e.remove();});var st=S[i];"
    +"for(var k in st.pos){if(!NM[k])continue;rp(st.pos[k]).forEach(function(p){var d=document.createElement('div');d.className='ro';d.style.left=p[0]+'%';d.style.top=p[1]+'%';d.innerHTML='<div class=\"av\"><img src=\"'+(IMG[k]||'')+'\"></div><div class=\"nn\">'+NM[k]+'</div>'+(p[2]?'<div class=\"lb\">'+p[2]+'</div>':'');ar.appendChild(d);});}"
    +"(st.marks||[]).forEach(function(m){var d=document.createElement('div');d.className='mk '+m.kind;d.style.left=m.x+'%';d.style.top=m.y+'%';d.style.width=(m.r*2)+'%';if(m.kind==='X')d.innerHTML='<svg viewBox=\"0 0 10 10\"><line x1=\"1.6\" y1=\"1.6\" x2=\"8.4\" y2=\"8.4\"/><line x1=\"8.4\" y1=\"1.6\" x2=\"1.6\" y2=\"8.4\"/></svg>';if(m.label){var s=document.createElement('span');s.className='on';s.textContent=m.label;s.style.fontSize=((ar.clientWidth||700)*(m.r*2/100)*0.55)+'px';d.appendChild(s);}ar.appendChild(d);});"
    +"(st.zones||[]).forEach(function(z){var d=document.createElement('div');d.className='zo '+z.kind;d.style.left=z.x+'%';d.style.top=z.y+'%';d.style.width=z.w+'%';d.style.height=z.h+'%';d.innerHTML=(z.kind==='smoke'&&!z.t)?'<span>\\uD83D\\uDCA8</span>':'<span>'+(z.t||'')+'</span>';ar.appendChild(d);});"
    +"GZ.forEach(function(z){if(z.kind==='red'&&!zr)return;if(z.kind==='green'&&!zg)return;var d=document.createElement('div');d.className='zo '+z.kind;d.style.left=z.x+'%';d.style.top=z.y+'%';d.style.width=z.w+'%';d.style.height=z.h+'%';d.innerHTML='<span>'+(z.t||'')+'</span>';ar.appendChild(d);});"
    +"(st.texts||[]).forEach(function(t){var d=document.createElement('div');d.className='tx';d.style.left=t.x+'%';d.style.top=t.y+'%';d.style.fontSize=(t.size||16)+'px';d.style.color=t.color||'#fff';d.textContent=t.t||'';ar.appendChild(d);});"
    +"document.getElementById('pnm').textContent=st.name||'';var ul=document.getElementById('pl');ul.innerHTML='';(st.notes||[]).forEach(function(n){var li=document.createElement('li');if(n[0])li.className=n[0];li.textContent=n[1];ul.appendChild(li);});"
    +"[].slice.call(document.getElementById('st').children).forEach(function(d,j){d.classList.toggle('on',j===i);});}"
    +"function go(i){cur=Math.max(0,Math.min(S.length-1,i));rd(cur);}"
    +"S.forEach(function(s,i){var d=document.createElement('div');d.className='dt';d.textContent=i;d.title=s.name;d.onclick=function(){go(i);};document.getElementById('st').appendChild(d);});"
    +"document.getElementById('nx').onclick=function(){go(cur+1);};document.getElementById('pv').onclick=function(){go(cur-1);};"
    +"document.getElementById('tr').onclick=function(){zr=!zr;this.classList.toggle('on',zr);rd(cur);};document.getElementById('tg').onclick=function(){zg=!zg;this.classList.toggle('on',zg);rd(cur);};"
    +"document.addEventListener('keydown',function(e){if(e.key==='ArrowRight')go(cur+1);else if(e.key==='ArrowLeft')go(cur-1);});go(0);";
  return '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>闇黑龍王 戰術板（檢視）</title><style>'+css+'</style></head><body>'
    +'<div class="vwrap"><div class="vhd"><span style="font-size:22px">🐲</span><div class="vti">闇黑龍王 戰術板 <span class="vv">檢視版</span></div></div>'
    +'<div class="vmn"><div class="vac"><div class="ar" id="ar"><img class="mp" src="'+imgs.map+'" alt="map" draggable="false"><div class="wm">作者：Artale繁中服-爸爸</div></div>'
    +'<div class="zt"><button id="tr" class="on">危險區</button><button id="tg" class="on">安全區</button></div>'
    +'<div class="ct"><button id="pv">◀ 上一階段</button><div class="st" id="st"></div><button id="nx">下一階段 ▶</button></div></div>'
    +'<div class="pn"><div class="pt"><span id="pnm"></span></div><ul class="pl" id="pl"></ul></div></div></div>'
    +'<script id="board-data" type="application/json">'+dataJSON+'<\/script>'
    +'<script>var IMG='+JSON.stringify(imgs.jobs)+',NM='+JSON.stringify(names)+';'+js+'<\/script></body></html>';
}
let htmlHandle=null;
async function saveAsHTML(){
  showToast('產生檔案中…');
  let imgs; try{ imgs=await bakeImages(); }catch(e){ alert('產生圖片失敗：本機 file:// 直接開會受瀏覽器限制，請在線上版（網址）操作。'); return; }
  const html=buildViewHTML({version:1,STAGES,GLOBAL_ZONES}, imgs); const fname='闇黑龍王戰術板.html';
  try{ if(window.showSaveFilePicker){
      if(!htmlHandle){ htmlHandle=await window.showSaveFilePicker({suggestedName:fname,types:[{description:'HTML',accept:{'text/html':['.html']}}]}); }
      const w=await htmlHandle.createWritable(); await w.write(html); await w.close(); dirty=false; showToast('已存檔（檢視版 HTML）'); return;
  } }catch(e){ if(e&&e.name==='AbortError') return; }
  const blob=new Blob([html],{type:'text/html'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=fname; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); dirty=false; showToast('已下載檢視版 HTML');
}
function b64enc(str){ return btoa(unescape(encodeURIComponent(str))); }
function b64dec(b){ return decodeURIComponent(escape(atob(b))); }
function bytesToB64url(bytes){ let bin=''; for(let i=0;i<bytes.length;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function b64urlToBytes(s){ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; const bin=atob(s); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return a; }
async function gzipStr(str){ const cs=new CompressionStream('gzip'); const ab=await new Response(new Blob([new TextEncoder().encode(str)]).stream().pipeThrough(cs)).arrayBuffer(); return new Uint8Array(ab); }
async function gunzipBytes(bytes){ const ds=new DecompressionStream('gzip'); const ab=await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer(); return new TextDecoder().decode(ab); }
async function resolveHash(){ const h=location.hash||'';
  let m=h.match(/^#(vz|dz)=(.+)$/);
  if(m){ try{ const json=await gunzipBytes(b64urlToBytes(m[2])); return {mode:m[1]==='vz'?'view':'data', board:JSON.parse(json)}; }catch(e){ return null; } }
  m=h.match(/^#(view|data)=(.+)$/);
  if(m){ try{ return {mode:m[1], board:JSON.parse(b64dec(m[2]))}; }catch(e){ return null; } }
  return null;
}
async function shareLink(){ const json=JSON.stringify({version:1,STAGES,GLOBAL_ZONES}); const base=location.origin+location.pathname;
  let url=null;
  try{ if(window.CompressionStream){ const z=await gzipStr(json); const enc=bytesToB64url(z); if(enc.length < b64enc(json).length) url=base+'#vz='+enc; } }catch(e){}
  if(!url) url=base+'#view='+b64enc(json);
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(()=>showToast('唯讀分享連結已複製'+(url.indexOf('#vz=')>0?'（已壓縮縮短）':'')),()=>prompt('複製此唯讀連結：',url)); } else prompt('複製此唯讀連結：',url);
}

/* ---------- 存稿 + 復原/重做 ---------- */
let saveTimer=null, undoStack=[], redoStack=[], lastSnap=null, restoring=false;
function boardJSON(){ return JSON.stringify({version:1,STAGES,GLOBAL_ZONES}); }
function save(){ dirty=true; clearTimeout(saveTimer); saveTimer=setTimeout(()=>{
  if(!restoring){ const c=boardJSON(); if(lastSnap!==null && c!==lastSnap){ undoStack.push(lastSnap); if(undoStack.length>80) undoStack.shift(); redoStack.length=0; updateHistBtns(); } lastSnap=c; }
  try{ localStorage.setItem('horntail_board', boardJSON()); }catch(e){}
},400); }
function updateHistBtns(){ const u=document.getElementById('undoBtn'),r=document.getElementById('redoBtn'); if(u)u.disabled=!undoStack.length; if(r)r.disabled=!redoStack.length; }
function applySnap(s){ try{ applyBoard(JSON.parse(s)); }catch(e){ return; } migrate(); clearRoles(); cur=Math.max(0,Math.min(cur,STAGES.length-1)); sel=null; rebuildSteps(); render(cur); if(editMode) renderEditor(); }
function undo(){ if(!undoStack.length){ showToast('沒有可復原的動作'); return; } redoStack.push(boardJSON()); const s=undoStack.pop();
  restoring=true; lastSnap=s; applySnap(s); try{ localStorage.setItem('horntail_board',s); }catch(e){} restoring=false; updateHistBtns(); showToast('↩︎ 已復原'); }
function redo(){ if(!redoStack.length){ showToast('沒有可重做的動作'); return; } undoStack.push(boardJSON()); const s=redoStack.pop();
  restoring=true; lastSnap=s; applySnap(s); try{ localStorage.setItem('horntail_board',s); }catch(e){} restoring=false; updateHistBtns(); showToast('↪︎ 已重做'); }

/* ---------- 刪除 / 複製 選取物件 ---------- */
function deleteSelected(){ if(!sel) return; const st=STAGES[cur];
  if(sel.type==='role'){ const a=st.pos[sel.key]; if(a){ a.splice(sel.inst,1); if(!a.length) delete st.pos[sel.key]; } }
  else if(sel.type==='mark'){ (st.marks||[]).splice(sel.index,1); }
  else if(sel.type==='zone'){ (st.zones||[]).splice(sel.index,1); }
  else if(sel.type==='text'){ (st.texts||[]).splice(sel.index,1); }
  sel=null; render(cur); renderEditor(); save(); showToast('已刪除'); }
function duplicateSelected(){ if(!sel) return; const st=STAGES[cur];
  if(sel.type==='role'){ const a=st.pos[sel.key]; const p=a&&a[sel.inst]; if(!p) return; a.push([clamp01(p[0]+4),clamp01(p[1]+4),p[2]||'']); sel={type:'role',key:sel.key,inst:a.length-1}; }
  else if(sel.type==='mark'){ const m=st.marks[sel.index]; st.marks.push(Object.assign({},m,{x:clamp01(m.x+4),y:clamp01(m.y+4)})); sel={type:'mark',index:st.marks.length-1}; }
  else if(sel.type==='zone'){ const z=st.zones[sel.index]; st.zones.push(Object.assign({},z,{x:clamp01(z.x+4),y:clamp01(z.y+4)})); sel={type:'zone',index:st.zones.length-1}; }
  else if(sel.type==='text'){ const t=st.texts[sel.index]; st.texts.push(Object.assign({},t,{x:clamp01(t.x+4),y:clamp01(t.y+4)})); sel={type:'text',index:st.texts.length-1}; }
  render(cur); renderEditor(); save(); showToast('已複製一份'); }

/* ---------- 操作說明 ---------- */
const helpEl=document.getElementById('help');
function openHelp(){ helpEl.classList.add('show'); }
function closeHelp(){ helpEl.classList.remove('show'); }
document.getElementById('helpBtn').onclick=openHelp;
document.getElementById('undoBtn').onclick=undo;
document.getElementById('redoBtn').onclick=redo;
document.getElementById('helpClose').onclick=closeHelp;
helpEl.addEventListener('click',e=>{ if(e.target===helpEl) closeHelp(); });
function applyBoard(o){ if(Array.isArray(o.STAGES)){ STAGES.length=0; o.STAGES.forEach(s=>STAGES.push(s)); } if(Array.isArray(o.GLOBAL_ZONES)){ GLOBAL_ZONES.length=0; o.GLOBAL_ZONES.forEach(z=>GLOBAL_ZONES.push(z)); } }
function loadSaved(){ try{ const s=localStorage.getItem('horntail_board'); if(s){ const o=JSON.parse(s); if(Array.isArray(o.STAGES)&&o.STAGES.length){ applyBoard(o); return true; } } }catch(e){} return false; }

/* ---------- 階段管理 ---------- */
function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }
function inheritPrev(){ if(cur<=0){ showToast('已是第一階段，沒有上一階段可沿用'); return; }
  const prev=STAGES[cur-1], st=STAGES[cur];
  const had=Object.keys(st.pos||{}).length;
  if(had && !confirm('用「上一階段」的職業站位覆蓋這一階段？（標記與說明不變）')) return;
  st.pos=deepCopy(prev.pos||{});
  sel=null; render(cur); renderEditor(); save(); showToast('已沿用上一階段站位');
}
function dupStage(){ const c=deepCopy(STAGES[cur]); c.name=(c.name||'')+' (複製)'; STAGES.splice(cur+1,0,c); cur=cur+1; rebuildSteps(); render(cur); renderEditor(); save(); }
function addStage(){ STAGES.splice(cur+1,0,{name:'新階段',color:'#38bdf8',marks:[],zones:[],pos:{},notes:[['','說明']]}); cur=cur+1; rebuildSteps(); render(cur); renderEditor(); save(); }
function delStage(){ if(STAGES.length<=1){ showToast('至少保留一個階段'); return; } if(!confirm('刪除目前階段？')) return; STAGES.splice(cur,1); cur=Math.max(0,Math.min(cur,STAGES.length-1)); sel=null; rebuildSteps(); render(cur); renderEditor(); save(); }
function moveStage(d){ const j=cur+d; if(j<0||j>=STAGES.length){ showToast('已到邊界'); return; } const t=STAGES[cur]; STAGES[cur]=STAGES[j]; STAGES[j]=t; cur=j; rebuildSteps(); render(cur); renderEditor(); save(); }
function resetBoard(){ if(!confirm('清除存稿並還原預設範本？')) return; try{ localStorage.removeItem('horntail_board'); }catch(e){} applyBoard(deepCopy(DEFAULT_BOARD)); migrate(); clearRoles(); cur=0; sel=null; rebuildSteps(); render(cur); renderEditor(); showToast('已重設為預設'); }

/* ---------- 編輯模式切換 ---------- */
/* ---------- 模式切換（檢視 / 編輯） ---------- */
const modeSwitch=document.getElementById('modeSwitch');
function setEdit(on){ editMode=on; app.classList.toggle('edit',on);
  modeSwitch.querySelectorAll('button').forEach(b=>b.classList.toggle('on',(b.dataset.mode==='edit')===on));
  if(!on) sel=null;
  render(cur); renderEditor();
  showToast(on?'已進入編輯模式：拖曳圖示移動、點物件可調整':'已切回檢視模式'); }
modeSwitch.querySelectorAll('button').forEach(b=>{ b.onclick=()=>{ if((b.dataset.mode==='edit')!==editMode) setEdit(b.dataset.mode==='edit'); }; });
document.getElementById('shareBtn').onclick=shareLink;
document.getElementById('pngBtn').onclick=exportPNG;
document.getElementById('pngAllBtn').onclick=exportAllPNG;
(function(){
  const rb=document.getElementById('toggleRed'), gb=document.getElementById('toggleGreen');
  function sync(){ rb.classList.toggle('on',zoneVis.red); rb.setAttribute('aria-pressed',zoneVis.red);
    gb.classList.toggle('on',zoneVis.green); gb.setAttribute('aria-pressed',zoneVis.green);
    try{ localStorage.setItem('horntail_zonevis',JSON.stringify(zoneVis)); }catch(e){} }
  rb.onclick=()=>{ zoneVis.red=!zoneVis.red; sync(); render(cur); };
  gb.onclick=()=>{ zoneVis.green=!zoneVis.green; sync(); render(cur); };
  sync();
})();
document.getElementById('saveBtn').onclick=saveAsHTML;
document.getElementById('loadBtn').onclick=()=>document.getElementById('importFile').click();
window.addEventListener('beforeunload',e=>{ if(dirty){ e.preventDefault(); e.returnValue=''; } });
arena.addEventListener('pointerdown',e=>{ if(editMode && (e.target===arena||e.target.classList.contains('map')) && sel){ sel=null; refreshSel(); } });

/* ---------- 啟動 ---------- */
let readOnly=false;
try{ applySkin(localStorage.getItem('horntail_skin')||'skin-b'); }catch(e){ applySkin('skin-b'); }
(function(){ const el=document.getElementById('ptName');
  el.addEventListener('input',()=>{ if(!editMode) return; STAGES[cur].name=el.textContent; save(); });
  el.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); el.blur(); } });
  el.addEventListener('blur',()=>{ if(editMode) renderEditor(); });
})();
/* ---------- 空白範本引導 ---------- */
function isBoardEmpty(){ return STAGES.every(s=> (!s.marks||!s.marks.length)&&(!s.zones||!s.zones.length)&&(!s.texts||!s.texts.length)&&Object.keys(s.pos||{}).length===0 ); }
let emptyHintEl=null;
function updateEmptyHint(){
  const show = !readOnly && !editMode && isBoardEmpty();
  if(show){
    if(!document.getElementById('eh-style')){ const s=document.createElement('style'); s.id='eh-style';
      s.textContent='.empty-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:12;background:rgba(8,12,20,.5)}.eh-card{background:#10243bee;border:1px solid #2c4a6b;border-radius:14px;padding:18px 22px;text-align:center;max-width:82%;box-shadow:0 8px 30px #000a}.eh-t{font-size:18px;font-weight:900;color:#e8eef6;margin-bottom:4px}.eh-s{font-size:13px;color:#9fb6cf;margin-bottom:14px}.eh-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.eh-b{padding:9px 16px;border-radius:10px;border:1px solid #335f8c;background:#16324d;color:#cfe8ff;font-weight:700;font-size:14px;cursor:pointer}.eh-b.primary{background:#38bdf8;border-color:#38bdf8;color:#04263b}.eh-b:hover{filter:brightness(1.12)}';
      document.head.appendChild(s); }
    if(!emptyHintEl){ emptyHintEl=document.createElement('div'); emptyHintEl.className='empty-hint';
      const card=document.createElement('div'); card.className='eh-card';
      card.innerHTML='<div class="eh-t">這是空白範本</div><div class="eh-s">讀取現成的檔案，或進編輯模式開始排自己的走位</div>';
      const bs=document.createElement('div'); bs.className='eh-btns';
      const b1=document.createElement('button'); b1.type='button'; b1.className='eh-b primary'; b1.textContent='📂 讀取檔案'; b1.onclick=()=>document.getElementById('importFile').click();
      const b2=document.createElement('button'); b2.type='button'; b2.className='eh-b'; b2.textContent='✏ 開始建立'; b2.onclick=()=>setEdit(true);
      bs.append(b1,b2); card.appendChild(bs); emptyHintEl.appendChild(card); arena.appendChild(emptyHintEl);
    }
    emptyHintEl.style.display='flex';
  } else if(emptyHintEl){ emptyHintEl.style.display='none'; }
}
(async function boot(){
  const _hash=await resolveHash();
  if(_hash&&_hash.board&&Array.isArray(_hash.board.STAGES)){ applyBoard(_hash.board); readOnly=(_hash.mode==='view'); }
  else { loadSaved(); }
  if(readOnly){ modeSwitch.style.display='none'; document.getElementById('shareBtn').style.display='none'; app.classList.add('readonly');
    const bt=document.querySelector('.brand-tx'); if(bt){ const tag=document.createElement('span'); tag.className='ro-badge'; tag.textContent='🔒 唯讀檢視'; bt.appendChild(tag); }
  }
  migrate();
  rebuildSteps();
  lastSnap=boardJSON();
  go(0);
})();
