/* ======================================================================
   Audit PCCC v1.5 — Kiểm soát chất lượng kết quả AI
   1. Bảng quy tắc cố định: nội dung lỗi → id danh mục → hạng mục, ID yêu cầu, mức độ
   2. AI liệt kê vật thể trước, lỗi phải gắn vật thể nhìn thấy; khung lỗi bám vật thể
   3. Loại ảnh trùng khi tải lên (giống hệt: tự bỏ; gần giống: hỏi)
   4. Gom lỗi lặp lại ở nhiều vị trí thành nhóm; xuất Findings một dòng cho mỗi nhóm
   Chèn sau ai-boost.js, trước "Khởi động".
   ====================================================================== */
const QX={cfg:(()=>{const d={rules:true,ground:true,dupImg:true,group:true,groupExport:true,groupImg:'collage'};try{return{...d,...JSON.parse(localStorage.getItem('soat-pccc-qx')||'{}')}}catch{return d}})(),
  save(){try{localStorage.setItem('soat-pccc-qx',JSON.stringify(this.cfg))}catch{}},exp:false};
window.__QX=QX;
const qn=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/\s+/g,' ');

/* ---------- 1. Bảng quy tắc cố định ----------
   Mỗi id: các nhóm từ khóa (không dấu), nhóm đầu là VẬT THỂ; phải khớp đủ mọi nhóm. Nhóm bắt đầu bằng "!" là loại trừ. */
const QX_KW=Object.fromEntries(RBA.rules.filter(r=>Array.isArray(r.kw)&&r.kw.length).map(r=>[r.id,r.kw]));
const QX_RX=Object.fromEntries(Object.entries(QX_KW).map(([id,gs])=>[id,gs.map(g=>{const neg=g[0]==='!';return{neg,rx:new RegExp('(?:^|[^a-z0-9])(?:'+(neg?g.slice(1):g)+')(?=$|[^a-z0-9])')}})]));
function qxScore(id,t){const gs=QX_RX[id];if(!gs)return{all:false,obj:false,s:0};let s=0,all=true,obj=false;
  gs.forEach((g,i)=>{const m=t.match(g.rx);if(g.neg){if(m)all=false;return}if(m){s+=m[0].length;if(i===0)obj=true}else all=false});return{all,obj,s}}
function qxGuess(text){const t=' '+qn(text)+' ';let best=null;
  for(const id of Object.keys(QX_RX)){if(!RULES[id])continue;const r=qxScore(id,t);if(r.all&&(!best||r.s>best.s))best={id,s:r.s}}
  return best}
window.qxGuess=qxGuess;
/* Tự động áp dụng bài học từ Sổ kinh nghiệm người đánh giá cho lỗi tương tự về sau */
function qxLearnFix(f){
  if(!f||f.src!=='ai'||!Learn||!Array.isArray(Learn.items)||!Learn.items.length)return false;
  const title=String(f.title||'').trim();if(!title)return false;
  let best=null,bestS=0,bestFromS=0;
  for(const x of Learn.items){
    if(!x||x.t!=='fix'||!x.to)continue;
    const sFrom=x.fromTitle?tSim(title,x.fromTitle):0;
    const sTo=x.title?tSim(title,x.title):0;
    const sameFromRule=!!(x.from&&x.from.rule&&f.rule&&x.from.rule===f.rule);
    let sc=0;
    if(sFrom>=0.52&&(!x.from||!x.from.rule||!f.rule||sameFromRule))sc=Math.max(sc,sFrom+0.12);
    if(sTo>=0.62)sc=Math.max(sc,sTo);
    if(sameFromRule&&Math.max(sFrom,sTo)>=0.42)sc=Math.max(sc,Math.max(sFrom,sTo)+0.1);
    if(sc>bestS){best=x;bestS=sc;bestFromS=sFrom}
  }
  if(!best||!best.to)return false;
  const to=best.to,r=to.rule&&RULES[to.rule]?RULES[to.rule]:null;
  const same=(!to.rule||to.rule===f.rule)&&(!to.code||to.code===f.code)&&(!to.req||to.req===f.req)&&(!to.sev||to.sev===f.sev);
  if(same&&bestFromS<0.68)return false;
  const from={rule:f.rule,code:f.code,req:f.req,sev:f.sev,kind:f.kind,title:f.title};
  if(r){
    f.rule=r.id;f.code=to.code||r.c;f.req=to.req||r.q;f.law=lawStr(r.l);f.cause=r.z;
    f.kind=to.kind||(r.kd==='hazard'?'hazard':'violation');
  }else{
    if(to.rule)f.rule=to.rule;if(to.code)f.code=to.code;if(to.req)f.req=to.req;if(to.kind)f.kind=to.kind;
  }
  if(to.sev&&SEV.includes(to.sev))f.sev=to.sev;else if(r&&(!SEV.includes(f.sev)||CFG.sevLock))f.sev=r.v;
  if(bestFromS>=0.68&&best.title&&tSim(title,best.title)<0.92)f.title=best.title;
  if(best.fixNow&&(!str(f.fixNow)||bestFromS>=0.6))f.fixNow=best.fixNow;else if(r&&!str(f.fixNow))f.fixNow=r.n;
  if(best.fixRoot&&(!str(f.fixRoot)||bestFromS>=0.6))f.fixRoot=best.fixRoot;else if(r&&!str(f.fixRoot))f.fixRoot=r.x;
  if(CFG.mandRule!=='ai')f.mand=f.sev==='Priority';
  f.qxLearn={id:best.id,from,to:{rule:f.rule,code:f.code,req:f.req,sev:f.sev},at:Date.now()};
  return true;
}
/* Quyết định có sửa id AI chọn hay không: chỉ sửa khi AI để KHAC/không có id, hoặc vật thể của id AI chọn không có trong nội dung lỗi */
function qxRuleFix(f){
  if(f&&f.qxLearn)return false;
  if(!QX.cfg.rules||!f||(f.src!=='ai'&&f.code))return false;
  const text=`${f.title||''}. ${f.ev||''}`,b=qxGuess(text);if(!b||b.id===f.rule)return false;
  if(f.rule){const cur=qxScore(f.rule,' '+qn(text)+' ');if(cur.obj||!QX_RX[f.rule])return false}
  const r=RULES[b.id],from={rule:f.rule,code:f.code,req:f.req,sev:f.sev};
  f.rule=r.id;f.code=r.c;f.req=r.q;f.law=lawStr(r.l);f.kind=r.kd==='hazard'?'hazard':'violation';
  if(CFG.sevLock||!SEV.includes(f.sev))f.sev=r.v;
  if(!str(f.fixNow))f.fixNow=r.n;if(!str(f.fixRoot))f.fixRoot=r.x;if(!f.cause)f.cause=r.z;
  if(CFG.mandRule!=='ai')f.mand=f.sev==='Priority';
  f.qxFix={...from,to:r.id,at:Date.now()};return true;
}
{const _fill=fillAI;fillAI=function(f,a,keep0){_fill(f,a,keep0);try{if(!qxLearnFix(f)&&qxRuleFix(f)&&(!keep0||!f.ai0||f.ai0.rule===f.qxFix.rule))f.ai0={rule:f.rule,code:f.code,req:f.req,sev:f.sev,kind:f.kind,title:f.title}}catch(e){console.warn(e)}}}

/* ---------- 2. Liệt kê vật thể trước, lỗi phải gắn vật thể ---------- */
const QX_OBJ=`
CÁCH LÀM ĐỂ TRÁNH NHẬN NHẦM VÀ KHOANH SÁT
Bước 1. Trong "objects", liệt kê các vật thể liên quan phòng cháy chữa cháy nhìn thấy RÕ trong ảnh: phương tiện chữa cháy, báo cháy, cửa và lối thoát nạn, dây và thiết bị điện, vật dễ cháy, nguồn nhiệt, dụng cụ hàn cắt, giấy phép hoặc hồ sơ đọc được, và vật thể gây nguy hiểm lớn khác (tối đa 15). Mỗi vật thể: "name" cụ thể (loại vật, màu, vị trí, chữ hoặc ngày đọc được, ví dụ "bình chữa cháy bột đỏ cạnh cột trái, thẻ ghi 03/2026"), "box_2d" là [ymin, xmin, ymax, xmax] thang 0 đến 1000 bao SÁT đúng vật đó.
Bước 2. Chỉ kết luận lỗi từ vật thể đã liệt kê. Mỗi lỗi ghi "obj" là danh sách id vật thể làm bằng chứng. Lỗi không chỉ ra được vật thể nhìn thấy (chỉ suy đoán, hoặc lỗi về hồ sơ, quy trình, đào tạo mà ảnh không chụp chính tài liệu đó) thì KHÔNG đưa vào findings, ghi vào "verify". Ảnh chụp giấy phép, biên bản, phiếu kiểm tra đọc được nội dung thì tài liệu đó là vật thể.
Bước 3. "box" của lỗi bao đúng các vật thể trong "obj"; lỗi thiếu một thứ thì bao vật thể chính và vùng đáng lẽ phải có thứ đó. Không bao cả khu vực rộng.
Không nhầm: phản chiếu, bóng đổ, hình in trên biển hoặc poster, vật ở xa nhìn không rõ, vật giống nhau (ống nước với dây điện, thùng nước với thùng hóa chất khi không thấy nhãn, vạch sơn cũ với vạch đúng chuẩn). Cùng một loại lỗi lặp ở nhiều vật trong ảnh: một lỗi, "obj" liệt kê đủ các vật.
`;
function qxPrompt(prompt){
  if(!QX.cfg.ground||!/\nNHIỆM VỤ\nSoát ảnh hiện trường/.test(prompt))return prompt;
  let s=prompt;const k=s.lastIndexOf('\n\nChỉ trả về một JSON:');if(k<0)return prompt;
  s=s.slice(0,k)+'\n'+QX_OBJ+s.slice(k);
  s=s.replace('{"scene":','{"objects":[{"id":1,"name":"tên vật thể cụ thể","box_2d":[0,0,0,0]}],"scene":').replace(/,"box":\[0,0,0,0\]\}\],"compliant"/,',"obj":[1],"box":[0,0,0,0]}],"compliant"');
  return s;
}
const qxB=b=>{const[x1,y1,x2,y2]=b.slice(0,4).map(Number);return[Math.min(x1,x2),Math.min(y1,y2),Math.max(x1,x2),Math.max(y1,y2)]};
const qxA=b=>Math.max(0,b[2]-b[0])*Math.max(0,b[3]-b[1]);
const qxI=(a,b)=>qxA([Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])]);
function qxGround(d){
  if(!QX.cfg.ground||!d||!Array.isArray(d.findings)||!Array.isArray(d.objects)||!d.objects.length)return d;
  const om=new Map();for(const o of d.objects){if(!o)continue;box2(o);if(boxOk(o.box)){const b=qxB(o.box);if(qxA(b)>4)om.set(Number(o.id),{b,name:str(o.name)})}}
  if(!om.size)return d;
  const out=[],gone=[];
  for(const a of d.findings){if(!a||typeof a!=='object')continue;
    const ids=(Array.isArray(a.obj)?a.obj:a.obj!=null?[a.obj]:[]).map(Number).filter(n=>om.has(n));
    if(!ids.length){gone.push(`Không đưa vào báo cáo (không chỉ ra được vật thể nhìn thấy): ${str(a.title)}`);continue}
    const bs=ids.map(n=>om.get(n).b),U=[Math.min(...bs.map(b=>b[0])),Math.min(...bs.map(b=>b[1])),Math.max(...bs.map(b=>b[2])),Math.max(...bs.map(b=>b[3]))];
    const pad=12,P=[Math.max(0,U[0]-pad),Math.max(0,U[1]-pad),Math.min(1000,U[2]+pad),Math.min(1000,U[3]+pad)];
    if(!boxOk(a.box)||!a.box.some(n=>Number(n)>0))a.box=P;
    else{const B=qxB(a.box),aB=qxA(B),aU=qxA(P);if(!qxI(B,P)||aB>2.2*aU||aB>450000&&aU<aB*.6)a.box=P}
    a._obj=ids.map(n=>om.get(n).name).filter(Boolean).slice(0,4);out.push(a)}
  d.findings=out;d.verify=[...gone.slice(0,3),...(Array.isArray(d.verify)?d.verify:[])];delete d.objects;return d;
}

/* ---------- 3. Loại ảnh trùng khi tải lên ---------- */
const QFP=new Map();
async function qxFileHash(file){try{if(!crypto.subtle)return'';const b=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return[...new Uint8Array(b)].slice(0,16).map(x=>x.toString(16).padStart(2,'0')).join('')}catch{return''}}
function qxLoad(src){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src})}
async function qxFp(key,thumb){
  if(key&&QFP.has(key))return QFP.get(key);if(!thumb)return null;
  try{const im=await qxLoad(thumb),c=mk(9,8),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0,9,8);const px=g.getImageData(0,0,9,8).data,gr=[];
    for(let i=0;i<72;i++)gr.push(px[i*4]*.299+px[i*4+1]*.587+px[i*4+2]*.114);
    let bits='';for(let y=0;y<8;y++)for(let x=0;x<8;x++)bits+=gr[y*9+x]>gr[y*9+x+1]?'1':'0';
    const c2=mk(8,8),g2=c2.getContext('2d',{willReadFrequently:true});g2.drawImage(im,0,0,8,8);const col=[...g2.getImageData(0,0,8,8).data].filter((_,i)=>i%4!==3);
    const fp={bits,col,ar:im.width/im.height};if(key)QFP.set(key,fp);return fp}catch{return null}}
const qxHam=(a,b)=>{let n=0;for(let i=0;i<64;i++)if(a[i]!==b[i])n++;return n};
const qxCol=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s/a.length};
function qxCmp(A,B){if(!A||!B)return null;if(Math.abs(A.ar-B.ar)>.08)return null;const hm=qxHam(A.bits,B.bits),cd=qxCol(A.col,B.col);
  if(hm<=1&&cd<=3)return'same';if(hm<=10&&cd<=22)return'near';return null}
async function qxFindDup(fh,fp,w,h,pool){
  let near=null;
  for(const q of pool){if(q.sample)continue;
    if(fh&&q.fh&&q.fh===fh)return{t:'same',p:q};
    const F=await qxFp(q.id,q.thumb),c=qxCmp(fp,F);
    if(c==='same'&&q.w===w&&q.h===h&&(!fh||!q.fh))return{t:'same',p:q};
    if(c&&!near)near={t:'near',p:q}}
  return near}
function qxAskNear(newThumb,name,q){
  const no=S.photos.filter(x=>!x.sample).indexOf(q)+1;
  const pr=ask('Ảnh gần giống ảnh đã có',`Ảnh "${name}" gần giống ${no>0?`ảnh số ${no}`:'một ảnh'} "${q.name||''}"${q.area?` (${q.area})`:''} đã có trong audit. Có thể anh đã tải nhầm hoặc chụp lại cùng một chỗ. Giữ ảnh mới hay bỏ?`,
    [{label:'Bỏ ảnh mới',cls:'primary',v:'skip'},{label:'Giữ cả hai',v:'keep'},{label:'Bỏ mọi ảnh gần giống còn lại',v:'skipall'},{label:'Giữ mọi ảnh còn lại',v:'keepall'}]);
  try{$('askT').append(h('div',{class:'qxdup'},h('figure',null,h('img',{src:q.thumb,alt:'Ảnh đã có'}),h('figcaption',null,'Đã có')),h('figure',null,h('img',{src:newThumb,alt:'Ảnh mới'}),h('figcaption',null,'Ảnh mới'))))}catch{}
  return pr}
importFiles=async function(list){
  const all=[...list].filter(f=>!/(^|\/)\./.test(f.webkitRelativePath||f.name)),dir=all.some(f=>f.webkitRelativePath);
  const imgs=all.filter(f=>!isZipF(f)&&isImgF(f));if(dir)imgs.sort((a,b)=>(a.webkitRelativePath||a.name).localeCompare(b.webkitRelativePath||b.name,'vi',{numeric:true}));
  const src=imgs.map(f=>({name:f.name,get:async()=>f}));
  for(const f of all.filter(isZipF)){const r=await importPack(f);if(Array.isArray(r))src.push(...r)}
  if(!src.length){if(dir||all.length&&!all.some(isZipF))toast('Không có ảnh JPG, PNG trong mục đã chọn.');return}
  let added=null,bad=0,same=0,nearSkip=0,mode='';const news=[];
  for(const[i,s0]of src.entries()){
    toast(src.length>1?`Đang đọc ảnh ${i+1}/${src.length}…`:'Đang đọc ảnh…');
    try{const file=await s0.get(),c=await decodeImg(file),thumb=thumbOf(c);
      let fh='';
      if(QX.cfg.dupImg){fh=await qxFileHash(file);const fp=await qxFp('',thumb),d=await qxFindDup(fh,fp,c.width,c.height,S.photos);
        if(d&&d.t==='same'){same++;continue}
        if(d&&d.t==='near'&&mode!=='keepall'){if(mode==='skipall'){nearSkip++;continue}
          const v=await qxAskNear(thumb,s0.name||'Ảnh chụp',d.p);if(v==='skip'||v==='skipall'||v==null){nearSkip++;if(v==='skipall')mode='skipall';continue}if(v==='keepall')mode='keepall'}}
      const p=makePhoto({name:s0.name||'Ảnh chụp',img:c,w:c.width,h:c.height,blob:await toBlob(c,'image/jpeg',.9),thumb,by:who1(),at:Date.now()});if(fh)p.fh=fh;
      S.photos.push(p);Store.touch(p);touchImg(p);news.push(p);added=added||p}
    catch(e){console.error(e);bad++}
  }
  const skip=[same?`bỏ qua ${same} ảnh trùng (giống hệt ảnh đã có)`:'',nearSkip?`bỏ ${nearSkip} ảnh gần giống`:''].filter(Boolean).join(', ');
  toast(bad?`${bad}/${src.length} ảnh không đọc được. Hãy chụp lại hoặc chọn ảnh JPG, PNG.${skip?' Đã '+skip+'.':''}`:news.length?`Đã thêm ${news.length} ảnh${skip?', '+skip:''}.`:`Không thêm ảnh nào: ${skip||'không có ảnh mới'}.`);
  if(added){S.photos=S.photos.filter(p=>!p.sample);open(added.id);if(isMobile())setView('review');if(NET.off)queueBar('off');else if(bgReady()){bgAdd(news);toast(`Đã thêm ${news.length} ảnh${skip?` (${skip})`:''}. AI đang soát ngầm, anh có thể chụp tiếp.`)}}
};

/* ---------- 4. Gom lỗi lặp lại ở nhiều vị trí & làm nổi bật vi phạm cao lặp lại ---------- */
const qxRank=v=>{const i=SEV.indexOf(v);return i<0?9:i};
const qxHot=(sev,n)=>sev==='Priority'?'crit':sev==='Major'?(n>=3?'crit':'high'):'';
const qxHotRank=lv=>lv==='crit'?0:lv==='high'?1:2;
function qxKey(f){return f.rule?'r:'+f.rule:f.code?'c:'+f.code+'|'+(f.req||''):''}
let QXG=null,QX_HOT_ONLY=false;
function qxGroups(onlyFin){
  if(!onlyFin&&QXG)return QXG;
  const real=S.photos.filter(p=>!p.sample),bk=new Map();
  real.forEach((p,pi)=>p.findings.forEach((f,fi)=>{if(f.nogrp||f.pending||!done(f)||(onlyFin&&!fin(f)))return;const k=qxKey(f);if(!k)return;(bk.get(k)||bk.set(k,[]).get(k)).push({p,f,pi,n:fi+1})}));
  const out=[];
  for(const[k,its]of bk){
    const cl=[];
    if(k.startsWith('r:'))cl.push(its);
    else for(const x of its){const c=cl.find(c=>c.some(y=>tSim(x.f.title,y.f.title)>=.45));c?c.push(x):cl.push([x])}
    for(const items of cl){if(items.length<2||new Set(items.map(x=>x.p.id)).size<2)continue;
      const rep=items.slice().sort((a,b)=>(b.f.qxRep||0)-(a.f.qxRep||0)||(b.f.ok-a.f.ok)||((b.f.conf||0)-(a.f.conf||0))||(b.p.w*b.p.h-a.p.w*a.p.h))[0];
      const sev=items.map(x=>x.f.sev).filter(Boolean).sort((a,b)=>qxRank(a)-qxRank(b))[0]||rep.f.sev;
      const pend=items.filter(x=>!x.f.ok).length,hot=qxHot(sev,items.length);
      out.push({id:rep.f.id,k,items,rep,sev,pend,hot,r:rep.f.rule?RULES[rep.f.rule]:null})}}
  out.sort((a,b)=>qxHotRank(a.hot)-qxHotRank(b.hot)||qxRank(a.sev)-qxRank(b.sev)||b.items.length-a.items.length||b.pend-a.pend);
  if(!onlyFin){QXG=out;setTimeout(()=>{QXG=null},0)}
  return out;
}
function qxMap(){const m=new Map();if(!QX.cfg.group)return m;for(const g of qxGroups())for(const x of g.items)m.set(x.f.id,g);return m}
const qxGroupOf=f=>QX.cfg.group&&f?qxMap().get(f.id)||null:null;
function qxAreas(items){const m=new Map();for(const x of items){const a=(x.p.area||'').trim()||`Ảnh ${x.pi+1}`;m.set(a,(m.get(a)||0)+1)}return[...m].map(([a,n])=>n>1?`${a} (${n})`:a)}
function qxRefresh(){QXG=null;renderAll();if(typeof renderDesk==='function')renderDesk()}
function qxUnify(g){const R=g.rep.f;for(const{p,f}of g.items){if(f===R)continue;let ch=false;
  for(const k of['rule','code','req','law','kind'])if(R[k]&&f[k]!==R[k]){f[k]=R[k];ch=true}
  if(f.sev!==g.sev){f.sev=g.sev;ch=true}if(CFG.mandRule!=='ai')f.mand=f.sev==='Priority';if(ch)Store.touch(p)}
  if(R.sev!==g.sev){R.sev=g.sev;Store.touch(g.rep.p)}}
function qxConfirm(g){qxUnify(g);let n=0;for(const{p,f}of g.items)if(!f.ok&&done(f)){f.ok=true;learn(f,p,f!==g.rep.f);Store.touch(p);n++}else if(f.ok&&done(f)){learn(f,p,true)}toast(n?`Đã xác nhận ${n} lỗi trong nhóm, thống nhất mã ${g.rep.f.req||g.rep.f.code||''} mức ${g.sev}.`:'Cả nhóm đã được xác nhận.');qxRefresh()}
function qxUnconfirm(g){let n=0;for(const{p,f}of g.items)if(f.ok){f.ok=false;Store.touch(p);n++}if(n)toast(`Đã bỏ xác nhận ${n} vị trí trong nhóm.`);qxRefresh()}
function qxSplit(p,f){f.nogrp=true;Store.touch(p);toast('Đã tách lỗi khỏi nhóm.');qxRefresh()}
function qxSetRep(p,f){f.qxRep=Date.now();Store.touch(p);toast('Đã chọn ảnh này làm ảnh đại diện của nhóm.');qxRefresh()}
function qxGo(p,f){S.listAll=false;S.cur=p.id;S.sel=f.id;if(typeof setDView==='function'&&!isMobile())setDView('review');renderAll();fit();if(isMobile())setView('review')}
function qxPanel(){
  if(!QX.cfg.group)return null;const gs=qxGroups();if(!gs.length)return null;
  const nf=gs.reduce((a,g)=>a+g.items.length,0),hotGs=gs.filter(g=>g.hot),hotPend=hotGs.reduce((a,g)=>a+g.pend,0),totPend=gs.reduce((a,g)=>a+g.pend,0);
  const isOpen=!!QX.panelOpen;
  return h('details',{class:'qxgrp'+(hotGs.length?' has-hot':''),open:isOpen,ontoggle:e=>{QX.panelOpen=e.currentTarget.open}},
    h('summary',null,
      h('b',null,`Lỗi lặp lại nhiều vị trí (${gs.length} nhóm · ${nf} lỗi${totPend?` · ${totPend} chờ`:' · đã xác nhận đủ'})`),
      hotGs.length?h('span',{class:'qx-sum-alert'},`⚠️ ${hotGs.length} nhóm vi phạm cao${hotPend?` (${hotPend} chờ xác nhận)`:''}`):null,
      h('small',null,' · Gộp mỗi nhóm thành 1 dòng khi xuất file'),
      h('button',{class:'qx-sum-jump',type:'button',onclick:e=>{e.preventDefault();e.stopPropagation();const d=$('tDetailHd')||document.querySelector('#list .tdetail-hd');if(d)d.scrollIntoView({behavior:'smooth',block:'start'})}},'Xem danh sách chi tiết ↓')),
    h('div',{class:'qxgrp-body'},...gs.map(g=>{const okN=g.items.length-g.pend,allOk=!g.pend,R=g.rep.f,firstTarget=(g.items.find(x=>!x.f.ok)||g.rep);
      return h('div',{class:'qxg1'+(g.hot?' qx-'+g.hot:'')+(allOk&&!g.hot?' is-done':'')},
        g.hot?h('div',{class:'qxg-rib '+g.hot},
          h('b',null,g.hot==='crit'?`🔥 VI PHẠM CAO LẶP LẠI LIÊN TỤC (${g.sev} · ${g.items.length} vị trí) — KIỂM TRA KỸ`:`⚠️ LỖI NẶNG LẶP LẠI (${g.sev} · ${g.items.length} vị trí) — KIỂM TRA KỸ`),
          h('span',{class:'spacer'}),
          h('button',{class:'btn sm qx-chkbtn',type:'button',onclick:()=>qxGo(firstTarget.p,firstTarget.f)},g.pend?`Kiểm tra ngay (${g.pend} chờ) ›`:'Mở kiểm tra lại ›')):null,
        h('div',{class:'qxgh'},h('span',{class:'pill '+g.sev},g.sev),h('span',{class:'tag'},R.req||R.code||'—'),h('b',null,g.r?g.r.t:R.title),h('span',{class:'spacer'}),
          h('small',null,`${g.items.length} vị trí`),
          allOk?h('span',{class:'st-pill ok'},`✓ Đã xác nhận đủ (${okN}/${g.items.length})`):h('span',{class:'st-pill pend'},`⏳ Chờ xác nhận ${g.pend}/${g.items.length}`)),
        h('div',{class:'qxga'},'Khu vực: '+qxAreas(g.items).join('; ')),
        h('div',{class:'qxgl'},...g.items.map(x=>h('div',{class:'qxgi'+(x===g.rep?' rep':'')+(x.f.ok?' ok':' pend')},
          h('div',{class:'qxgi-im'},
            h('img',{src:x.p.thumb,alt:`Ảnh ${x.pi+1}`,title:x.f.title,onclick:()=>qxGo(x.p,x.f)}),
            x===g.rep?h('span',{class:'qx-rep-bdg'},'★ Đại diện'):null,
            h('span',{class:'qx-st-dot '+(x.f.ok?'ok':'pend')},x.f.ok?'✓':'⏳')),
          h('small',{title:(x.p.area||'').trim()||`Ảnh ${x.pi+1}`},`${x.pi+1}.${x.n}${(x.p.area||'').trim()?' · '+x.p.area.trim():''}`),
          h('div',{class:'qxgb'},x===g.rep?h('span',{class:'qx-rep-lbl',title:'Ảnh đang được chọn làm đại diện cho nhóm'},'★ Đại diện'):h('button',{class:'btn sm',title:'Dùng ảnh này làm ảnh đại diện khi xuất file',onclick:()=>qxSetRep(x.p,x.f)},'Đặt đại diện'),h('button',{class:'btn sm',title:'Không gom lỗi này vào nhóm',onclick:()=>qxSplit(x.p,x.f)},'Tách'))))),
        h('div',{class:'qxgf gxbar'},h('label',{class:'gxmode',title:'Ảnh dùng cho file checklist, PDF, ảnh báo cáo'},'Ảnh xuất: ',h('select',{'aria-label':'Ảnh xuất của nhóm',onchange:e=>gxSetMode(g,e.target.value)},h('option',{value:'collage',selected:gxMode(g)==='collage'},'Ghép ảnh các vị trí'),h('option',{value:'rep',selected:gxMode(g)==='rep'},'Ảnh đại diện'))),
          h('button',{class:'btn sm',onclick:()=>gxShow(g)},'Xem ảnh xuất'),h('button',{class:'btn sm primary',onclick:()=>gxEdit(g)},'Sửa nhóm & đối chiếu'),
          ...(allOk
            ?[h('span',{class:'st-pill ok'},'✓ Đã xác nhận nhóm'),
              h('button',{class:'btn sm btn-unok',title:'Hoàn tác xác nhận cả nhóm về trạng thái Chờ xác nhận',onclick:()=>qxUnconfirm(g)},'↺ Bỏ xác nhận')]
            :[h('button',{class:'btn sm btn-cfm',onclick:()=>qxConfirm(g)},okN?`Xác nhận nốt ${g.pend} vị trí`:`Xác nhận cả nhóm (${g.items.length})`)]),
          h('button',{class:'btn sm',onclick:()=>{qxUnify(g);toast(`Đã thống nhất mã ${R.req||R.code||''}, mức ${g.sev} cho cả nhóm.`);qxRefresh()}},'Thống nhất mã')))})));
}
{const _tf=tFilter;tFilter=function(st){const r=_tf(st);if(!QX_HOT_ONLY||!QX.cfg.group)return r;const m=qxMap();return r.filter(x=>{const g=m.get(x.f.id);return!!(g&&g.hot)})}}
{const _rt=renderTable;renderTable=function(){_rt();try{if(iTyping())return;
  const m=qxMap(),hotGs=qxGroups().filter(g=>g.hot),hotN=hotGs.reduce((a,g)=>a+g.items.length,0);
  if(QX_HOT_ONLY&&!hotN){QX_HOT_ONLY=false;_rt()}
  let hb=$('tHotBtn');const tool=document.querySelector('#tbl .ttool');
  if(tool){if(!hb){hb=h('button',{id:'tHotBtn',class:'btn sm qx-flt',type:'button',onclick:()=>{QX_HOT_ONLY=!QX_HOT_ONLY;renderTable()}});tool.append(hb)}
    hb.hidden=!hotN;hb.classList.toggle('on',QX_HOT_ONLY);hb.textContent=`⚠️ Cao lặp lại (${hotN})`}
  if(QX_HOT_ONLY){const af=$('tActiveFlt');if(af){af.hidden=false;const chip=h('button',{class:'tflt-chip',type:'button',onclick:()=>{QX_HOT_ONLY=false;renderTable()}},'⚠️ Chỉ lỗi cao lặp lại ×');af.prepend(chip)}}
  document.querySelectorAll('#tBody tr[data-fid]').forEach(tr=>{const g=m.get(tr.dataset.fid);if(g&&g.hot)tr.classList.add('qx-'+g.hot)});
  let box=$('qxGrp');if(!box){box=h('div',{id:'qxGrp'});$('tSel').before(box)}const pn=qxPanel();box.replaceChildren(...(pn?[pn]:[]))}catch(e){console.warn(e)}}}
{const _ral=renderAllList;renderAllList=function(){_ral();try{if(iTyping())return;
  const m=qxMap();document.querySelectorAll('#list .arow2[data-fid]').forEach(el=>{const g=m.get(el.dataset.fid);if(g&&g.hot)el.classList.add('qx-'+g.hot)});
  const pn=qxPanel();if(!pn)return;const L=$('list'),hd=L.querySelector('.tdetail-hd'),t=L.querySelector('.atool');hd?hd.before(pn):t?t.after(pn):L.prepend(pn)}catch(e){console.warn(e)}}}
{const _rl0=renderList;renderList=function(){_rl0();try{if(S.listAll&&isMobile())return;const p=cur();if(!p||p.sample||!QX.cfg.group)return;
  const m=qxMap(),L=$('list'),hots=[];
  p.findings.forEach((f,i)=>{const g=m.get(f.id);if(!g||!g.hot)return;hots.push({f,i,g});
    const card=L.querySelector(`.card[data-id="${f.id}"]`);if(!card)return;
    card.classList.add('qx-'+g.hot);
    card.prepend(h('div',{class:'qx-card-rib '+g.hot,onclick:e=>e.stopPropagation()},
      h('span',null,g.hot==='crit'?`🔥 Lặp lại ${g.items.length} vị trí · ${g.sev} — Kiểm tra kỹ`:`⚠️ Lặp lại ${g.items.length} vị trí · ${g.sev} — Kiểm tra kỹ`),
      h('button',{class:'qx-rib-btn',type:'button',onclick:e=>{e.stopPropagation();if(typeof gxEdit==='function')gxEdit(g)}},`Xem ${g.items.length} ảnh ›`)))});
  if(hots.length){
    const topLv=hots.some(x=>x.g.hot==='crit')?'crit':'high';
    L.prepend(h('div',{class:'qx-pban '+topLv},
      h('div',{class:'qx-pban-t'},h('b',null,`⚠️ Ảnh có ${hots.length} vi phạm mức cao lặp lại nhiều vị trí`),h('small',null,'Hãy kiểm tra kỹ vùng khoanh, bằng chứng và mức độ trước khi xác nhận.')),
      h('div',{class:'qx-pban-chips'},...hots.map(({f,i,g})=>h('button',{class:'qx-jchip '+g.hot,type:'button',onclick:()=>select(f.id)},`#${i+1} ${f.req||f.code||g.sev} (${g.items.length} vị trí)`)))))}
}catch(e){console.warn(e)}}}
{const _rth=renderThumbs;renderThumbs=function(){_rth();try{if(!QX.cfg.group)return;
  const m=qxMap();S.photos.forEach(p=>{if(p.sample)return;let lv='',pendHot=false;
    for(const f of p.findings){const g=m.get(f.id);if(!g||!g.hot)continue;if(g.hot==='crit'||!lv)lv=g.hot;if(!f.ok)pendHot=true}
    if(!lv)return;const el=document.querySelector(`#thumbs .thumb[data-pid="${p.id}"]`);if(!el)return;
    el.classList.add('qx-th-'+lv);
    if(pendHot){const c=el.querySelector('.counts');if(c)c.prepend(h('i',{class:'tick qxhot '+lv,style:'font-style:normal',title:'Có lỗi mức cao lặp lại nhiều vị trí cần kiểm tra kỹ',text:'⚠️'}))}
  })}catch(e){console.warn(e)}}}
{const _rd=renderDash;renderDash=function(){_rd();try{if(!QX.cfg.group)return;
  const hotGs=qxGroups().filter(g=>g.hot);if(!hotGs.length)return;
  const B=$('dashB'),kp=B&&B.querySelector('.kpis');if(!kp)return;
  const hotPend=hotGs.reduce((a,g)=>a+g.pend,0);
  kp.after(h('div',{class:'dcard qx-dash-alert'},
    h('div',{class:'qx-da-hd'},
      h('div',null,h('h3',null,`⚠️ Vi phạm mức cao lặp lại liên tục (${hotGs.length} nhóm)`),
        h('p',{class:'hint'},hotPend?`Còn ${hotPend} vị trí chưa xác nhận — ưu tiên kiểm tra kỹ khung khoanh, bằng chứng và tính thống nhất giữa các khu vực.`:'Tất cả vị trí trong nhóm đã xác nhận — nên rà lại lần cuối trước khi xuất báo cáo.')),
      h('button',{class:'btn sm primary',type:'button',onclick:()=>{QX_HOT_ONLY=true;S.tf.st='';setDView('table')}},'Lọc kiểm tra tất cả ›')),
    h('div',{class:'qx-da-list'},...hotGs.slice(0,6).map(g=>{const R=g.rep.f,t0=g.items.find(x=>!x.f.ok)||g.rep;
      return h('div',{class:'qx-da-row '+g.hot},
        h('span',{class:'pill '+g.sev},g.sev),
        h('div',{class:'qx-da-m'},h('b',null,`${R.req||R.code?`[${R.req||R.code}] `:''}${g.r?g.r.t:R.title}`),
          h('small',null,`Lặp lại ${g.items.length} vị trí (${qxAreas(g.items).join('; ')}) · ${g.pend?`${g.pend} chờ xác nhận`:'✓ Đã xác nhận đủ'}`)),
        h('div',{class:'qx-da-act'},
          h('button',{class:'btn sm',type:'button',onclick:()=>qxGo(t0.p,t0.f)},'Kiểm tra ảnh ›'),
          typeof gxEdit==='function'?h('button',{class:'btn sm',type:'button',onclick:()=>gxEdit(g)},'Đối chiếu nhóm'):null))}))))}catch(e){console.warn(e)}}}
{const _dt=dupTag;dupTag=function(p,f){const a=_dt(p,f),g=qxGroupOf(f);
  const lrn=f&&f.qxLearn?h('span',{class:'tag learned',title:`Đã tự động áp dụng bài học từ Sổ kinh nghiệm (AI gán ${[f.qxLearn.from&&f.qxLearn.from.rule,f.qxLearn.from&&f.qxLearn.from.code,f.qxLearn.from&&f.qxLearn.from.sev].filter(Boolean).join('/')} → chuẩn hóa thành ${[f.rule,f.req||f.code,f.sev].filter(Boolean).join('/')})`},'🧠 Đã áp dụng bài học'):f&&f.userEdited&&f.ok?h('span',{class:'tag learned',title:'Nội dung/mã lỗi do người đánh giá chỉnh sửa đã được lưu vào Sổ kinh nghiệm'},'🧠 Đã ghi nhớ'):null;
  const fx=!lrn&&f&&f.qxFix?h('span',{class:'tag qxfx',title:`AI chọn ${[f.qxFix.rule||'KHAC',f.qxFix.req||f.qxFix.code,f.qxFix.sev].filter(Boolean).join(' / ')}; app sửa theo bảng quy tắc thành ${f.rule} (${f.req||f.code}, ${f.sev})`},'Đã chỉnh mã'):null;
  const gt=g?(g.hot?h('button',{class:'tag qxg qx-hot-tag '+g.hot,type:'button',title:'Bấm để đối chiếu cả nhóm tại các khu vực: '+qxAreas(g.items).join('; '),onclick:e=>{e.stopPropagation();if(typeof gxEdit==='function')gxEdit(g)}},`⚠️ Lặp ${g.items.length} vị trí · Kiểm tra kỹ`):
    h('span',{class:'tag qxg',title:'Khu vực: '+qxAreas(g.items).join('; ')},`Lặp lại · ${g.items.length} vị trí`)):null;
  if(!lrn&&!fx&&!gt)return a;return h('span',{class:'qxtags'},a,gt,lrn,fx)}}

/* Xuất file: mọi file xuất dùng chung cách gom nhóm — xem ai-group.js (v1.6.2) */

/* ---------- Cài đặt ---------- */
{const card=$('setAIcard')||$('setAI');if(card){
  const opt=(k,label,hint)=>h('label',{class:'aixo'},h('input',{type:'checkbox',checked:!!QX.cfg[k],onchange:e=>{QX.cfg[k]=e.target.checked;QX.save();QXG=null;toast(`${label}: ${e.target.checked?'bật':'tắt'}.`);if(k==='group'||k==='groupExport')qxRefresh()}}),h('span',null,h('b',null,label),h('small',null,hint)));
  card.append(h('div',{class:'aixbox'},h('h4',null,'Kiểm soát chất lượng kết quả'),
    opt('rules','Bảng quy tắc mã và mức độ','Nội dung lỗi khớp loại lỗi trong danh mục (ví dụ chắn lối thoát hiểm, bình chữa cháy quá hạn) mà AI chọn sai nhóm thì app tự sửa hạng mục, ID yêu cầu và mức độ theo danh mục.'),
    opt('ground','AI chỉ ra vật thể trước khi kết luận','AI liệt kê vật thể nhìn thấy, mỗi lỗi phải gắn vật thể làm bằng chứng; lỗi không gắn được bị loại. Khung lỗi bám sát vật thể.'),
    opt('dupImg','Loại ảnh trùng khi tải lên','Ảnh giống hệt ảnh đã có: tự bỏ qua. Ảnh gần giống (chụp lại cùng chỗ): hỏi giữ hay bỏ.'),
    opt('group','Gom lỗi lặp lại ở nhiều vị trí','Cùng loại lỗi ở nhiều ảnh được gom thành nhóm, thống nhất mã và mức độ, xác nhận một lần.'),
    opt('groupExport','Xuất mỗi nhóm thành 1 lỗi duy nhất','Trong file checklist, PDF trình chiếu, ảnh báo cáo, file nén và file đối chiếu Guider: nhóm lỗi lặp lại là 1 lỗi kèm số vị trí và khu vực, dùng ảnh ghép các vị trí hoặc ảnh đại diện.')))}}
