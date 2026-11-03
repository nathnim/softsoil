/* ===================== GIAO DIỆN ===================== */
const $ = s => document.querySelector(s);
const nf = (x, d=2) => (x==null || !isFinite(x)) ? '—' : x.toLocaleString('vi-VN',{minimumFractionDigits:d, maximumFractionDigits:d});
const cm = x => nf(x*100, 1);
const SOILVAR = ['--s0','--s1','--s2','--s3','--s4'];
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function makeSlider(parent, o){
  const row = document.createElement('div'); row.className = 'sl';
  const v = o.get();
  row.innerHTML = `<label for="${o.id}"><span class="lb">${o.label}</span><span class="sy">${o.sym||''}</span></label>
    <div class="ctl"><input type="range" id="${o.id}" min="${o.min}" max="${o.max}" step="${o.step}" value="${v}">
    <input type="number" id="${o.id}_n" min="${o.min}" max="${o.max}" step="${o.step}" value="${v}" aria-label="${o.label}">
    <span class="un">${o.unit||''}</span></div>`;
  const r = row.querySelector('input[type=range]'), n = row.querySelector('input[type=number]');
  r.addEventListener('input', ()=>{ n.value = r.value; o.set(parseFloat(r.value)); o.after&&o.after(); schedule(); });
  n.addEventListener('change', ()=>{ let x = parseFloat(n.value); if (!isFinite(x)) x = o.get(); x = Math.min(o.max, Math.max(o.min, x)); n.value = x; r.value = x; o.set(x); o.after&&o.after(); schedule(); });
  parent.appendChild(row);
  return {row, r, n, sync(){ const x=o.get(); r.value=x; n.value=x; }};
}
function makeCheck(parent, id, label, get, set){
  const w = document.createElement('label'); w.className='chk';
  w.innerHTML = `<input type="checkbox" id="${id}" ${get()?'checked':''}><span>${label}</span>`;
  w.querySelector('input').addEventListener('change', e=>{ set(e.target.checked); schedule(); });
  parent.appendChild(w);
}
function makeSelect(parent, id, label, opts, get, set){
  const w = document.createElement('label'); w.className='sel';
  w.innerHTML = `<span>${label}</span><select id="${id}">${opts.map(([v,t])=>`<option value="${v}" ${get()===v?'selected':''}>${t}</option>`).join('')}</select>`;
  w.querySelector('select').addEventListener('change', e=>{ set(e.target.value); schedule(); });
  parent.appendChild(w);
}
function makeMore(parent, title){
  const d = document.createElement('details'); d.className = 'more';
  d.innerHTML = `<summary>${title}</summary><div class="in"></div>`;
  parent.appendChild(d); return d.querySelector('.in');
}
const P = (obj,k) => ({get:()=>obj[k], set:v=>{obj[k]=v;}});

/* nhóm 1 */
const gE = $('#g-emb');
makeSlider(gE,{id:'H',label:'Chiều cao đắp',sym:'H',unit:'m',min:1,max:10,step:0.1,...P(S,'H')});
makeSlider(gE,{id:'B',label:'Bề rộng mặt nền đường',sym:'B',unit:'m',min:6,max:40,step:0.5,...P(S,'B')});
makeSlider(gE,{id:'m',label:'Độ dốc mái taluy 1 : m',sym:'m',unit:'',min:1,max:3,step:0.25,...P(S,'m')});
makeSlider(gE,{id:'q',label:'Tải trọng xe quy đổi trên mặt',sym:'q',unit:'kPa',min:0,max:30,step:0.5,...P(S,'q')});
const gE2 = makeMore(gE,'Đất đắp (γ, c, φ) và tùy chọn khác');
makeSlider(gE2,{id:'gf',label:'Dung trọng đất đắp',sym:'γđ',unit:'kN/m³',min:16,max:22,step:0.1,...P(S,'gf')});
makeSlider(gE2,{id:'cf',label:'Lực dính đất đắp',sym:'cđ',unit:'kPa',min:0,max:30,step:1,...P(S,'cf')});
makeSlider(gE2,{id:'phif',label:'Góc ma sát đất đắp',sym:'φđ',unit:'°',min:15,max:40,step:0.5,...P(S,'phif')});
makeCheck(gE2,'qSettle','Kể cả tải trọng xe khi tính lún',()=>S.qSettle,v=>S.qSettle=v);

/* nhóm 2: lớp đất */
const LF = [
  {k:'h',label:'Chiều dày',sym:'h',unit:'m',min:0.5,max:20,step:0.5,main:1},
  {k:'cu',label:'Lực dính không thoát nước (cắt cánh)',sym:'cu',unit:'kPa',min:3,max:60,step:0.5,main:1},
  {k:'e0',label:'Hệ số rỗng ban đầu',sym:'e₀',unit:'',min:0.5,max:4,step:0.05,main:1},
  {k:'Cc',label:'Chỉ số nén',sym:'Cc',unit:'',min:0.1,max:2,step:0.01,main:1},
  {k:'cv',label:'Hệ số cố kết đứng',sym:'cv',unit:'m²/năm',min:0.2,max:10,step:0.1,main:1},
  {k:'g',label:'Dung trọng tự nhiên',sym:'γ',unit:'kN/m³',min:13,max:20,step:0.1},
  {k:'phicu',label:'Góc ma sát cố kết – không thoát nước',sym:'φcu',unit:'°',min:0,max:25,step:0.5},
  {k:'Cs',label:'Chỉ số nở',sym:'Cs',unit:'',min:0.01,max:0.3,step:0.005},
  {k:'OCR',label:'Hệ số quá cố kết σ′p/σ′v0',sym:'OCR',unit:'',min:1,max:3,step:0.05},
  {k:'chr',label:'Tỉ số cố kết ngang / đứng',sym:'ch/cv',unit:'',min:1,max:5,step:0.1}
];
let Lslider = null;
function totalD(){ return S.layers.reduce((a,l)=>a+l.h,0); }
function refreshL(oldD){
  const D = totalD();
  if (oldD!=null && S.L >= oldD-1e-6) S.L = D;
  if (S.L > D) S.L = D;
  if (Lslider){ Lslider.r.max = D; Lslider.n.max = D; Lslider.sync(); }
}
function renderLayers(){
  const box = $('#layers'); box.innerHTML = '';
  S.layers.forEach((l,i)=>{
    const c = document.createElement('div'); c.className='layer';
    c.innerHTML = `<div class="lh"><span class="sw" style="background:var(${SOILVAR[i%5]})"></span>
      <input type="text" id="L${i}_name" value="${esc(l.name)}" aria-label="Tên lớp ${i+1}">
      ${S.layers.length>1?`<button class="btn ghost" type="button" aria-label="Xóa lớp ${i+1}">Xóa</button>`:''}</div>`;
    c.querySelector('input[type=text]').addEventListener('input', e=>{ l.name = e.target.value || ('Lớp '+(i+1)); schedule(); });
    const del = c.querySelector('.btn.ghost');
    if (del) del.addEventListener('click', ()=>{ const oD=totalD(); S.layers.splice(i,1); renderLayers(); refreshL(oD); schedule(); });
    const more = document.createElement('div');
    for (const f of LF){
      let oD;
      const parent = f.main ? c : more;
      makeSlider(parent,{id:`L${i}_${f.k}`,label:f.label,sym:f.sym,unit:f.unit,min:f.min,max:f.max,step:f.step,
        get:()=>l[f.k], set:v=>{ oD = totalD(); l[f.k]=v; if(f.k==='Cs'&&l.Cs>l.Cc) l.Cs=l.Cc; },
        after: f.k==='h' ? ()=>refreshL(oD) : null});
    }
    const mi = makeMore(c,'Thông số khác (γ, φcu, Cs, OCR, ch/cv)');
    while (more.firstChild) mi.appendChild(more.firstChild);
    box.appendChild(c);
  });
  $('#addLayer').disabled = S.layers.length >= 5;
}
$('#addLayer').addEventListener('click', ()=>{
  const oD = totalD();
  S.layers.push({name:'Lớp '+(S.layers.length+1), h:3, g:17.5, cu:25, phicu:15, e0:1.0, Cc:0.30, Cs:0.04, OCR:1.0, cv:3, chr:1.5});
  renderLayers(); refreshL(oD); schedule();
});
renderLayers();
makeCheck($('#g-drain'),'bd','Đáy tầng đất yếu thoát nước (có lớp cát bên dưới)',()=>S.bottomDrain,v=>S.bottomDrain=v);

/* nhóm 3: giải pháp */
Lslider = makeSlider($('#g-L'),{id:'L',label:'Chiều sâu xử lý',sym:'L',unit:'m',min:1,max:totalD(),step:0.5,...P(S,'L')});
const gP = $('#g-pvd'), gS = $('#g-sand');
gP.style.cssText = gS.style.cssText = 'display:flex;flex-direction:column;gap:10px';
makeSlider(gP,{id:'pvd_s',label:'Khoảng cách bấc thấm',sym:'s',unit:'m',min:0.6,max:3,step:0.05,...P(S.pvd,'s')});
makeSelect(gP,'pvd_pat','Sơ đồ bố trí',[['tri','Hoa mai (tam giác)'],['sq','Ô vuông']],()=>S.pvd.pattern,v=>S.pvd.pattern=v);
const gP2 = makeMore(gP,'Thông số bấc nâng cao');
makeSlider(gP2,{id:'pvd_a',label:'Bề rộng bấc',sym:'a',unit:'mm',min:50,max:150,step:1,...P(S.pvd,'a')});
makeSlider(gP2,{id:'pvd_b',label:'Bề dày bấc',sym:'b',unit:'mm',min:2,max:10,step:0.5,...P(S.pvd,'b')});
makeSlider(gP2,{id:'pvd_sr',label:'Tỉ số vùng xáo trộn ds/dw',sym:'s',unit:'',min:1,max:6,step:0.1,...P(S.pvd,'sr')});
makeSlider(gP2,{id:'pvd_kr',label:'Tỉ số thấm kh/ks',sym:'kh/ks',unit:'',min:1,max:8,step:0.1,...P(S.pvd,'kr')});
makeSlider(gS,{id:'sd_d',label:'Đường kính cọc cát',sym:'d',unit:'m',min:0.25,max:1.0,step:0.05,...P(S.sand,'d')});
makeSlider(gS,{id:'sd_s',label:'Khoảng cách cọc',sym:'s',unit:'m',min:0.8,max:3.5,step:0.05,...P(S.sand,'s')});
makeSelect(gS,'sd_pat','Sơ đồ bố trí',[['tri','Hoa mai (tam giác)'],['sq','Ô vuông']],()=>S.sand.pattern,v=>S.sand.pattern=v);
const gS2 = makeMore(gS,'Thông số cọc cát nâng cao');
makeSlider(gS2,{id:'sd_n',label:'Tỉ số tập trung ứng suất',sym:'n',unit:'',min:1.5,max:6,step:0.1,...P(S.sand,'n')});
makeSlider(gS2,{id:'sd_phi',label:'Góc ma sát cát trong cọc',sym:'φc',unit:'°',min:26,max:40,step:0.5,...P(S.sand,'phis')});
makeSlider(gS2,{id:'sd_sr',label:'Tỉ số vùng xáo trộn ds/dw',sym:'s',unit:'',min:1,max:3,step:0.1,...P(S.sand,'sr')});
makeSlider(gS2,{id:'sd_kr',label:'Tỉ số thấm kh/ks',sym:'kh/ks',unit:'',min:1,max:5,step:0.1,...P(S.sand,'kr')});
const gG = $('#g-geo');
makeCheck(gG,'geo_on','<b>Rải vải địa kỹ thuật</b> dưới đáy nền đắp (tăng ổn định, không đổi độ lún)',()=>S.geo.on,v=>{S.geo.on=v; gGb.hidden=!v;});
const gGb = document.createElement('div'); gGb.style.cssText='display:flex;flex-direction:column;gap:10px'; gG.appendChild(gGb);
makeSlider(gGb,{id:'geo_T',label:'Cường độ chịu kéo giới hạn của vải',sym:'Tult',unit:'kN/m',min:20,max:800,step:10,...P(S.geo,'T')});
makeSlider(gGb,{id:'geo_n',label:'Số lớp vải',sym:'nv',unit:'lớp',min:1,max:3,step:1,...P(S.geo,'n')});
const gG2 = makeMore(gGb,'Thông số vải nâng cao');
makeSlider(gG2,{id:'geo_RF',label:'Hệ số giảm cường độ (từ biến, thi công, lão hóa)',sym:'RF',unit:'',min:1.2,max:5,step:0.1,...P(S.geo,'RF')});
makeSlider(gG2,{id:'geo_yg',label:'Cao độ lớp vải trên mặt đất tự nhiên',sym:'yv',unit:'m',min:0,max:1,step:0.05,...P(S.geo,'yg')});
makeSlider(gG2,{id:'geo_dr',label:'Tỉ số ma sát vải – đất tanδ/tanφđ',sym:'δ/φ',unit:'',min:0.4,max:1,step:0.01,...P(S.geo,'dr')});
gGb.hidden = !S.geo.on;
function syncMethod(){
  document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.m===S.method));
  gP.hidden = S.method!=='pvd'; gS.hidden = S.method!=='sand';
  $('#g-L').hidden = S.method==='none';
}
document.querySelectorAll('.seg button').forEach(b=>b.addEventListener('click',()=>{ S.method=b.dataset.m; syncMethod(); schedule(); }));
syncMethod();

/* nhóm 4 */
const gT = $('#g-time');
makeSlider(gT,{id:'tp',label:'Làm mặt đường sau khi bắt đầu đắp',sym:'tp',unit:'tháng',min:1,max:48,step:0.5,...P(S,'tp')});
makeSlider(gT,{id:'tc',label:'Thời gian đắp',sym:'tc',unit:'ngày',min:0,max:360,step:5,...P(S,'tc')});
makeSelect(gT,'road','Cấp đường',Object.entries(ROAD).map(([k,v])=>[k,v.name]),()=>S.road,v=>S.road=v);
makeSelect(gT,'pos','Vị trí đoạn nền',Object.entries(POS),()=>S.pos,v=>S.pos=v);
const gT2 = makeMore(gT,'Hệ số tính toán');
makeSlider(gT2,{id:'mc',label:'Hệ số kinh nghiệm độ lún',sym:'m',unit:'',min:1,max:1.4,step:0.05,...P(S,'mCorr')});
makeSlider(gT2,{id:'fsr',label:'Hệ số ổn định yêu cầu',sym:'[K]',unit:'',min:1,max:1.6,step:0.05,...P(S,'FSreq')});

/* ---------- tính và vẽ ---------- */
let timer = null, R = null;
function schedule(){ clearTimeout(timer); $('#out').classList.add('busy'); timer = setTimeout(run, 90); }
function run(){
  R = solve();
  renderKpis(); drawSection(); drawCharts(); renderCompare();
  $('#out').classList.remove('busy');
}
function pill(ok, tOk='Đạt', tBad='Không đạt'){ return `<span class="pill ${ok?'ok':'bad'}">${ok?tOk:tBad}</span>`; }
function tfmt(d){ if(!isFinite(d)) return '> 200 năm'; const mo=d/30.4; return mo<24 ? nf(mo,1)+' tháng' : nf(mo/12,1)+' năm'; }

function verdictText(m){
  const o = R[m], lim = allowRes(), bad = [];
  if (o.FStc < S.FSreq) bad.push(`mất ổn định khi vừa đắp xong (K = ${nf(o.FStc,2)})`);
  if (o.FStp < S.FSreq) bad.push(`chưa đủ ổn định khi làm mặt (K = ${nf(o.FStp,2)})`);
  if (o.res > lim) bad.push(`lún dư ${cm(o.res)} cm vượt ${nf(lim*100,0)} cm`);
  return bad.length ? {ok:false, t:`Chưa đạt: ${bad.join('; ')}.`} : {ok:true, t:'Đạt cả yêu cầu ổn định và lún dư.'};
}
function renderKpis(){
  const m = S.method, o = R[m], lim = allowRes();
  $('#hd-title').textContent = MNAME[m] + (S.geo.on ? ' + vải địa' : '');
  $('#hd-meta').textContent = `H = ${nf(S.H,1)} m · B = ${nf(S.B,1)} m · đất yếu dày ${nf(M.D,1)} m`;
  const v = verdictText(m);
  const gtx = (o.cTc && o.cTc.geo) ? ` Vải địa huy động T = ${nf(o.cTc.geo.Tm,0)} kN/m, nâng K khi đắp xong từ ${nf(o.cTc.geo.F0,2)} lên ${nf(o.FStc,2)}.` : '';
  $('#verdict').innerHTML = `<b class="${v.ok?'ok':'bad'}">${v.t}</b> ${m==='none'?`Chiều cao đắp giới hạn khi chưa xử lý Hgh ≈ ${nf(R.Hgh,2)} m.`:`Độ cố kết khi làm mặt ${nf(o.Utp*100,0)} %, đạt 90 % sau ${tfmt(o.t90)}.`}${gtx}`;
  const okTc = o.FStc >= S.FSreq, okTp = o.FStp >= S.FSreq, okR = o.res <= lim;
  $('#kpis').innerHTML = `
  <div class="kpi ${okTc?'':'bad'}"><span class="k">Hệ số ổn định khi đắp xong</span><span class="v">${nf(o.FStc,2)}</span><span class="d">Yêu cầu ≥ ${nf(S.FSreq,2)}</span>${pill(okTc)}</div>
  <div class="kpi ${okTp?'':'bad'}"><span class="k">Hệ số ổn định khi làm mặt</span><span class="v">${nf(o.FStp,2)}</span><span class="d">Sau ${nf(S.tp,1)} tháng</span>${pill(okTp)}</div>
  <div class="kpi"><span class="k">Tổng độ lún</span><span class="v">${cm(o.Sinf)} <small>cm</small></span><span class="d">Đã lún ${cm(o.Stp)} cm khi làm mặt</span></div>
  <div class="kpi ${okR?'':'bad'}"><span class="k">Lún dư sau khi làm mặt</span><span class="v">${cm(o.res)} <small>cm</small></span><span class="d">Cho phép ≤ ${nf(lim*100,0)} cm</span>${pill(okR)}</div>`;
}

/* ---------- Mặt cắt ---------- */
function drawSection(){
  const svg = $('#sec'), c = R[S.method].cTc, H = S.H, D = M.D;
  const W = 1000;
  let xmax = M.Xt + Math.max(6, 0.5*D);
  if (c) xmax = Math.max(xmax, c.xR + 2);
  const xmin = -xmax, sx = W/(xmax-xmin);
  let ytop = H + 2.2;
  if (c && c.yc < H + 0.6*D + 4) ytop = Math.max(ytop, c.yc + 1);
  const ybot = -D - 1.6, Hpx = (ytop-ybot)*sx;
  const X = x => (x-xmin)*sx, Y = y => (ytop-y)*sx;
  svg.setAttribute('viewBox', `0 0 ${W} ${Hpx.toFixed(1)}`);
  let g = `<rect x="0" y="0" width="${W}" height="${Hpx}" fill="var(--panel)"/>`;
  S.layers.forEach((l,i)=>{ g += `<rect x="0" y="${Y(-M.tops[i])}" width="${W}" height="${l.h*sx}" fill="var(${SOILVAR[i%5]})"/>`; });
  g += `<rect x="0" y="${Y(-D)}" width="${W}" height="${1.6*sx+1}" fill="var(--firm)"/>`;
  const m = S.method;
  if (m==='pvd'){
    const s = S.pvd.s; let k = 1; while (s*k*sx < 5) k++;
    for (let x = 0; x <= M.Xt+0.01; x += s*k) for (const xx of x===0?[0]:[x,-x])
      g += `<line x1="${X(xx)}" y1="${Y(0)}" x2="${X(xx)}" y2="${Y(-S.L)}" stroke="var(--pvd)" stroke-width="1.3" opacity=".85"/>`;
  } else if (m==='sand'){
    const s = S.sand.s, d = S.sand.d; let k = 1; while (s*k*sx < 6) k++;
    const w = Math.max(2.2, d*sx);
    for (let x = 0; x <= M.Xt+0.01; x += s*k) for (const xx of x===0?[0]:[x,-x])
      g += `<rect x="${X(xx)-w/2}" y="${Y(0)}" width="${w}" height="${S.L*sx}" fill="var(--pile)" stroke="var(--pile-edge)" stroke-width=".6"/>`;
  }
  const emb = [[-M.Xt,0],[-M.Xc,H],[M.Xc,H],[M.Xt,0]].map(p=>`${X(p[0])},${Y(p[1])}`).join(' ');
  g += `<polygon points="${emb}" fill="var(--fill)" stroke="var(--fill-edge)" stroke-width="1.2"/>`;
  if (m!=='none') g += `<rect x="${X(-M.Xt+0.15)}" y="${Y(0.5)}" width="${(2*M.Xt-0.3)*sx}" height="${0.5*sx}" fill="var(--blanket)" stroke="var(--fill-edge)" stroke-width=".5"/>`;
  g += `<line x1="0" y1="${Y(0)}" x2="${W}" y2="${Y(0)}" stroke="var(--ink)" stroke-width="1.2"/>`;
  const wx = X(M.Xt + 2.2);
  g += `<path d="M${wx-7},${Y(0)-11} h14 l-7,9 z" fill="none" stroke="var(--water)" stroke-width="1.4"/><line x1="${wx-5}" y1="${Y(0)+4}" x2="${wx+5}" y2="${Y(0)+4}" stroke="var(--water)" stroke-width="1.2"/>`;
  g += `<text x="${wx+12}" y="${Y(0)-3}" font-size="12" fill="var(--water)">MNN</text>`;
  if (S.q > 0){
    const n = 7;
    for (let k=0;k<n;k++){ const x = X(-M.Xc + 2*M.Xc*(k+.5)/n), y0 = Y(H)-22, y1 = Y(H)-3;
      g += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="var(--muted)" stroke-width="1.2"/><path d="M${x-4},${y1-6} L${x},${y1} L${x+4},${y1-6}" fill="none" stroke="var(--muted)" stroke-width="1.2"/>`; }
    g += `<text x="${X(0)}" y="${Y(H)-27}" text-anchor="middle" font-size="12.5" fill="var(--muted)">q = ${nf(S.q,1)} kPa</text>`;
  }
  S.layers.forEach((l,i)=>{
    const t = M.tops[i];
    g += `<text x="10" y="${Y(-t-l.h/2)+4}" font-size="13" font-weight="600" fill="var(--ink)">${esc(l.name)}</text>`;
    g += `<text x="10" y="${Y(-t-l.h/2)+20}" font-size="11.5" fill="var(--ink)" opacity=".8">h = ${nf(l.h,1)} m · cu = ${nf(l.cu,1)} kPa</text>`;
  });
  g += `<text x="10" y="${Y(-D)+16}" font-size="12" fill="var(--ink)" opacity=".8">Đất chặt</text>`;
  g += `<text x="${X(0)}" y="${Y(H/2)+5}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink)">H = ${nf(H,1)} m</text>`;
  g += `<text x="${X(0)}" y="${Y(H)+16}" text-anchor="middle" font-size="12" fill="var(--ink)" opacity=".85">B = ${nf(S.B,1)} m</text>`;
  g += `<text x="${X(-(M.Xc+M.Xt)/2)-8}" y="${Y(H/2)}" text-anchor="end" font-size="12" fill="var(--ink)" opacity=".85">1 : ${nf(S.m,2)}</text>`;
  if (S.geo.on){
    const yg = Math.min(S.geo.yg, H*0.5);
    for (let k=0;k<S.geo.n;k++) g += `<line x1="${X(-M.Xt)}" y1="${Y(yg)-k*3}" x2="${X(M.Xt)}" y2="${Y(yg)-k*3}" stroke="var(--geo)" stroke-width="2" stroke-dasharray="10 3"/>`;
    if (c && c.geo && c.geo.Tm>0){
      const gx = X(c.geo.xi), gy = Y(yg);
      g += `<line x1="${gx}" y1="${gy}" x2="${gx-34}" y2="${gy}" stroke="var(--geo)" stroke-width="2.4"/><path d="M${gx-34},${gy} l8,-5 v10 z" fill="var(--geo)"/>`;
      g += `<text x="${gx-38}" y="${gy-7}" text-anchor="end" font-size="12" font-weight="600" fill="var(--geo)">T = ${nf(c.geo.Tm,0)} kN/m</text>`;
    }
  }
  if (m!=='none'){
    g += `<line x1="${X(-M.Xt)-14}" y1="${Y(0)}" x2="${X(-M.Xt)-14}" y2="${Y(-S.L)}" stroke="var(--ink)" stroke-width=".8"/>`;
    g += `<text x="${X(-M.Xt)-14}" y="${Y(-S.L)+15}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--ink)">L = ${nf(S.L,1)} m</text>`;
  }
  if (c){
    const pts = [[c.xL, c.yc - Math.sqrt(Math.max(0,c.R*c.R-(c.xL-c.xc)**2))]];
    for (const s of c.slices) pts.push([s.xm, s.yb]);
    pts.push([c.xR, c.yc - Math.sqrt(Math.max(0,c.R*c.R-(c.xR-c.xc)**2))]);
    for (const s of c.slices) g += `<line x1="${X(s.xm)}" y1="${Y(s.yb)}" x2="${X(s.xm)}" y2="${Y(s.yt)}" stroke="var(--bad)" stroke-width=".6" opacity=".45"/>`;
    g += `<polyline points="${pts.map(p=>`${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="var(--bad)" stroke-width="2.6" stroke-linejoin="round"/>`;
    if (c.yc <= ytop){
      g += `<line x1="${X(c.xc)}" y1="${Y(c.yc)}" x2="${X(pts[0][0])}" y2="${Y(pts[0][1])}" stroke="var(--bad)" stroke-dasharray="4 4" stroke-width=".9" opacity=".7"/>`;
      g += `<line x1="${X(c.xc)}" y1="${Y(c.yc)}" x2="${X(pts.at(-1)[0])}" y2="${Y(pts.at(-1)[1])}" stroke="var(--bad)" stroke-dasharray="4 4" stroke-width=".9" opacity=".7"/>`;
      g += `<circle cx="${X(c.xc)}" cy="${Y(c.yc)}" r="4" fill="var(--bad)"/>`;
      g += `<text x="${X(c.xc)+8}" y="${Y(c.yc)-6}" font-size="12.5" font-weight="600" fill="var(--bad)">O · K = ${nf(c.F,3)}</text>`;
    } else {
      g += `<text x="${X(c.xR)-4}" y="${Y(0)-8}" text-anchor="end" font-size="12.5" font-weight="600" fill="var(--bad)">K = ${nf(c.F,3)}</text>`;
    }
  }
  svg.innerHTML = g;
  $('#sec-cap').textContent = c ? `Cung trượt nguy hiểm nhất khi vừa đắp xong: K = ${nf(c.F,2)}, bán kính ${nf(c.R,1)} m, ăn sâu ${nf(c.d,1)} m vào nền.` : 'Không tìm được cung trượt hợp lệ.';
  const lg = [`<span><i style="background:var(--fill)"></i>Đất đắp</span>`];
  S.layers.forEach((l,i)=>lg.push(`<span><i style="background:var(${SOILVAR[i%5]})"></i>${esc(l.name)}</span>`));
  if (m==='pvd') lg.push(`<span><i style="background:var(--pvd);height:3px"></i>Bấc thấm</span>`);
  if (m==='sand') lg.push(`<span><i style="background:var(--pile)"></i>Cọc cát</span>`);
  if (S.geo.on) lg.push(`<span><i style="background:var(--geo);height:3px"></i>Vải địa kỹ thuật</span>`);
  lg.push(`<span><i style="background:var(--bad);height:3px"></i>Cung trượt</span>`);
  $('#sec-legend').innerHTML = lg.join('');
}

/* ---------- Biểu đồ ---------- */
function niceStep(range, n){ const raw = range/n, p = 10**Math.floor(Math.log10(raw)), m = raw/p; return (m<1.5?1:m<3?2:m<7?5:10)*p; }
function chart(svg, o){
  const W=560, Hh=300, L=54, Rr=14, T=14, B=40, pw=W-L-Rr, ph=Hh-T-B;
  const X = x => L + x/o.xmax*pw;
  const Y = y => o.invert ? T + (y-o.ymin)/(o.ymax-o.ymin)*ph : T + (o.ymax-y)/(o.ymax-o.ymin)*ph;
  let g = `<rect x="0" y="0" width="${W}" height="${Hh}" fill="var(--panel)"/>`;
  const xs = niceStep(o.xmax, 6);
  for (let x=0; x<=o.xmax+1e-9; x+=xs) g += `<line x1="${X(x)}" y1="${T}" x2="${X(x)}" y2="${T+ph}" stroke="var(--line)" stroke-width="1"/><text x="${X(x)}" y="${T+ph+16}" text-anchor="middle" font-size="11.5" fill="var(--muted)">${nf(x,0)}</text>`;
  const ysn = niceStep(o.ymax-o.ymin, 5);
  for (let y=Math.ceil(o.ymin/ysn)*ysn; y<=o.ymax+1e-9; y+=ysn) g += `<line x1="${L}" y1="${Y(y)}" x2="${L+pw}" y2="${Y(y)}" stroke="var(--line)" stroke-width="1"/><text x="${L-6}" y="${Y(y)+4}" text-anchor="end" font-size="11.5" fill="var(--muted)">${nf(y, ysn<1?1:0)}</text>`;
  g += `<rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="none" stroke="var(--line)"/>`;
  g += `<text x="${L+pw/2}" y="${Hh-6}" text-anchor="middle" font-size="12" fill="var(--muted)">${o.xl}</text>`;
  g += `<text transform="translate(14 ${T+ph/2}) rotate(-90)" text-anchor="middle" font-size="12" fill="var(--muted)">${o.yl}</text>`;
  for (const r of (o.refs||[])) if (r.y>=o.ymin && r.y<=o.ymax) g += `<line x1="${L}" y1="${Y(r.y)}" x2="${L+pw}" y2="${Y(r.y)}" stroke="${r.c}" stroke-dasharray="5 4" stroke-width="1.3"/><text x="${L+pw-4}" y="${Y(r.y)-5}" text-anchor="end" font-size="11.5" fill="${r.c}">${r.t}</text>`;
  for (const v of (o.vlines||[])) if (v.x<=o.xmax) g += `<line x1="${X(v.x)}" y1="${T}" x2="${X(v.x)}" y2="${T+ph}" stroke="${v.c}" stroke-width="1.3" stroke-dasharray="2 3"/><text x="${X(v.x)+4}" y="${T+13}" font-size="11.5" fill="${v.c}">${v.t}</text>`;
  g += `<clipPath id="${svg.id}-clip"><rect x="${L}" y="${T}" width="${pw}" height="${ph}"/></clipPath><g clip-path="url(#${svg.id}-clip)">`;
  for (const s of o.series){
    const d = s.pts.filter(p=>isFinite(p[1])).map((p,i)=>`${i?'L':'M'}${X(p[0]).toFixed(1)},${Y(Math.min(Math.max(p[1],o.ymin-1),o.ymax+1)).toFixed(1)}`).join(' ');
    g += `<path d="${d}" fill="none" stroke="${s.c}" stroke-width="${s.w||2}" ${s.dash?`stroke-dasharray="${s.dash}"`:''} stroke-linejoin="round"/>`;
    if (s.dots) for (const p of s.pts) if (isFinite(p[1])) g += `<circle cx="${X(p[0])}" cy="${Y(Math.min(p[1],o.ymax))}" r="3.2" fill="${s.c}"/>`;
  }
  g += '</g>';
  svg.innerHTML = g;
}
function drawCharts(){
  const Tm = chartTmax(), N = 120, ser = [], lg = [];
  let ymax = 0;
  for (const m of ['none','pvd','sand']){
    const pts = []; for (let k=0;k<=N;k++){ const mo = Tm*k/N; pts.push([mo, settle(m, mo*30.4)*100]); }
    ymax = Math.max(ymax, R[m].Sinf*100);
    const sel = m===S.method;
    ser.push({pts, c:`var(--c-${m})`, w: sel?3:1.6, dash: sel?null:'6 4'});
    lg.push(`<span><i style="background:var(--c-${m});height:${sel?4:2}px"></i>${MNAME[m]}</span>`);
  }
  chart($('#ch-s'), {xmax:Tm, ymin:0, ymax:Math.ceil(ymax/10)*10+10, invert:true, series:ser, xl:'Thời gian (tháng)', yl:'Độ lún (cm)', vlines:[{x:S.tp, c:'var(--ink)', t:'làm mặt'}]});
  $('#lg-s').innerHTML = lg.join('');
  const fmax = Math.min(3, Math.max(1.6, ...R.fsCurve.map(p=>isFinite(p[1])?p[1]:0))*1.08);
  chart($('#ch-f'), {xmax:Tm, ymin:0.4, ymax:fmax, series:[{pts:R.fsCurve, c:`var(--c-${S.method})`, w:2.6, dots:true}], xl:'Thời gian (tháng)', yl:'Hệ số ổn định K', refs:[{y:S.FSreq, c:'var(--bad)', t:`yêu cầu ${nf(S.FSreq,2)}`},{y:1, c:'var(--muted)', t:'K = 1'}], vlines:[{x:S.tp, c:'var(--ink)', t:'làm mặt'}]});
  $('#cap-fs').textContent = `${MNAME[S.method]}: K tăng dần vì đất yếu cố kết và cứng lên.`;
  $('#lg-f').innerHTML = `<span><i style="background:var(--c-${S.method});height:4px"></i>${MNAME[S.method]}</span><span><i style="background:var(--bad);height:2px"></i>Hệ số yêu cầu</span>`;
}
function cmpTable(){
  const lim = allowRes();
  let h = `<thead><tr><th>Phương án</th><th>Tổng lún (cm)</th><th>Lún dư (cm)</th><th>Đạt U = 90 % sau</th><th>K khi đắp xong</th><th>K khi làm mặt</th><th>Đánh giá</th></tr></thead><tbody>`;
  for (const m of ['none','pvd','sand']){
    const o = R[m], ok = o.res<=lim && o.FStc>=S.FSreq && o.FStp>=S.FSreq;
    h += `<tr class="${m===S.method?'cur':''}"><td>${MNAME[m]}${S.geo.on?' + vải địa':''}</td><td class="num">${cm(o.Sinf)}</td><td class="num">${cm(o.res)}</td><td class="num">${tfmt(o.t90)}</td><td class="num">${nf(o.FStc,2)}</td><td class="num">${nf(o.FStp,2)}</td><td>${pill(ok,'Đạt','Chưa đạt')}</td></tr>`;
  }
  return h + '</tbody>';
}
function smaxText(){
  const lim = allowRes();
  const f = (o,nm) => o.ok ? (o.cap ? `${nm} đạt lún dư với khoảng cách tới ${nf(o.s,2)} m` : `${nm}: khoảng cách lớn nhất s ≈ ${nf(o.s,2)} m`) : `${nm}: không đạt dù s = ${nf(o.s,2)} m`;
  return `Để lún dư ≤ ${nf(lim*100,0)} cm khi làm mặt sau ${nf(S.tp,1)} tháng — ${f(R.smax.pvd,'Bấc thấm')}; ${f(R.smax.sand,'Cọc cát')}.`;
}
function renderCompare(){ $('#cmp').innerHTML = cmpTable(); $('#smax').textContent = smaxText(); }

/* ===================== THUYẾT MINH PDF ===================== */
function rptInput(){
  const m = S.method;
  let h = `<h2>1. Số liệu đầu vào</h2>
  <h3>1.1. Nền đắp và tải trọng</h3>
  <table><tbody>
  <tr><td>Chiều cao đắp H</td><td>${nf(S.H,2)} m</td><td>Bề rộng mặt nền đường B</td><td>${nf(S.B,2)} m</td></tr>
  <tr><td>Độ dốc mái taluy</td><td>1 : ${nf(S.m,2)}</td><td>Bề rộng chân nền đắp</td><td>${nf(2*M.Xt,2)} m</td></tr>
  <tr><td>Dung trọng đất đắp γđ</td><td>${nf(S.gf,1)} kN/m³</td><td>Lực dính / góc ma sát đất đắp</td><td>${nf(S.cf,1)} kPa / ${nf(S.phif,1)}°</td></tr>
  <tr><td>Tải trọng xe quy đổi q</td><td>${nf(S.q,1)} kPa</td><td>Kể tải xe khi tính lún</td><td>${S.qSettle?'Có':'Không'}</td></tr>
  </tbody></table>
  <h3>1.2. Các lớp đất yếu (mực nước ngầm tại mặt đất)</h3>
  <table><thead><tr><th>Lớp</th><th>h (m)</th><th>γ (kN/m³)</th><th>cu (kPa)</th><th>φcu (°)</th><th>e₀</th><th>Cc</th><th>Cs</th><th>OCR</th><th>cv (m²/năm)</th><th>ch/cv</th></tr></thead><tbody>
  ${S.layers.map(l=>`<tr><td>${esc(l.name)}</td><td>${nf(l.h,2)}</td><td>${nf(l.g,1)}</td><td>${nf(l.cu,1)}</td><td>${nf(l.phicu,1)}</td><td>${nf(l.e0,2)}</td><td>${nf(l.Cc,3)}</td><td>${nf(l.Cs,3)}</td><td>${nf(l.OCR,2)}</td><td>${nf(l.cv,2)}</td><td>${nf(l.chr,2)}</td></tr>`).join('')}
  </tbody></table>
  <p>Tổng chiều dày đất yếu D = ${nf(M.D,2)} m. ${S.bottomDrain?'Đáy tầng đất yếu thoát nước (thoát nước hai chiều).':'Đáy tầng đất yếu không thoát nước (thoát nước một chiều lên trên).'} Dưới đáy là đất chặt: γ = ${FIRM.g} kN/m³, c = ${FIRM.c} kPa, φ = ${FIRM.phi}°.</p>
  <h3>1.3. Giải pháp xử lý: ${MNAME[m]}</h3>`;
  if (m==='pvd') h += `<table><tbody><tr><td>Khoảng cách bấc s</td><td>${nf(S.pvd.s,2)} m (${S.pvd.pattern==='tri'?'hoa mai':'ô vuông'})</td><td>Chiều sâu cắm bấc L</td><td>${nf(S.L,2)} m</td></tr>
    <tr><td>Kích thước bấc a × b</td><td>${nf(S.pvd.a,0)} × ${nf(S.pvd.b,1)} mm</td><td>ds/dw ; kh/ks</td><td>${nf(S.pvd.sr,2)} ; ${nf(S.pvd.kr,2)}</td></tr></tbody></table>`;
  else if (m==='sand') h += `<table><tbody><tr><td>Đường kính cọc d</td><td>${nf(S.sand.d,2)} m</td><td>Khoảng cách s</td><td>${nf(S.sand.s,2)} m (${S.sand.pattern==='tri'?'hoa mai':'ô vuông'})</td></tr>
    <tr><td>Chiều dài cọc L</td><td>${nf(S.L,2)} m</td><td>Tỉ số tập trung ứng suất n</td><td>${nf(S.sand.n,2)}</td></tr>
    <tr><td>Góc ma sát cát φc</td><td>${nf(S.sand.phis,1)}°</td><td>ds/dw ; kh/ks</td><td>${nf(S.sand.sr,2)} ; ${nf(S.sand.kr,2)}</td></tr></tbody></table>`;
  else h += `<p>Không xử lý nền; đất yếu chỉ cố kết thấm đứng.</p>`;
  if (S.geo.on) h += `<table><tbody><tr><td>Vải địa kỹ thuật đáy nền đắp</td><td>${S.geo.n} lớp, Tult = ${nf(S.geo.T,0)} kN/m</td><td>Hệ số giảm RF</td><td>${nf(S.geo.RF,2)}</td></tr>
    <tr><td>Cao độ lớp vải yv</td><td>${nf(Math.min(S.geo.yg,S.H*0.5),2)} m</td><td>tanδ / tanφđ</td><td>${nf(S.geo.dr,2)}</td></tr></tbody></table>`;
  else h += `<p>Không dùng vải địa kỹ thuật.</p>`;
  h += `<h3>1.4. Thời gian và tiêu chuẩn</h3>
  <table><tbody><tr><td>Thời gian đắp tc</td><td>${nf(S.tc,0)} ngày</td><td>Làm mặt đường sau tp</td><td>${nf(S.tp,1)} tháng (${nf(tpDays(),0)} ngày)</td></tr>
  <tr><td>Hệ số kinh nghiệm độ lún m</td><td>${nf(S.mCorr,2)}</td><td>Hệ số ổn định yêu cầu [K]</td><td>${nf(S.FSreq,2)}</td></tr>
  <tr><td>Cấp đường</td><td>${ROAD[S.road].name}</td><td>Vị trí / lún dư cho phép</td><td>${POS[S.pos]} / ${nf(allowRes()*100,0)} cm</td></tr></tbody></table>`;
  return h;
}
function rptSummary(){
  const m = S.method, o = R[m], v = verdictText(m);
  return `<h2>2. Kết quả tổng hợp</h2>
  <table><tbody>
  <tr><td>Hệ số ổn định khi đắp xong (t = ${nf(S.tc,0)} ngày)</td><td>${nf(o.FStc,3)}</td><td class="${o.FStc>=S.FSreq?'ok':'bad'}">${o.FStc>=S.FSreq?'Đạt':'Không đạt'}</td></tr>
  <tr><td>Hệ số ổn định khi làm mặt (t = ${nf(S.tp,1)} tháng)</td><td>${nf(o.FStp,3)}</td><td class="${o.FStp>=S.FSreq?'ok':'bad'}">${o.FStp>=S.FSreq?'Đạt':'Không đạt'}</td></tr>
  <tr><td>Tổng độ lún cố kết S∞</td><td>${cm(o.Sinf)} cm</td><td></td></tr>
  <tr><td>Độ lún đã xảy ra khi làm mặt S(tp) — độ cố kết Ū</td><td>${cm(o.Stp)} cm — ${nf(o.Utp*100,1)} %</td><td></td></tr>
  <tr><td>Lún dư sau khi làm mặt ΔS</td><td>${cm(o.res)} cm</td><td class="${o.res<=allowRes()?'ok':'bad'}">${o.res<=allowRes()?'Đạt':'Không đạt'}</td></tr>
  <tr><td>Thời gian đạt độ cố kết 90 %</td><td>${tfmt(o.t90)}</td><td></td></tr>
  <tr><td>Chiều cao đắp giới hạn khi chưa xử lý Hgh = 5,14·cu,min/γđ</td><td>${nf(R.Hgh,2)} m</td><td>${R.Hgh>=S.H?'H ≤ Hgh':'H > Hgh'}</td></tr>
  </tbody></table>
  <p><b class="${v.ok?'ok':'bad'}">Kết luận: ${v.t}</b></p>
  <h3>So sánh ba phương án</h3>
  <table>${cmpTable().replace(/<span class="pill (ok|bad)">/g,'<span class="$1">')}</table>
  <p>${smaxText()}</p>`;
}
function rptStab(img){
  const m = S.method, o = R[m], c = o.cTc;
  let a = `<h2 class="pb">3. Tính ổn định trượt</h2>
  <img src="${img}" alt=""><p class="fig">Hình 1. Mặt cắt ngang và cung trượt nguy hiểm nhất khi đắp xong (${MNAME[m]}).</p>
  <h3>3.1. Phương pháp</h3>
  <p>Ổn định được kiểm toán theo mặt trượt trụ tròn, phương pháp phân mảnh Bishop đơn giản. Khối trượt chia thành ${c?c.slices.length:30} mảnh thẳng đứng.</p>
  <div class="f">        Σ [ c·b + (W − u·b)·tanφ ] / mα
K  =  ─────────────────────────────────          mα = cosα + sinα·tanφ / K
              Σ W·sinα</div>
  <p>W: trọng lượng mảnh (kể tải xe q trên phạm vi mặt đường); b: bề rộng mảnh; α: góc nghiêng đáy mảnh; u: áp lực nước lỗ rỗng tại đáy mảnh. Đất yếu dùng chỉ tiêu không thoát nước: φ = 0, c = cu(t), khi đó mα = cosα.</p>
  <p>Cường độ đất yếu tăng theo cố kết dưới tải nền đắp:</p>
  <div class="f">cu(t) = cu0 + U(t)·Δσz·tanφcu</div>`;
  if (m==='sand') a += `<p>Trong phạm vi gia cố cọc cát dùng sức chống cắt hỗn hợp:</p>
  <div class="f">τ = (1 − as)·cu(t) + as·(γ′c·z + μs·Δσz)·tanφc·cos²α
as = (d/de)² = ${nf(M.dr.sand.as,4)}    μs = n/[1+(n−1)as] = ${nf(M.dr.sand.muS,3)}    μc = 1/[1+(n−1)as] = ${nf(M.dr.sand.beta,3)}</div>`;
  if (S.geo.on) a += `<p>Vải địa kỹ thuật đặt ở cao độ yv trên mặt đất tự nhiên. Tại giao điểm phía trong của cung trượt với lớp vải, vải chịu lực kéo nằm ngang Tm và tạo mô men giữ quanh tâm O với tay đòn (yO − yv). Lực Tm lấy nhỏ nhất trong ba giá trị: cường độ thiết kế của vải và sức kháng nhổ ở hai phía giao điểm.</p>
  <div class="f">K = [ Σ (c·b + (W − u·b)·tanφ)/mα  +  Tm·(yO − yv)/R ] / Σ W·sinα
Td = nv·Tult / RF            Pnhổ = nv · 2·tanδ · ∫ γđ·(hđắp − yv) dx
Tm = min( Td ; Pnhổ,trong ; Pnhổ,khối trượt )</div>`;
  a += `<p>Cung nguy hiểm được tìm trên lưới 11 × 9 vị trí tâm và 8 độ sâu đáy cung (từ 0,3 m tới đáy tầng đất yếu), sau đó dò tìm cục bộ quanh cung có K nhỏ nhất.</p>`;
  if (c){
    const fsN = c.slices.reduce((s,x)=>s+x.res,0);
    a += `<h3>3.2. Kết quả cung nguy hiểm khi đắp xong (t = ${nf(S.tc,0)} ngày)</h3>
    <span class="calc">Tâm O(${nf(c.xc,3)} ; ${nf(c.yc,3)}) m     R = ${nf(c.R,3)} m     đáy cung sâu ${nf(c.d,3)} m
Khối trượt từ x = ${nf(c.xL,2)} m đến x = ${nf(c.xR,2)} m (gốc tọa độ: tim đường, mặt đất tự nhiên)
Σ lực giữ của đất = ${nf(fsN,2)} kN/m          Σ W·sinα = ${nf(c.den,2)} kN/m${c.geo&&c.geo.Tm>0?`
Đóng góp của vải địa = Tm·(yO − yv)/R = ${nf(c.geo.Tm,2)} × ${nf(c.geo.arm,3)} / ${nf(c.R,3)} = ${nf(c.geo.add,2)} kN/m`:''}
K = ${c.geo&&c.geo.Tm>0?`(${nf(fsN,2)} + ${nf(c.geo.add,2)})`:nf(fsN,2)} / ${nf(c.den,2)} = ${nf(c.F,3)}   ${c.F>=S.FSreq?'≥':'<'}  [K] = ${nf(S.FSreq,2)}   →   ${c.F>=S.FSreq?'ĐẠT':'KHÔNG ĐẠT'}</span>
    ${c.geo ? `<h3>Vải địa kỹ thuật trên cung nguy hiểm</h3>
    <span class="calc">Giao điểm cung trượt với lớp vải: x = ${nf(c.geo.xi,3)} m, yv = ${nf(c.geo.yg,2)} m
Td = ${S.geo.n} × ${nf(S.geo.T,1)} / ${nf(S.geo.RF,2)} = ${nf(c.geo.Td,2)} kN/m          tanδ = ${nf(S.geo.dr,2)} × tan${nf(S.phif,1)}° = ${nf(c.geo.tand,4)}
Sức kháng nhổ đoạn neo phía trong (từ chân taluy đối diện đến giao điểm) = ${nf(c.geo.Pin,1)} kN/m
Sức kháng nhổ đoạn nằm trong khối trượt = ${nf(c.geo.Pout,1)} kN/m
Tm = min(${nf(c.geo.Td,1)} ; ${nf(c.geo.Pin,1)} ; ${nf(c.geo.Pout,1)}) = ${nf(c.geo.Tm,2)} kN/m  (khống chế bởi ${c.geo.gov})
Tay đòn yO − yv = ${nf(c.yc,3)} − ${nf(c.geo.yg,2)} = ${nf(c.geo.arm,3)} m
Cùng cung trượt, không kể vải: K = ${nf(c.geo.F0,3)}   →   có vải: K = ${nf(c.F,3)}</span>` : (S.geo.on ? `<p>Cung nguy hiểm không cắt qua lớp vải nên vải không góp phần tăng ổn định cho cung này.</p>` : '')}
    <h3>3.3. Bảng tính các mảnh</h3>
    <table><thead><tr><th>Mảnh</th><th>x (m)</th><th>y đáy (m)</th><th>b (m)</th><th>W (kN/m)</th><th>α (°)</th><th>Vật liệu đáy</th><th>U (%)</th><th>c/τ (kPa)</th><th>φ (°)</th><th>mα</th><th>Giữ</th><th>W·sinα</th></tr></thead><tbody>
    ${c.slices.map((s,k)=>`<tr><td>${k+1}</td><td>${nf(s.xm,2)}</td><td>${nf(s.yb,2)}</td><td>${nf(s.b,3)}</td><td>${nf(s.W,1)}</td><td>${nf(Math.asin(s.sinA)/RAD,1)}</td><td class="l">${esc(s.tag)}</td><td>${s.yb<0&&s.tag!=='Đất chặt'?nf(s.U*100,1):'—'}</td><td>${nf(s.c,2)}</td><td>${nf(s.phi/RAD,1)}</td><td>${nf(s.ma,3)}</td><td>${nf(s.res,2)}</td><td>${nf(s.drv,2)}</td></tr>`).join('')}
    <tr><td colspan="11"><b>Tổng</b></td><td><b>${nf(fsN,2)}</b></td><td><b>${nf(c.den,2)}</b></td></tr></tbody></table>`;
    const smp = c.slices.reduce((best,s)=> (s.yb<0 && s.tag!=='Đất chặt' && (!best || Math.abs(s.yb+c.d/2) < Math.abs(best.yb+c.d/2))) ? s : best, null);
    if (smp){
      const L = S.layers[layerAt(-smp.yb)];
      const isSand = smp.tag.startsWith('Cọc cát');
      a += `<h3>3.4. Ví dụ tính một mảnh (x = ${nf(smp.xm,2)} m)</h3>
      <span class="calc">Đáy mảnh ở độ sâu z = ${nf(-smp.yb,3)} m, trong lớp “${esc(L.name)}”
b = ${nf(smp.b,3)} m ; sinα = ${nf(smp.sinA,4)} ; cosα = ${nf(smp.cosA,4)} ; W = ${nf(smp.W,2)} kN/m
Δσz = ${nf(smp.ds,2)} kPa ; U = ${nf(smp.U*100,1)} %
${isSand
  ? `cu(t) = ${nf(L.cu,2)} + ${nf(smp.U,3)}×${nf(M.dr.sand.beta,3)}×${nf(smp.ds,2)}×tan${nf(L.phicu,1)}° = ${nf(L.cu+smp.U*M.dr.sand.beta*smp.ds*Math.tan(L.phicu*RAD),2)} kPa
τ = (1−${nf(M.dr.sand.as,4)})·cu(t) + ${nf(M.dr.sand.as,4)}×(${GS_SAND}×${nf(-smp.yb,2)} + ${nf(M.dr.sand.muS,3)}×${nf(smp.ds,2)})×tan${nf(S.sand.phis,1)}°×${nf(smp.cosA,3)}² = ${nf(smp.c,2)} kPa`
  : `cu(t) = ${nf(L.cu,2)} + ${nf(smp.U,3)} × ${nf(smp.ds,2)} × tan${nf(L.phicu,1)}° = ${nf(smp.c,2)} kPa`}
mα = cosα = ${nf(smp.ma,4)}
Lực giữ = c·b / mα = ${nf(smp.c,2)} × ${nf(smp.b,3)} / ${nf(smp.ma,4)} = ${nf(smp.res,2)} kN/m
Lực gây trượt = W·sinα = ${nf(smp.W,2)} × ${nf(smp.sinA,4)} = ${nf(smp.drv,2)} kN/m</span>`;
    }
  }
  const c2 = o.cTp;
  if (c2) a += `<h3>3.5. Kiểm toán khi làm mặt đường (t = ${nf(S.tp,1)} tháng)</h3>
  <span class="calc">Cung nguy hiểm: O(${nf(c2.xc,2)} ; ${nf(c2.yc,2)}) m, R = ${nf(c2.R,2)} m → K = ${nf(c2.F,3)}  ${c2.F>=S.FSreq?'≥':'<'} [K] = ${nf(S.FSreq,2)}</span>
  <table><thead><tr><th>Thời điểm (tháng)</th>${R.fsCurve.map(p=>`<th>${nf(p[0],1)}</th>`).join('')}</tr></thead><tbody><tr><td>K(t)</td>${R.fsCurve.map(p=>`<td>${nf(p[1],3)}</td>`).join('')}</tr></tbody></table>`;
  return a;
}
function rptSettle(){
  const m = S.method, o = R[m];
  let si = 0, best = -1; M.subs.forEach((s,k)=>{ if (s.Sc > best){ best = s.Sc; si = k; } });
  const sb = M.subs[si], L = S.layers[sb.i], p0 = S.gf*S.H + (S.qSettle?S.q:0);
  return `<h2 class="pb">4. Tính độ lún cố kết</h2>
  <h3>4.1. Ứng suất do nền đắp</h3>
  <p>Tải nền đắp hình thang: p = γđ·H${S.qSettle?' + q':''} = ${nf(p0,2)} kPa trên mặt đường, giảm tuyến tính về 0 tại chân taluy. Ứng suất thẳng đứng ở độ sâu z được tính bằng tích phân nghiệm Boussinesq – Flamant cho các dải tải (tương đương lời giải Osterberg):</p>
  <div class="f">Δσz(x, z) = ∫ 2·p(ξ)·z³ / [π·((x − ξ)² + z²)²] dξ</div>
  <h3>4.2. Công thức</h3>
  <div class="f">σ′v0 = Σ (γi − γw)·hi        σ′p = OCR·σ′v0        σ′f = σ′v0 + Δσz
Nếu σ′f ≤ σ′p :  Si = hi/(1+e0)·Cs·lg(σ′f/σ′v0)
Nếu σ′f > σ′p :  Si = hi/(1+e0)·[Cs·lg(σ′p/σ′v0) + Cc·lg(σ′f/σ′p)]
S∞ = m·Σ Si   (m = ${nf(S.mCorr,2)})${m==='sand'?`
Cọc cát: Si,TK = m·β·Si trong phạm vi L, β = μc = ${nf(M.dr.sand.beta,3)}`:''}</div>
  <h3>4.3. Ví dụ tính phân lớp lún nhiều nhất</h3>
  <span class="calc">Lớp “${esc(L.name)}”, phân lớp dày h = ${nf(sb.h,3)} m, tâm ở độ sâu z = ${nf(sb.z,3)} m
σ′v0 = ${nf(sb.s0,2)} kPa ;  σ′p = ${nf(L.OCR,2)} × ${nf(sb.s0,2)} = ${nf(sb.sp,2)} kPa
Δσz = ${nf(sb.ds,2)} kPa (Δσz/p = ${nf(sb.ds/p0,3)}) ;  σ′f = ${nf(sb.sf,2)} kPa ${sb.sf>sb.sp?'> σ′p':'≤ σ′p'}
${sb.sf>sb.sp
 ? `Si = ${nf(sb.h,3)}/(1+${nf(L.e0,2)})×[${nf(L.Cs,3)}·lg(${nf(sb.sp,2)}/${nf(sb.s0,2)}) + ${nf(L.Cc,3)}·lg(${nf(sb.sf,2)}/${nf(sb.sp,2)})]`
 : `Si = ${nf(sb.h,3)}/(1+${nf(L.e0,2)})×${nf(L.Cs,3)}·lg(${nf(sb.sf,2)}/${nf(sb.s0,2)})`} = ${nf(sb.Sc*100,2)} cm</span>
  <h3>4.4. Bảng tính lún các phân lớp tại tim nền đắp</h3>
  <table><thead><tr><th>Lớp</th><th>z (m)</th><th>h (m)</th><th>σ′v0</th><th>σ′p</th><th>Δσz</th><th>σ′f</th><th>Si (cm)</th><th>Si,TK (cm)</th><th>U(tp)</th></tr></thead><tbody>
  ${M.subs.map(s=>`<tr><td>${esc(S.layers[s.i].name)}</td><td>${nf(s.z,2)}</td><td>${nf(s.h,2)}</td><td>${nf(s.s0,1)}</td><td>${nf(s.sp,1)}</td><td>${nf(s.ds,1)}</td><td>${nf(s.sf,1)}</td><td>${nf(s.Sc*100,2)}</td><td>${nf(subFinal(m,s)*100,2)}</td><td>${nf(uRamp(m,s.i,s.z<=S.L,tpDays())*100,1)} %</td></tr>`).join('')}
  <tr><td><b>Tổng</b></td><td></td><td>${nf(M.D,2)}</td><td></td><td></td><td></td><td></td><td><b>${nf(M.ScSum*100,2)}</b></td><td><b>${cm(o.Sinf)}</b></td><td><b>${nf(o.Utp*100,1)} %</b></td></tr></tbody></table>
  <p>Ứng suất tính bằng kPa. Phần đất đắp lún chìm vào nền cần đắp bù khoảng ${cm(o.Sinf)} cm theo chiều cao.</p>`;
}
function rptTime(img){
  const m = S.method, o = R[m], dr = M.dr[m], tp = tpDays();
  const tEff = S.tc>0 && tp>=S.tc ? tp-S.tc/2 : tp, TvV = Tv(tEff), UvV = UvT(TvV);
  let t = `<h2 class="pb">5. Cố kết theo thời gian và lún dư</h2>
  <img src="${img}" alt=""><p class="fig">Hình 2. Độ lún theo thời gian tại tim nền đắp của ba phương án.</p>
  <h3>5.1. Công thức</h3>
  <div class="f">Thấm đứng (Terzaghi):   Tv = cv·t / Hdr²     Uv = 1 − Σ (2/M²)·exp(−M²·Tv),  M = π(2k+1)/2
Thấm hướng tâm (Hansbo):   Th = ch·t / de²    Uh = 1 − exp(−8·Th/μ)
μ = ln(n/s) + (kh/ks)·ln(s) − 0,75 ;   n = de/dw ;   s = ds/dw
Kết hợp (Carrillo):   U = 1 − (1 − Uv)·(1 − Uh)
Tải tăng dần trong tc:   t < tc: U(t) = U*(t/2)·t/tc ;   t ≥ tc: U(t) = U*(t − tc/2)</div>
  <p>Các lớp có cv khác nhau được quy về chiều dày tương đương theo cv của lớp 1: H′ = Σ hi·√(cv1/cvi) = ${nf(M.Heq,3)} m; chiều dài đường thấm Hdr = ${nf(M.Hdr,3)} m.</p>
  <h3>5.2. Tính tại thời điểm làm mặt tp = ${nf(S.tp,1)} tháng</h3>
  <span class="calc">Thời gian quy đổi t* = ${S.tc>0&&tp>=S.tc?`${nf(tp,0)} − ${nf(S.tc,0)}/2 = `:''}${nf(tEff,0)} ngày = ${nf(tEff/365,4)} năm
Tv = ${nf(M.cvRef,2)} × ${nf(tEff/365,4)} / ${nf(M.Hdr,3)}² = ${nf(TvV,5)}   →   Uv = ${nf(UvV*100,2)} %</span>`;
  if (dr){
    const kr = m==='pvd'?S.pvd.kr:S.sand.kr, sp = m==='pvd'?S.pvd.s:S.sand.s;
    t += `<span class="calc">de = ${nf(dr.kde,3)} × ${nf(sp,2)} = ${nf(dr.de,4)} m ;   dw = ${m==='pvd'?`2(a+b)/π = 2(${nf(S.pvd.a/1000,3)}+${nf(S.pvd.b/1000,4)})/π = `:'d = '}${nf(dr.dw,4)} m
n = ${nf(dr.de,4)}/${nf(dr.dw,4)} = ${nf(dr.n,3)} ;  s = ${nf(dr.s,2)} ;  kh/ks = ${nf(kr,2)}
μ = ln(${nf(dr.n,3)}/${nf(dr.s,2)}) + ${nf(kr,2)}·ln(${nf(dr.s,2)}) − 0,75 = ${nf(dr.mu,4)}</span>
    <table><thead><tr><th>Lớp</th><th>ch (m²/năm)</th><th>Th</th><th>Uh</th><th>Uv</th><th>U trong phạm vi L</th></tr></thead><tbody>
    ${S.layers.map((l,i)=>{ const th=Th(m,i,tEff), uh=1-Math.exp(-8*th/dr.mu); return `<tr><td>${esc(l.name)}</td><td>${nf(l.cv*l.chr,2)}</td><td>${nf(th,4)}</td><td>${nf(uh*100,2)} %</td><td>${nf(UvV*100,2)} %</td><td>${nf((1-(1-UvV)*(1-uh))*100,2)} %</td></tr>`; }).join('')}
    </tbody></table>`;
  } else t += `<p>Không xử lý: chỉ thấm đứng, U = Uv = ${nf(UvV*100,2)} % cho toàn tầng đất yếu.</p>`;
  t += `<span class="calc">S(tp) = Σ Si,TK·Ui = ${cm(o.Stp)} cm ;   Ū = ${cm(o.Stp)} / ${cm(o.Sinf)} = ${nf(o.Utp*100,2)} %
ΔS dư = S∞ − S(tp) = ${cm(o.Sinf)} − ${cm(o.Stp)} = ${cm(o.res)} cm   ${o.res<=allowRes()?'≤':'>'}  [ΔS] = ${nf(allowRes()*100,0)} cm   →   ${o.res<=allowRes()?'ĐẠT':'KHÔNG ĐẠT'}</span>`;
  const months = [1,2,3,6,9,12,18,24,36,60,120].filter(x=>x<=Math.max(36,S.tp*2));
  if (!months.includes(S.tp)) { months.push(S.tp); months.sort((a,b)=>a-b); }
  t += `<h3>5.3. Độ lún theo thời gian (cm)</h3>
  <table><thead><tr><th>Phương án</th>${months.map(x=>`<th>${nf(x,x%1?1:0)} th</th>`).join('')}<th>S∞</th></tr></thead><tbody>
  ${['none','pvd','sand'].map(mm=>`<tr><td>${MNAME[mm]}</td>${months.map(x=>`<td>${cm(settle(mm,x*30.4))}</td>`).join('')}<td>${cm(R[mm].Sinf)}</td></tr>`).join('')}</tbody></table>
  <h3>5.4. Lún dư cho phép (22TCN 262-2000)</h3>
  <table><thead><tr><th>Cấp đường</th><th>Gần mố cầu</th><th>Chỗ có cống</th><th>Nền thông thường</th></tr></thead><tbody>
  ${Object.values(ROAD).map(r=>`<tr><td>${r.name}</td><td>${r.v.abut} cm</td><td>${r.v.culv} cm</td><td>${r.v.norm} cm</td></tr>`).join('')}</tbody></table>`;
  return t;
}
function rptAssume(){
  return `<h2>6. Giả thiết tính toán</h2><ul>
  <li>Bài toán phẳng, nền đắp đối xứng; mực nước ngầm ở mặt đất tự nhiên; cung trượt không sâu quá đáy tầng đất yếu.</li>
  <li>Ổn định dùng toàn bộ chiều cao đắp H tại mọi thời điểm (thiên về an toàn trong giai đoạn đắp); tải xe chỉ đặt trên bề rộng mặt đường.</li>
  <li>Cường độ tăng do cố kết lấy theo ứng suất của riêng nền đắp; bấc/cọc cát có tác dụng trong phạm vi chân taluy cộng 1 m và trong chiều sâu L.</li>
  <li>Thấm đứng nhiều lớp dùng chiều dày tương đương; bỏ qua sức cản giếng của bấc và lún thứ cấp; đất dưới chiều sâu L chỉ thấm đứng.</li>
  <li>Độ lún tính tại tim, chưa tính lặp phần đắp bù. Cọc cát: tỉ số n không đổi, bỏ qua hiệu ứng nén chặt khi thi công.</li>
  <li>Chưa xét bệ phản áp, vải địa kỹ thuật, gia tải trước, hút chân không.</li></ul>
  <p style="text-align:right;margin-top:14px"><i>Hà Nội, ngày ${new Date().getDate()} tháng ${new Date().getMonth()+1} năm ${new Date().getFullYear()}</i></p>
  <div class="sign">
    <div><b>NGƯỜI TÍNH</b><br><br><br><br>${esc(I.calc||'')}</div>
    <div><b>NGƯỜI KIỂM TRA</b><br><br><br><br>${esc(I.check||'')}</div>
    <div><b>CHỦ TRÌ THIẾT KẾ</b><br><br><br><br>${esc(I.lead||'')}</div>
  </div>`;
}

let LIGHT = null;
function lightTokens(){
  if (LIGHT) return LIGHT;
  LIGHT = {};
  const css = document.querySelector('style').textContent.match(/:root\{([\s\S]*?)\}/)[1];
  css.replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (_,k,v)=>{ LIGHT[k]=v.trim(); });
  return LIGHT;
}
function svgPng(svg){
  const L = lightTokens(), vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const body = svg.innerHTML.replace(/var\((--[\w-]+)\)/g, (m,k)=>L[k]||'#000');
  const str = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}" font-family="Arial, Helvetica, sans-serif">${body}</svg>`;
  return new Promise(res=>{
    const img = new Image();
    img.onload = ()=>{ const k = 2, c = document.createElement('canvas'); c.width = vb[2]*k; c.height = vb[3]*k; const g = c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.scale(k,k); g.drawImage(img,0,0); res(c.toDataURL('image/png')); };
    img.onerror = ()=>res('');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
  });
}

/* ---------- thông tin hồ sơ ---------- */
const INFO_FIELDS = [
  ['org','Đơn vị lập','Bộ môn Đường bộ – Sân bay, Trường ĐH Giao thông Vận tải'],
  ['project','Tên dự án',''],
  ['work','Tên công trình',''],
  ['item','Hạng mục','Nền đường đắp trên đất yếu'],
  ['station','Lý trình / đoạn tuyến',''],
  ['doc','Số hiệu hồ sơ',''],
  ['calc','Người tính','TS. Đặng Minh Tân'],
  ['check','Người kiểm tra',''],
  ['lead','Chủ trì thiết kế','']
];
const I = {};
let saved = {}; try { saved = JSON.parse(localStorage.getItem('ndy-info')||'{}') || {}; } catch(e){}
INFO_FIELDS.forEach(([k,,d])=>{ I[k] = (k in saved) ? saved[k] : d; });
(function(){
  const box = $('#g-info');
  INFO_FIELDS.forEach(([k,lb])=>{
    const w = document.createElement('label'); w.className='sel';
    w.innerHTML = `<span>${lb}</span><input type="text" id="info_${k}" value="${esc(I[k])}" placeholder="…">`;
    w.querySelector('input').addEventListener('input', e=>{ I[k] = e.target.value; try { localStorage.setItem('ndy-info', JSON.stringify(I)); } catch(_){} });
    box.appendChild(w);
  });
})();
const dots = v => v && v.trim() ? esc(v) : '……………………………………';
function reportHTML(imgSec, imgS){
  const today = new Date().toLocaleDateString('vi-VN');
  return `<table class="tb"><tbody>
    <tr><td class="l" style="width:52%"><b>${dots(I.org).toUpperCase()}</b></td><td class="l" style="text-align:right">${I.doc?`Số hồ sơ: <b>${esc(I.doc)}</b>`:''}</td></tr>
    <tr><td class="l" colspan="2">Dự án: <b>${dots(I.project)}</b></td></tr>
    <tr><td class="l" colspan="2">Công trình: <b>${dots(I.work)}</b></td></tr>
    <tr><td class="l">Hạng mục: <b>${dots(I.item)}</b></td><td class="l">Lý trình: <b>${dots(I.station)}</b></td></tr>
  </tbody></table>
  <h1>Thuyết minh tính toán nền đắp trên đất yếu</h1>
  <p class="rsub">Phương án: <b>${MNAME[S.method]}${S.geo.on?' + vải địa kỹ thuật':''}</b> · H = ${nf(S.H,2)} m · đất yếu dày ${nf(M.D,2)} m · Người tính: ${dots(I.calc)} · Ngày lập: ${today}</p>
  ${rptInput()}${rptSummary()}${rptStab(imgSec)}${rptSettle()}${rptTime(imgS)}${rptAssume()}`;
}
function pageStyle(){
  const q = t => '"' + String(t||'').replace(/["\\]/g,' ').replace(/\s+/g,' ').trim() + '"';
  const left = [I.project, I.work].filter(x=>x&&x.trim()).join(' — ') || 'Thuyết minh tính toán nền đắp trên đất yếu';
  return `@page{size:A4 portrait;margin:18mm 14mm 16mm 22mm;
    @top-left{content:${q(left)};font:8pt Arial,sans-serif;color:#555;vertical-align:bottom;padding-bottom:3mm}
    @top-right{content:${q(I.item||'Nền đắp trên đất yếu')};font:8pt Arial,sans-serif;color:#555;vertical-align:bottom;padding-bottom:3mm}
    @bottom-left{content:${q('Người tính: '+(I.calc||''))};font:8pt Arial,sans-serif;color:#555;vertical-align:top;padding-top:3mm}
    @bottom-right{content:"Trang " counter(page) " / " counter(pages);font:8pt Arial,sans-serif;color:#555;vertical-align:top;padding-top:3mm}}`;
}
function printWatermarkSVG(){
  const t = x => esc(x);
  return `<svg class="pwm" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><pattern id="pwmp" width="420" height="230" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><text x="210" y="110" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="20" font-weight="700" fill="#1b2b3a">${t(WM[0])}</text><text x="210" y="129" text-anchor="middle" font-family="IBM Plex Sans, Arial, sans-serif" font-size="11.5" fill="#1b2b3a">${t(WM[1])}</text></pattern></defs><rect width="100%" height="100%" fill="url(#pwmp)"/></svg>`;
}
async function printReport(){
  const btn = $('#btnPdf'), st = $('#pdfStatus'), rep = $('#report');
  btn.disabled = true; st.textContent = 'Đang chuẩn bị bản in…';
  try {
    const [imgSec, imgS] = await Promise.all([svgPng($('#sec')), svgPng($('#ch-s'))]);
    rep.innerHTML = printWatermarkSVG() + reportHTML(imgSec, imgS);
    $('#pagestyle').textContent = pageStyle();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await Promise.all([...rep.querySelectorAll('img')].map(i=>i.decode ? i.decode().catch(()=>{}) : null));
    document.documentElement.classList.add('printing');
    const done = ()=>{ document.documentElement.classList.remove('printing'); rep.innerHTML=''; btn.disabled=false; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    st.textContent = 'Trong hộp thoại in: chọn “Lưu dưới dạng PDF”, khổ A4, tỉ lệ 100 %.';
    setTimeout(()=>{ window.print(); setTimeout(()=>{ btn.disabled = false; }, 800); }, 60);
  } catch(e){
    st.textContent = 'Không chuẩn bị được bản in: ' + (e && e.message || e);
    btn.disabled = false; document.documentElement.classList.remove('printing');
  }
}
function onPrintClick(){ printReport(); }
$('#btnPdf').addEventListener('click', onPrintClick);

/* ===================== HÌNH MỜ TÁC GIẢ ===================== */
const WM = ['TS. Đặng Minh Tân', 'Bộ môn Đường bộ – Sân bay · Trường ĐH Giao thông Vận tải'];
function paintPageWatermark(){
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#16211f';
  const t = (x)=>x.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="250"><g transform="rotate(-24 230 125)" fill="${ink}" text-anchor="middle" font-family="Be Vietnam Pro, IBM Plex Sans, Arial, sans-serif"><text x="230" y="120" font-size="20" font-weight="700">${t(WM[0])}</text><text x="230" y="140" font-size="12" font-weight="500">${t(WM[1])}</text></g></svg>`;
  $('#wm').style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
paintPageWatermark();
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintPageWatermark); } catch(e){}
new MutationObserver(paintPageWatermark).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});

run();
