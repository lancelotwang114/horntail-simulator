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
const DEFAULT_BOARD=JSON.parse(JSON.stringify({STAGES,GLOBAL_ZONES}));
const Xsvg='<svg viewBox="0 0 10 10" class="xmark"><line x1="1.6" y1="1.6" x2="8.4" y2="8.4"/><line x1="8.4" y1="1.6" x2="1.6" y2="8.4"/></svg>';

function roleId(k,inst){ return k+'#'+inst; }
function toPairs(v){ if(Array.isArray(v)&&v.length&&Array.isArray(v[0])) return v; if(Array.isArray(v)&&typeof v[0]==='number') return [v]; return []; }
function migrate(){ STAGES.forEach(st=>{ const p=st.pos||(st.pos={});
  for(const k in p) p[k]=toPairs(p[k]);
  [['hero','hero2'],['fa','fa2'],['long','long2']].forEach(([base,clone])=>{ if(p[clone]){ p[base]=(p[base]||[]).concat(p[clone]); delete p[clone]; } });
}); }
function clearRoles(){ for(const id in roleEls) roleEls[id].remove(); roleEls={}; }

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
    const _l=e.querySelector('.lbl'), _t=(o.xy[2]||''); _l.textContent=_t; _l.style.display=_t?'block':'none';
    e.style.left=o.xy[0]+'%'; e.style.top=o.xy[1]+'%'; e.style.opacity=1; e.style.pointerEvents=editMode?'auto':'none';
    e.classList.toggle('sel', !!(editMode&&sel&&sel.type==='role'&&sel.key===o.k&&sel.inst===o.inst));
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
    d.innerHTML='<span>'+(z.t||'')+'</span>';
    if(editMode){ d.classList.add('editable'); if(sel&&sel.type==='zone'&&sel.index===idx) d.classList.add('sel');
      attachDrag(d,(x,y)=>{z.x=x;z.y=y;d.style.left=x+'%';d.style.top=y+'%';},save,()=>selectItem('zone',idx)); }
    arena.appendChild(d); zoneEls.push(d); });
  GLOBAL_ZONES.forEach(z=>{ const d=document.createElement('div'); d.className='zone '+z.kind;
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
    const move=ev=>{ const px=((ev.clientX-r.left)/r.width)*100; const py=((ev.clientY-r.top)/r.height)*100; apply(px,py,r.height,r.width); };
    const up=()=>{ h.releasePointerCapture(e.pointerId); h.removeEventListener('pointermove',move); h.removeEventListener('pointerup',up); save(); };
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
  if(sel.type!=='role'&&sel.type!=='text'){ const m=mk('－',()=>resizeSel(-1)); m.title='縮小'; const p=mk('＋',()=>resizeSel(1)); p.title='放大'; bar.append(m,p); }
  if(sel.type==='text'){ const tx=STAGES[cur].texts&&STAGES[cur].texts[sel.index];
    const c=document.createElement('input'); c.type='color'; c.className='sb-col'; c.title='文字顏色'; c.value=(tx&&tx.color)||'#ffffff';
    c.onpointerdown=e=>e.stopPropagation(); c.oninput=e=>{ e.stopPropagation(); if(tx){ tx.color=c.value; const el2=selEl(); if(el2) el2.style.color=c.value; save(); } };
    bar.append(c); }
  const d=mk('⧉',duplicateSelected,'dup'); d.title='複製一份'; const x=mk('🗑',deleteSelected,'del'); x.title='刪除';
  bar.append(d,x);
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
  for(const id in roleEls){ const el=roleEls[id]; el.classList.toggle('sel', !!(sel&&sel.type==='role'&&sel.key===el.dataset.k&&+el.dataset.inst===sel.inst)); }
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
    const k=ev.dataTransfer.getData('text/role'); if(!k||!ROLES[k]) return; ev.preventDefault();
    const r=arena.getBoundingClientRect(); const x=clamp01((ev.clientX-r.left)/r.width*100); const y=clamp01((ev.clientY-r.top)/r.height*100);
    const st2=STAGES[cur]; (st2.pos[k]=st2.pos[k]||[]).push([x,y]); sel={type:'role',key:k,inst:st2.pos[k].length-1}; render(cur); renderEditor(); save(); showToast(ROLES[k].n+' 已放到 '+x+'%, '+y+'%'); });
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
  if(!editMode) return;
  const st=STAGES[cur]; const box=document.getElementById('editor'); box.innerHTML='';

  // 標題列
  const head=document.createElement('div'); head.className='ed-head';
  head.innerHTML='<div class="ed-title"><span class="ed-ico">🛠</span>排站位編輯器</div>'
    +'<div class="ed-hint">拖曳職業／標記移動　·　方向鍵微調（Shift 大步）　·　Delete 刪除、Ctrl+D 複製　·　Esc 取消選取</div>';
  const tools=document.createElement('div'); tools.className='ed-tools';
  const ub=ebtn('↩︎ 復原',undo,'ed-tool'); ub.id='undoBtn'; ub.disabled=!undoStack.length;
  const rb=ebtn('↪︎ 重做',redo,'ed-tool'); rb.id='redoBtn'; rb.disabled=!redoStack.length;
  const done=document.createElement('button'); done.className='ed-done'; done.textContent='✓ 完成編輯'; done.onclick=()=>setEdit(false);
  tools.append(ub,rb,done); head.appendChild(tools); box.appendChild(head);

  const grid=document.createElement('div'); grid.className='ed-grid'; box.appendChild(grid);
  function sec(badge,title,hint,opts){ opts=opts||{};
    const w=document.createElement('div'); w.className='ed-sec'+(opts.wide?' wide':'')+(opts.sel?' sel-sec':'');
    const h=document.createElement('div'); h.className='ed-sec-h';
    h.innerHTML='<span class="ed-badge">'+badge+'</span><span class="ed-sec-t">'+title+'</span>';
    w.appendChild(h);
    if(hint){ const hh=document.createElement('div'); hh.className='ed-sec-hint'; hh.textContent=hint; w.appendChild(hh); }
    const b=document.createElement('div'); b.className='ed-row'+(opts.col?' col':''); w.appendChild(b);
    grid.appendChild(w); return b;
  }

  // ① 本階段
  const b1=sec('1','本階段','標題請直接點右側大標修改；這裡改代表色、調整流程順序');
  const cl=document.createElement('div'); cl.className='sel-ctl';
  const cll=document.createElement('span'); cll.className='lab'; cll.textContent='代表色';
  const col=document.createElement('input'); col.type='color'; col.value=toHex(st.color); col.title='階段代表色';
  col.oninput=()=>{ st.color=col.value; renderTitle(); save(); };
  cl.append(cll,col);
  b1.append(cl,
    ebtn('⧉ 複製這頁',dupStage,'b-move'), ebtn('＋ 新增一頁',addStage,'b-add'), ebtn('🗑 刪除這頁',delStage,'b-del'),
    ebtn('◀ 上移',()=>moveStage(-1),'b-move'), ebtn('▶ 下移',()=>moveStage(1),'b-move'), ebtn('↻ 還原預設範本',resetBoard,'b-del'));

  // ② 職業站位
  initArenaDrop();
  const b2=sec('2','職業站位','點 ＋ 放到場上中央，或把圖示直接拖到地圖定位；同職業可放多個（×2），點 － 移除。');
  const jwrap=document.createElement('div'); jwrap.className='jchips'; b2.appendChild(jwrap);
  for(const k in ROLES){ const n=(st.pos[k]?st.pos[k].length:0);
    const c=document.createElement('div'); c.className='jchip'+(n?' on':'');
    const ic=document.createElement('img'); ic.className='jchip-ic'; ic.src=ROLES[k].f; ic.alt=ROLES[k].n; ic.draggable=true; ic.title='拖到地圖放置';
    ic.addEventListener('dragstart',ev=>{ ev.dataTransfer.setData('text/role',k); ev.dataTransfer.effectAllowed='copy'; });
    const nm2=document.createElement('span'); nm2.className='jchip-n'; nm2.textContent=ROLES[k].n;
    c.append(ic,nm2);
    if(n>1){ const ct=document.createElement('span'); ct.className='jchip-ct'; ct.textContent='×'+n; c.appendChild(ct); }
    const sp=document.createElement('div'); sp.className='jchip-sp';
    const minus=document.createElement('button'); minus.className='jchip-b minus'; minus.textContent='－'; minus.title='移除一個'; minus.disabled=!n;
    minus.onclick=()=>{ if(st.pos[k]&&st.pos[k].length){ st.pos[k].pop(); if(!st.pos[k].length) delete st.pos[k]; render(cur); renderEditor(); save(); } };
    const plus=document.createElement('button'); plus.className='jchip-b plus'; plus.textContent='＋'; plus.title='放到場上';
    plus.onclick=()=>{ (st.pos[k]=st.pos[k]||[]).push([50,50]); sel={type:'role',key:k,inst:st.pos[k].length-1}; render(cur); renderEditor(); save(); };
    sp.append(minus,plus); c.appendChild(sp);
    jwrap.appendChild(c); }

  // ③ 場上標記
  const b3=sec('3','場上標記','點一下加到場中央，再拖到定位；選取後可用「大小／位置」按鈕或方向鍵微調。');
  function mkTile(cls,glyph,label,fn,title){ const t=document.createElement('button'); t.className='mk-tile'; t.onclick=fn; if(title)t.title=title;
    const p=document.createElement('span'); p.className='mk-prev '+cls; if(glyph)p.textContent=glyph; t.append(p);
    if(label){ const l=document.createElement('span'); l.textContent=label; t.append(l); } return t; }
  b3.append(
    mkTile('o','','',()=>{ (st.marks=st.marks||[]).push({kind:'O',x:50,y:50,r:4}); sel={type:'mark',index:st.marks.length-1}; render(cur); renderEditor(); save(); },'加目標〇'),
    mkTile('x','✕','',()=>{ (st.marks=st.marks||[]).push({kind:'X',x:50,y:50,r:4}); sel={type:'mark',index:st.marks.length-1}; render(cur); renderEditor(); save(); },'加已斷✕'),
    mkTile('s','','下煙區',()=>{ (st.zones=st.zones||[]).push({kind:'smoke',x:50,y:50,w:15,h:15,t:'下煙區'}); sel={type:'zone',index:st.zones.length-1}; render(cur); renderEditor(); save(); }),
    mkTile('t','T','文字',()=>{ (st.texts=st.texts||[]).push({x:50,y:50,t:'文字',size:22,color:'#ffffff'}); sel={type:'text',index:st.texts.length-1}; render(cur); renderEditor(); save(); focusSelText(true); }));
  b3.append(ebtn('＋ 階段大標到圖上',()=>{ (st.texts=st.texts||[]).push({x:50,y:8,t:st.name,size:40,color:'#ffffff'}); sel={type:'text',index:st.texts.length-1}; render(cur); renderEditor(); save(); showToast('已把階段標題放到圖上，可拖曳／改字級'); },'b-move'));

  // ★ 已選取（依選取類型顯示，含滑鼠也能調的控制）
  if(sel&&sel.type==='role'){ const arr=st.pos[sel.key];
    if(arr&&arr[sel.inst]){ const b=sec('★','已選取職業：'+(ROLES[sel.key]?ROLES[sel.key].n:''),'可加備註（顯示在圖示下方）；用「位置」按鈕或方向鍵移動',{sel:true});
      const li=document.createElement('input'); li.type='text'; li.placeholder='備註／角色名（可空白）'; li.style.minWidth='170px'; li.value=(arr[sel.inst][2]||'');
      li.oninput=()=>{ arr[sel.inst][2]=li.value; render(cur); save(); };
      b.append(li, selMoveCtl(), ebtn('⧉ 複製',duplicateSelected,'b-move'), ebtn('🗑 從場上移除',()=>{ arr.splice(sel.inst,1); if(!arr.length) delete st.pos[sel.key]; sel=null; render(cur); renderEditor(); save(); },'b-del'));
    } else sel=null;
  } else if(sel&&sel.type==='text'){ const arr=st.texts; const obj=arr&&arr[sel.index];
    if(!obj) sel=null; /* 文字改為直接在地圖方塊上編輯：點兩下打字、浮動工具列調色與大小、邊角拖曳縮放 */
  } else if(sel){ const arr=sel.type==='mark'?st.marks:st.zones; const obj=arr&&arr[sel.index];
    if(obj){ const title=sel.type==='mark'?(obj.kind==='O'?'目標':'已斷'):'下煙區';
      const b=sec('★','已選取：'+title, '調整大小與位置；或用圖上的浮動工具列', {sel:true});
      if(sel.type==='zone') b.append(ebtn('改文字',()=>{ const t=prompt('區域文字',obj.t||''); if(t!==null){obj.t=t; render(cur); save();} },'b-move'));
      b.append(selSizeCtl(), selMoveCtl(), ebtn('⧉ 複製',duplicateSelected,'b-move'), ebtn('🗑 刪除',()=>{ arr.splice(sel.index,1); sel=null; render(cur); renderEditor(); save(); },'b-del'));
    } else sel=null; }

  // ④ 存檔・分享（階段說明已移到右側面板直接編輯）
  const b5=sec('4','存檔・分享','存成 JSON 長期保存；分享連結為「唯讀」，隊友只能看不能改');
  b5.append( ebtn('💾 存檔',saveToFile,'b-prime'), ebtn('📂 讀取',()=>document.getElementById('importFile').click(),'b-file'), ebtn('🔗 複製分享連結',shareLink,'b-file') );
  save();
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
document.getElementById('importFile').onchange=ev=>{ const f=ev.target.files[0]; if(!f) return;
  const rd=new FileReader(); rd.onload=()=>{ try{ const o=JSON.parse(rd.result);
    if(Array.isArray(o.STAGES)){ STAGES.length=0; o.STAGES.forEach(s=>STAGES.push(s)); }
    if(Array.isArray(o.GLOBAL_ZONES)){ GLOBAL_ZONES.length=0; o.GLOBAL_ZONES.forEach(z=>GLOBAL_ZONES.push(z)); }
    migrate(); clearRoles(); rebuildSteps(); cur=Math.max(0,Math.min(cur,STAGES.length-1)); sel=null; render(cur); renderEditor(); showToast('已匯入 JSON');
  }catch(err){ alert('JSON 解析失敗：'+err.message); } };
  rd.readAsText(f); ev.target.value=''; };
function b64enc(str){ return btoa(unescape(encodeURIComponent(str))); }
function b64dec(b){ return decodeURIComponent(escape(atob(b))); }
function parseHash(){ const m=(location.hash||'').match(/^#(view|data)=(.+)$/); if(!m) return null; try{ return {mode:m[1], board:JSON.parse(b64dec(m[2]))}; }catch(e){ return null; } }
function shareLink(){ const json=JSON.stringify({version:1,STAGES,GLOBAL_ZONES}); const url=location.origin+location.pathname+'#view='+b64enc(json);
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(()=>showToast('唯讀分享連結已複製'),()=>prompt('複製此唯讀連結：',url)); } else prompt('複製此唯讀連結：',url); }

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
document.getElementById('helpClose').onclick=closeHelp;
helpEl.addEventListener('click',e=>{ if(e.target===helpEl) closeHelp(); });
function applyBoard(o){ if(Array.isArray(o.STAGES)){ STAGES.length=0; o.STAGES.forEach(s=>STAGES.push(s)); } if(Array.isArray(o.GLOBAL_ZONES)){ GLOBAL_ZONES.length=0; o.GLOBAL_ZONES.forEach(z=>GLOBAL_ZONES.push(z)); } }
function loadSaved(){ try{ const s=localStorage.getItem('horntail_board'); if(s){ const o=JSON.parse(s); if(Array.isArray(o.STAGES)&&o.STAGES.length){ applyBoard(o); return true; } } }catch(e){} return false; }

/* ---------- 階段管理 ---------- */
function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }
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
window.addEventListener('beforeunload',e=>{ if(dirty){ e.preventDefault(); e.returnValue=''; } });
arena.addEventListener('pointerdown',e=>{ if(editMode && (e.target===arena||e.target.classList.contains('map')) && sel){ sel=null; refreshSel(); } });

/* ---------- 啟動 ---------- */
let readOnly=false;
try{ applySkin(localStorage.getItem('horntail_skin')||'skin-b'); }catch(e){ applySkin('skin-b'); }
const _hash=parseHash();
if(_hash&&_hash.board&&Array.isArray(_hash.board.STAGES)){ applyBoard(_hash.board); readOnly=(_hash.mode==='view'); }
else { loadSaved(); }
if(readOnly){ modeSwitch.style.display='none'; document.getElementById('shareBtn').style.display='none'; app.classList.add('readonly'); }
migrate();
rebuildSteps();
lastSnap=boardJSON();
(function(){ const el=document.getElementById('ptName');
  el.addEventListener('input',()=>{ if(!editMode) return; STAGES[cur].name=el.textContent; save(); });
  el.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); el.blur(); } });
  el.addEventListener('blur',()=>{ if(editMode) renderEditor(); });
})();
go(0);
