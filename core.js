/* =====================================================================
 * LÕI TÍNH TOÁN — NỀN ĐẮP TRÊN ĐẤT YẾU
 * Ổn định Bishop đơn giản (cung tròn), lún cố kết Terzaghi + Barron–Hansbo,
 * xử lý bằng bấc thấm / cọc cát, gia cường vải địa kỹ thuật đáy nền đắp.
 * Không phụ thuộc giao diện: dùng được trong trình duyệt (biến toàn cục)
 * và trong Node (module.exports ở cuối file).
 * Tác giả: TS. Đặng Minh Tân — Bộ môn Đường bộ – Sân bay, Trường ĐH GTVT.
 * ===================================================================== */
/* ===================== LÕI TÍNH TOÁN ===================== */
const RAD = Math.PI/180, GW = 9.81;
const FIRM = {g:19, c:30, phi:28};   // đất chặt dưới đáy lớp yếu
const GS_SAND = 9;                   // dung trọng đẩy nổi của cát trong cọc (kN/m³)
const ROAD = {
  hw:  {name:'Cao tốc và đường cấp 80 trở lên', v:{abut:10, culv:20, norm:30}},
  c60: {name:'Đường cấp 60 trở xuống (mặt cấp cao A1)', v:{abut:20, culv:30, norm:40}}
};
const POS = {abut:'Gần mố cầu', culv:'Chỗ có cống, đường dân sinh', norm:'Nền đắp thông thường'};
const MNAME = {none:'Không xử lý', pvd:'Bấc thấm', sand:'Cọc cát'};

const S = {
  H:4, B:24, m:1.5, gf:19, cf:5, phif:30, q:12, qSettle:false,
  layers:[
    {name:'Bùn sét hữu cơ',  h:4, g:15.5, cu:12, phicu:12, e0:2.0, Cc:0.80, Cs:0.08, OCR:1.5, cv:1.2, chr:2.0},
    {name:'Sét dẻo chảy',    h:6, g:16.5, cu:18, phicu:14, e0:1.5, Cc:0.55, Cs:0.06, OCR:1.0, cv:1.8, chr:2.0},
    {name:'Sét pha dẻo mềm', h:4, g:17.5, cu:25, phicu:16, e0:1.1, Cc:0.32, Cs:0.04, OCR:1.0, cv:3.0, chr:1.5}
  ],
  bottomDrain:false, method:'pvd', L:14,
  pvd:{s:1.0, pattern:'tri', a:100, b:4, sr:3, kr:3},
  sand:{d:0.4, s:1.5, pattern:'tri', n:3, phis:32, sr:1.5, kr:2},
  geo:{on:true, T:200, RF:2.5, n:1, yg:0.3, dr:0.67},
  tc:90, tp:6, mCorr:1.2, FSreq:1.2, road:'hw', pos:'norm'
};

let M = {};

function loadAt(x, withQ){
  const ax = Math.abs(x);
  if (ax <= M.Xc) return S.gf*S.H + (withQ ? S.q : 0);
  if (ax < M.Xt) return S.gf*S.H*(M.Xt-ax)/(M.Xt-M.Xc);
  return 0;
}
// Ứng suất thẳng đứng do tải hình thang: tích phân nghiệm Flamant (tải đường) dọc bề rộng
function sigmaZ(x, z, withQ){
  if (z < 1e-3) return loadAt(x, withQ);
  const N = 500, a = -M.Xt, dx = 2*M.Xt/N, z3 = z*z*z;
  let s = 0;
  for (let k=0;k<N;k++){
    const xi = a+(k+.5)*dx, p = loadAt(xi, withQ);
    if (p<=0) continue;
    const r = x-xi, d = r*r+z*z;
    s += p*z3/(d*d);
  }
  return s*2*dx/Math.PI;
}
function gridAt(x, z){
  x = Math.abs(x);
  let fx = x/M.gdx, fz = z/M.gdz;
  if (fx > M.gnx-1.001) fx = M.gnx-1.001;
  if (fz > M.gnz-1.001) fz = M.gnz-1.001;
  if (fz < 0) fz = 0;
  const i = Math.floor(fx), j = Math.floor(fz), u = fx-i, v = fz-j, n = M.gnz;
  const g = M.grid;
  return (1-u)*(1-v)*g[i*n+j] + u*(1-v)*g[(i+1)*n+j] + (1-u)*v*g[i*n+j+1] + u*v*g[(i+1)*n+j+1];
}
function layerAt(z){
  for (let i=0;i<S.layers.length;i++) if (z < M.tops[i]+S.layers[i].h - 1e-9) return i;
  return -1;
}
function sigTot(z){
  let s = 0;
  for (let i=0;i<S.layers.length;i++){
    const t = M.tops[i], h = S.layers[i].h;
    if (z <= t) break;
    s += S.layers[i].g*Math.min(h, z-t);
  }
  if (z > M.D) s += FIRM.g*(z-M.D);
  return s;
}
const sigEff = z => sigTot(z) - GW*z;

function drain(method){
  if (method === 'none') return null;
  const p = method==='pvd' ? S.pvd : S.sand;
  const kde = p.pattern==='tri' ? 1.05 : 1.128;
  const de = kde*p.s;
  const dw = method==='pvd' ? 2*(p.a+p.b)/1000/Math.PI : p.d;
  const n = de/dw, s = p.sr;
  const mu = Math.max(0.3, Math.log(n/s) + p.kr*Math.log(s) - 0.75);
  const o = {de, dw, n, s, mu, kde};
  if (method==='sand'){
    o.as = (p.d/de)**2;
    o.beta = 1/(1+(p.n-1)*o.as);
    o.muS = p.n*o.beta;
  }
  return o;
}

function buildModel(){
  M = {};
  M.D = S.layers.reduce((a,l)=>a+l.h, 0);
  M.Xc = S.B/2; M.Xt = M.Xc + S.m*S.H;
  M.tops = []; let z = 0;
  for (const l of S.layers){ M.tops.push(z); z += l.h; }
  if (S.L > M.D) S.L = M.D;
  // lưới ứng suất (chỉ tải đắp, dùng cho tăng cường độ do cố kết)
  M.gdx = 0.5; M.gdz = 0.5;
  M.gnx = Math.ceil((M.Xt + 2*M.D + 12)/M.gdx) + 1;
  M.gnz = Math.ceil(M.D/M.gdz) + 2;
  M.grid = new Float32Array(M.gnx*M.gnz);
  for (let i=0;i<M.gnx;i++) for (let j=0;j<M.gnz;j++)
    M.grid[i*M.gnz+j] = sigmaZ(i*M.gdx, j*M.gdz, false);
  // cố kết đứng: chiều dày tương đương theo cv lớp 1
  M.cvRef = S.layers[0].cv;
  M.Heq = S.layers.reduce((a,l)=>a + l.h*Math.sqrt(M.cvRef/l.cv), 0);
  M.Hdr = S.bottomDrain ? M.Heq/2 : M.Heq;
  M.dr = {none:null, pvd:drain('pvd'), sand:drain('sand')};
  // phân lớp tính lún tại tim
  M.subs = [];
  S.layers.forEach((l,i)=>{
    const ns = Math.max(2, Math.ceil(l.h/0.5)), hj = l.h/ns;
    for (let j=0;j<ns;j++){
      const zm = M.tops[i] + (j+.5)*hj;
      const s0 = sigEff(zm), sp = l.OCR*s0, ds = sigmaZ(0, zm, S.qSettle), sf = s0+ds;
      let Sc, kind;
      if (sf <= sp){ Sc = hj*l.Cs/(1+l.e0)*Math.log10(sf/s0); kind = 'qc'; }
      else { Sc = hj/(1+l.e0)*(l.Cs*Math.log10(sp/s0) + l.Cc*Math.log10(sf/sp)); kind = sp>s0*1.0001 ? 'mix' : 'nc'; }
      M.subs.push({i, j, z:zm, h:hj, s0, sp, ds, sf, Sc, kind});
    }
  });
  M.ScSum = M.subs.reduce((a,s)=>a+s.Sc, 0);
}

function UvT(Tv){
  if (Tv <= 0) return 0;
  if (Tv < 0.005) return Math.sqrt(4*Tv/Math.PI);
  let s = 0;
  for (let m=0;m<80;m++){
    const Mm = Math.PI*(2*m+1)/2, t = 2/(Mm*Mm)*Math.exp(-Mm*Mm*Tv);
    s += t; if (t < 1e-12) break;
  }
  return Math.min(1, Math.max(0, 1-s));
}
const Tv = t => M.cvRef*(t/365)/(M.Hdr*M.Hdr);
const Uv = t => UvT(Tv(t));
function Th(method, i, t){ const d = M.dr[method], l = S.layers[i]; return l.cv*l.chr*(t/365)/(d.de*d.de); }
function Uh(method, i, t){ return 1 - Math.exp(-8*Th(method,i,t)/M.dr[method].mu); }
function uInst(method, i, treated, t){
  const v = Uv(t);
  if (method==='none' || !treated) return v;
  return 1 - (1-v)*(1-Uh(method,i,t));
}
// tải tăng tuyến tính trong thời gian tc (hiệu chỉnh Terzaghi)
function uRamp(method, i, treated, t){
  if (t <= 0) return 0;
  const tc = S.tc;
  if (tc <= 0) return uInst(method,i,treated,t);
  if (t < tc) return uInst(method,i,treated,t/2)*t/tc;
  return uInst(method,i,treated,t-tc/2);
}
function subFinal(method, s){
  let v = S.mCorr*s.Sc;
  if (method==='sand' && s.z <= S.L) v *= M.dr.sand.beta;
  return v;
}
const Sinf = method => M.subs.reduce((a,s)=>a+subFinal(method,s), 0);
function settle(method, t){
  let a = 0;
  for (const s of M.subs) a += subFinal(method,s)*uRamp(method, s.i, s.z<=S.L, t);
  return a;
}
function tForU(method, Ut){
  const Sf = Sinf(method); if (Sf <= 0) return 0;
  let lo = 0, hi = 365*200;
  if (settle(method,hi)/Sf < Ut) return Infinity;
  for (let k=0;k<60;k++){ const mid=(lo+hi)/2; if (settle(method,mid)/Sf < Ut) lo=mid; else hi=mid; }
  return hi;
}
const allowRes = () => ROAD[S.road].v[S.pos]/100;
const tpDays = () => S.tp*30.4;

/* ---------- Ổn định: Bishop đơn giản ---------- */
function ys(x){
  const ax = Math.abs(x);
  if (ax <= M.Xc) return S.H;
  if (ax <= M.Xt) return S.H - (ax-M.Xc)/S.m;
  return 0;
}
function stabState(method, t){
  const Ut = [], Uu = [];
  S.layers.forEach((l,i)=>{ Ut.push(uRamp(method,i,true,t)); Uu.push(uRamp(method,i,false,t)); });
  return {method, t, Ut, Uu, dr:M.dr[method]};
}
function evalCircle(st, xc, yc, R, keep){
  const NS = 90, xs = xc-R, xe = xc+R;
  let xL = null, xR = null;
  for (let k=0;k<=NS;k++){
    const x = xs+(xe-xs)*k/NS, dx = x-xc;
    const yb = yc - Math.sqrt(Math.max(0, R*R-dx*dx));
    if (ys(x)-yb > 1e-3){ if (xL===null) xL = x; xR = x; }
  }
  if (xL===null) return null;
  const st2 = (xe-xs)/NS;
  xL = Math.max(xs, xL-st2*0.5); xR = Math.min(xe, xR+st2*0.5);
  const N = 30, b = (xR-xL)/N, slices = [];
  let den = 0;
  for (let k=0;k<N;k++){
    const xm = xL+(k+.5)*b, dxm = xm-xc;
    if (Math.abs(dxm) >= R) continue;
    const yb = yc - Math.sqrt(R*R-dxm*dxm), yt = ys(xm);
    if (yt-yb <= 0) continue;
    const sinA = -dxm/R, cosA = Math.sqrt(1-sinA*sinA);
    let W = 0;
    if (yt > 0) W += S.gf*(yt-Math.max(yb,0))*b;
    if (yb < 0) W += sigTot(-yb)*b;
    if (Math.abs(xm) <= M.Xc) W += S.q*b;
    let c, phi = 0, u = 0, tag, U = 0, ds = 0;
    if (yb >= 0){ c = S.cf; phi = S.phif*RAD; tag = 'Đất đắp'; }
    else {
      const z = -yb, i = layerAt(z);
      if (i < 0){ c = FIRM.c; phi = FIRM.phi*RAD; u = GW*z; tag = 'Đất chặt'; }
      else {
        const L = S.layers[i];
        const tz = st.method!=='none' && Math.abs(xm) <= M.Xt+1 && z <= S.L;
        U = tz ? st.Ut[i] : st.Uu[i];
        ds = gridAt(xm, z);
        if (st.method==='sand' && tz){
          const d = st.dr;
          const cuC = L.cu + U*d.beta*ds*Math.tan(L.phicu*RAD);
          const sv = GS_SAND*z + d.muS*ds;
          c = (1-d.as)*cuC + d.as*sv*Math.tan(S.sand.phis*RAD)*cosA*cosA;
          tag = 'Cọc cát + ' + L.name;
        } else {
          c = L.cu + U*ds*Math.tan(L.phicu*RAD);
          tag = L.name + (tz ? ' (bấc)' : '');
        }
      }
    }
    den += W*sinA;
    slices.push({xm, b, yb, yt, W, sinA, cosA, c, phi, u, tag, U, ds});
  }
  if (den <= 1e-3 || slices.length < 4) return null;
  let F = 1.2;
  for (let it=0; it<40; it++){
    let num = 0;
    for (const s of slices){
      const tf = Math.tan(s.phi);
      let ma = s.cosA + s.sinA*tf/F; if (ma < 0.15) ma = 0.15;
      num += (s.c*s.b + Math.max(0, s.W - s.u*s.b)*tf)/ma;
    }
    const Fn = num/den;
    if (Math.abs(Fn-F) < 1e-5){ F = Fn; break; }
    F = Fn;
  }
  // vải địa kỹ thuật: lực kéo huy động Tm tạo mô men giữ Tm·(yc − yg)
  const geo = geoForce(xc, yc, R, xL, xR);
  if (geo && geo.Tm > 0){
    const add = geo.Tm*geo.arm/R;
    let F2 = F;
    for (let it=0; it<40; it++){
      let num = add;
      for (const s of slices){ const tf=Math.tan(s.phi); let ma=s.cosA+s.sinA*tf/F2; if(ma<0.15) ma=0.15; num += (s.c*s.b + Math.max(0, s.W-s.u*s.b)*tf)/ma; }
      const Fn = num/den; if (Math.abs(Fn-F2) < 1e-5){ F2 = Fn; break; } F2 = Fn;
    }
    geo.F0 = F; geo.add = add; F = F2;
  }
  const r = {F, xc, yc, R, d:R-yc, geo};
  if (keep){
    r.slices = slices; r.den = den; r.xL = xL; r.xR = xR;
    for (const s of slices){ const tf=Math.tan(s.phi); let ma=s.cosA+s.sinA*tf/F; if(ma<0.15) ma=0.15; s.ma=ma; s.res=(s.c*s.b+Math.max(0,s.W-s.u*s.b)*tf)/ma; s.drv=s.W*s.sinA; }
  }
  return r;
}
// Lực kéo huy động của vải địa tại giao điểm phía trong của cung trượt với lớp vải
function geoForce(xc, yc, R, xL, xR){
  const g = S.geo;
  if (!g.on) return null;
  const yg = Math.min(g.yg, S.H*0.5), dy = yc - yg;
  if (R <= dy) return null;
  const dxc = Math.sqrt(R*R - dy*dy), xi = xc - dxc, xo = xc + dxc;
  if (xi < -M.Xt || xi > M.Xt || xi < xL - 1e-6) return null;
  const Td = g.n*g.T/g.RF, tand = Math.tan(g.dr*S.phif*RAD);
  // sức kháng nhổ: 2 mặt vải, σv = γđ·(chiều cao đất đắp phía trên vải)
  const pull = (a, b) => { if (b <= a) return 0; const N = 40, h = (b-a)/N; let s = 0;
    for (let k=0;k<N;k++){ const x = a+(k+.5)*h; s += S.gf*Math.max(0, ys(x)-yg); } return g.n*2*tand*s*h; };
  const Pin = pull(-M.Xt, xi), Pout = pull(xi, Math.min(M.Xt, xo));
  const Tm = Math.min(Td, Pin, Pout);
  return {xi, yg, Td, Pin, Pout, Tm, arm:dy, tand, gov: Tm===Td ? 'cường độ vải' : (Tm===Pin ? 'neo phía trong' : 'neo trong khối trượt')};
}
function search(st){
  const D = M.D, nx = 10, ny = 8, nd = 8;
  const x0 = M.Xc*0.3, x1 = M.Xt + 0.6*D, y0 = S.H+0.8, y1 = S.H+Math.max(6, 1.6*D);
  const dmin = 0.3;
  let best = null;
  for (let ix=0; ix<=nx; ix++) for (let iy=0; iy<=ny; iy++) for (let id=0; id<nd; id++){
    const xc = x0+(x1-x0)*ix/nx, yc = y0+(y1-y0)*iy/ny, d = dmin+(D-dmin)*id/(nd-1);
    const r = evalCircle(st, xc, yc, yc+d, false);
    if (r && isFinite(r.F) && (!best || r.F < best.F)) best = r;
  }
  if (!best) return null;
  let sx = (x1-x0)/nx, sy = (y1-y0)/ny, sd = (D-dmin)/(nd-1);
  for (let round=0; round<5; round++){
    let improved = true, guard = 0;
    while (improved && guard++ < 12){
      improved = false;
      const b0 = best;
      for (const ax of [-1,0,1]) for (const ay of [-1,0,1]) for (const ad of [-1,0,1]){
        if (!ax && !ay && !ad) continue;
        const xc = b0.xc+ax*sx, yc = Math.max(S.H+0.3, b0.yc+ay*sy), d = Math.min(D, Math.max(0.2, b0.d+ad*sd));
        const r = evalCircle(st, xc, yc, yc+d, false);
        if (r && isFinite(r.F) && r.F < best.F - 1e-6){ best = r; improved = true; }
      }
    }
    sx/=2; sy/=2; sd/=2;
  }
  return evalCircle(st, best.xc, best.yc, best.R, true);
}

function solve(){
  buildModel();
  const tp = tpDays(), tc = S.tc, R = {};
  for (const m of ['none','pvd','sand']){
    const o = R[m] = {};
    o.Sinf = Sinf(m); o.Stc = settle(m,tc); o.Stp = settle(m,tp);
    o.res = o.Sinf - o.Stp; o.Utp = o.Sinf>0 ? o.Stp/o.Sinf : 1;
    o.t90 = tForU(m, 0.9);
    o.cTc = search(stabState(m, Math.max(tc, 0.0001)));
    o.cTp = search(stabState(m, tp));
    o.FStc = o.cTc ? o.cTc.F : NaN; o.FStp = o.cTp ? o.cTp.F : NaN;
  }
  const c0 = search(stabState('none', 0));
  R.FS0 = c0 ? c0.F : NaN; R.c0 = c0;
  // đường FS(t) cho phương án chọn
  const Tmax = chartTmax()*30.4, ts = [0];
  if (tc > 0) ts.push(tc);
  for (let k=1;k<=6;k++) ts.push(tc + (Tmax-tc)*k/6);
  R.fsCurve = ts.map(t => { const c = search(stabState(S.method, t)); return [t/30.4, c ? c.F : NaN]; });
  // khoảng cách lớn nhất đạt lún dư cho bấc / cọc cát
  R.smax = {pvd:sMax('pvd'), sand:sMax('sand')};
  R.Hgh = 5.14*Math.min(...S.layers.map(l=>l.cu))/S.gf;
  return R;
}
function chartTmax(){ return Math.max(24, Math.ceil(S.tp*2.5)); }
function sMax(method){
  const p = method==='pvd' ? S.pvd : S.sand, keep = p.s, lim = allowRes(), tp = tpDays();
  const resAt = s => { p.s = s; M.dr[method] = drain(method); const r = Sinf(method) - settle(method, tp); return r; };
  let lo = method==='pvd' ? 0.6 : Math.max(0.6, p.d*1.6), hi = 3.5, out;
  if (resAt(lo) > lim) out = {ok:false, s:lo};
  else if (resAt(hi) <= lim) out = {ok:true, s:hi, cap:true};
  else {
    for (let k=0;k<30;k++){ const mid=(lo+hi)/2; if (resAt(mid) <= lim) lo=mid; else hi=mid; }
    out = {ok:true, s:lo};
  }
  p.s = keep; M.dr[method] = drain(method);
  return out;
}

if (typeof module !== 'undefined' && module.exports){
  module.exports = {S, get M(){ return M; }, solve, settle, Sinf, search, stabState, evalCircle, sigmaZ, uRamp, Uv, UvT, Tv, Th, Uh, drain, subFinal, allowRes, tpDays, ROAD, POS, MNAME, FIRM, GS_SAND, RAD, GW};
}
