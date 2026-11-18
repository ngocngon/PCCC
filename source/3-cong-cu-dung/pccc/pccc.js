/* ======================================================================
   Audit PCCC — Chấm điểm 25 hạng mục, xuất checklist (.xlsx), PDF báo cáo nhanh
   Gắn vào bản dựng bằng patch_pccc.py, chạy SAU mọi lớp khác (cloud, ai).

   Quy tắc đã chốt:
   - Hạng mục có bất kỳ lỗi đã xác nhận nào thì NG và được 0 điểm. Một hạng mục có thể có nhiều lỗi:
     ghi đủ mọi lỗi kèm ảnh.
   - Hạng mục không có lỗi từ ảnh thì người đánh giá phải tự chấm OK hoặc NG (kèm nội dung);
     chưa chấm đủ 25 hạng mục thì chưa xuất được.
   - Lỗi EHS nguy hiểm ngoài checklist (mã EH000) ghi riêng trong PDF, không trừ điểm, không vào file Excel.
   - File Excel là mẫu cố định: chỉ điền thông tin đầu trang, cột Điểm đánh giá, Kết quả,
     Nội dung vấn đề, Hình ảnh. Không đổi hạng mục, điểm tiêu chuẩn, công thức.
   ====================================================================== */
var PC={
  KEY:'soat-pccc-ck',st:{m:{},n:{},upd:0},
  load(){try{const v=JSON.parse(localStorage.getItem(this.KEY)||'null');if(v)this.st=this.clean(v)}catch{}},
  clean(v){const o={m:{},n:{},upd:Number(v&&v.upd)||0};if(!v||typeof v!=='object')return o;
    for(const c of RBA.order){if(v.m&&v.m[c]==='OK')o.m[c]='OK';
      const l=v.n&&Array.isArray(v.n[c])?v.n[c].filter(x=>x&&typeof x.t==='string'&&x.t.trim()).slice(0,20).map(x=>({id:String(x.id||uid()),t:x.t.trim().slice(0,600),a:String(x.a||'').trim().slice(0,120)})):[];
      if(l.length)o.n[c]=l}
    return o},
  save(remote){if(!remote)this.st.upd=Date.now();try{localStorage.setItem(this.KEY,JSON.stringify(this.st))}catch{}
    if(!remote)try{if(typeof CL!=='undefined'&&API){CL.metaDirty=true;clSoon(3000)}}catch{}},
  reset(){this.st={m:{},n:{},upd:0};try{localStorage.removeItem(this.KEY)}catch{}},
  apply(x){this.st=this.clean(x||{});this.save(true);pcRender()},
  merge(x){if(!x||typeof x!=='object'||(Number(x.upd)||0)<=(this.st.upd||0))return;this.apply(x)},
  canEdit(){try{if(typeof RO==='function'&&RO()){toast('Bạn chỉ được xem audit này, không chấm điểm được.');return false}}catch{}return true}
};
PC.load();
const PC_GRADE=s=>s<70?'D':s<80?'C':s<90?'B':'A';
const PC_GCOL={A:'#15803D',B:'#1D4ED8',C:'#B45309',D:'#B91C1C'};
/* Thuộc tính PCCC của ảnh lưu trong p.analysis.pc để được lưu máy và đồng bộ máy chủ */
const PC_PF={pcSel:'sel',pcSeen:'seen',pcMain:'main',pcEvid:'evid',pcNote:'note'};
function pcPhotoProps(p){if(!p||p._pcp)return p;try{Object.defineProperty(p,'_pcp',{value:true});
  for(const[k,a]of Object.entries(PC_PF)){let tmp=null;Object.defineProperty(p,k,{configurable:true,enumerable:false,
    get(){const pc=p.analysis&&p.analysis.pc;return pc&&pc[a]!==undefined?pc[a]:tmp},
    set(v){if(p.analysis){p.analysis.pc=p.analysis.pc||{};p.analysis.pc[a]=v}else tmp=v}})}}catch(e){console.warn(e)}return p}
{const _mp=makePhoto;makePhoto=function(o){return pcPhotoProps(_mp(o))}}
try{for(const p of S.photos)pcPhotoProps(p)}catch{}
const pcCodeOf=(f,p)=>{try{resolveRbaCode(f,p)}catch{}return RBA.codes[f.code]?f.code:'EH000'};
/* Trạng thái từng hạng mục, tính từ lỗi trên ảnh và phần chấm tay */
function pcState(){
  const real=S.photos.filter(p=>!p.sample),by={},pend={},ehs=[];
  for(const c of RBA.order){by[c]=[];pend[c]=0}
  let alt=0;
  for(const p of real)for(const f of p.findings){if(!done(f))continue;const c=pcCodeOf(f,p);
    if(c==='EH000'){if(f.ok)ehs.push({p,f});continue}
    if(pcAltPending(p,f))continue;
    if(f.ok){for(const x of pcCodesOf(p,f))by[x].push({p,f,extra:x!==c})}else pend[c]++}
  alt=real.filter(pcNeedAsk).length;
  let lost=0,nNG=0,nOK=0,nOpen=0;const items=RBA.order.map(c=>{const v=RBA.codes[c],notes=PC.st.n[c]||[],faults=by[c];
    const st=faults.length||notes.length?'NG':PC.st.m[c]==='OK'?'OK':'';
    if(st==='NG'){lost+=v.pts;nNG++}else if(st==='OK')nOK++;else nOpen++;
    return{c,v,st,faults,notes,pend:pend[c],auto:faults.length>0}});
  const score=100-lost;return{items,score,grade:PC_GRADE(score),lost,nNG,nOK,nOpen,ehs,alt,nFault:items.reduce((s,x)=>s+x.faults.length+x.notes.length,0)}
}
function pcGroups(st){const g=[];for(const it of st.items){let x=g[g.length-1];if(!x||x.g!==it.v.g){x={g:it.v.g,gk:it.v.gk,items:[],max:0,got:0};g.push(x)}x.items.push(it);x.max+=it.v.pts;if(it.st!=='NG')x.got+=it.v.pts}return g}

/* ---------- Một ảnh = một hạng mục trọng tâm ----------
   Mỗi ảnh chỉ tính MỘT hạng mục trong 25 hạng mục. Lỗi trên cùng ảnh thuộc hạng mục khác ("hạng mục phụ")
   không được tính điểm cho đến khi người đánh giá quyết định: giữ (tính thêm hạng mục đó), chuyển về hạng mục
   trọng tâm, hoặc xóa. Lỗi EHS khác (EH000) không thuộc 25 hạng mục nên không bị giới hạn này. */
const pcSevRank=f=>{const k=SEV.indexOf(f.sev);return k<0?9:k};
const pcRank=c=>{const v=RBA.codes[c];return v&&v.no?v.no:c==='EH000'?90:99};
function pcMain(p){
  if(p.pcSel&&p.pcSel.length&&RBA.codes[p.pcSel[0]])return p.pcSel[0];
  const fs=p.findings.filter(f=>done(f)),codes=new Map();
  for(const f of fs){const c=pcCodeOf(f,p);if(c==='EH000')continue;const e=codes.get(c)||{c,n:0,ok:0,best:9,first:1e9};e.n++;if(f.ok)e.ok++;e.best=Math.min(e.best,pcSevRank(f));e.first=Math.min(e.first,p.findings.indexOf(f));codes.set(c,e)}
  if(!codes.size)return'';
  if(p.pcMain&&codes.has(p.pcMain))return p.pcMain;
  const ai=p.analysis&&p.analysis.mainItem;if(ai&&codes.has(ai))return ai;
  return[...codes.values()].sort((a,b)=>a.best-b.best||b.n-a.n||a.first-b.first)[0].c;
}
/* Các hạng mục ứng viên của ảnh: hạng mục của từng lỗi + hạng mục phụ AI đề xuất cho chính lỗi đó (also_items) */
function pcCands(p){
  const m=pcMain(p),set=new Map();
  const add=(c,f,ex)=>{if(!RBA.codes[c]||c==='EH000')return;if(!set.has(c))set.set(c,{c,fs:[],ex:[]});(ex?set.get(c).ex:set.get(c).fs).push(f)};
  for(const f of p.findings){if(!done(f))continue;const c=pcCodeOf(f,p);add(c,f);if(c!=='EH000')for(const x of f.xCand||[])if(x!==c)add(x,f,true)}
  return[...set.values()].sort((a,b)=>a.c===m?-1:b.c===m?1:pcRank(a.c)-pcRank(b.c));
}
function pcDecided(p){return!!(p.pcSel&&p.pcSeen)&&pcCands(p).every(x=>p.pcSeen.includes(x.c))}
function pcNeedAsk(p){return!!p&&!p.sample&&pcCands(p).length>1&&!pcDecided(p)}
/* Lỗi thuộc hạng mục phụ của ảnh chưa được người đánh giá chọn: chưa tính điểm */
function pcAltPending(p,f){if(!done(f))return false;const c=pcCodeOf(f,p);if(c==='EH000')return false;return pcNeedAsk(p)&&c!==pcMain(p)}
function pcAskList(){return pcSortPhotos(S.photos.filter(p=>!p.sample&&pcNeedAsk(p)))}
function pcAltList(){const out=[];for(const p of S.photos){if(p.sample)continue;for(const f of p.findings)if(pcAltPending(p,f))out.push({p,f,main:pcMain(p),c:pcCodeOf(f,p)})}return out}
/* Hạng mục được tính cho một lỗi (chính + phụ đã chọn) */
function pcCodesOf(p,f){const c=pcCodeOf(f,p);if(c==='EH000'||pcAltPending(p,f))return c==='EH000'?['EH000']:[];const out=[c];if(pcDecided(p))for(const x of f.xItems||[])if(x!==c&&RBA.codes[x]&&x!=='EH000'&&!out.includes(x))out.push(x);return out}
function pcConfirmSel(p,sel){
  if(!PC.canEdit())return;const cands=pcCands(p),all=cands.map(x=>x.c);sel=all.filter(c=>sel.includes(c));
  if(!sel.length)return toast('Hãy chọn ít nhất một hạng mục.');
  hist(p);
  for(const f of p.findings){if(!done(f))continue;const c=pcCodeOf(f,p);if(c==='EH000')continue;
    if(!sel.includes(c)){const t=(f.xCand||[]).find(x=>sel.includes(x))||sel[0];pcSetCode(f,t)}
    f.xItems=(f.xCand||[]).filter(x=>sel.includes(x)&&x!==f.code)}
  p.pcSel=sel;p.pcMain=sel[0];p.pcSeen=[...new Set([...all,...pcCands(p).map(x=>x.c)])];
  Store.touch(p);toast(sel.length>1?`Đã chọn ${sel.length} hạng mục cho ảnh: ${sel.map(c=>'HM '+RBA.codes[c].no).join(', ')}. Mỗi hạng mục đều bị chấm 0 điểm.`:`Ảnh này chỉ tính hạng mục ${RBA.codes[sel[0]].no}.`);pcAll();
}
function pcResetSel(p){if(!PC.canEdit())return;p.pcSel=null;p.pcSeen=null;for(const f of p.findings)f.xItems=[];Store.touch(p);pcAll()}
function pcAll(){try{renderAll()}catch{}try{renderDesk()}catch{}try{pcRender(true)}catch{}}
/* Khung chọn 1 hoặc nhiều hạng mục cho ảnh */
function pcChooser(p,onDone){
  const cs=pcCands(p),m=pcMain(p);if(cs.length<2)return null;const cur=p.pcSel||[m];
  const rows=cs.map(x=>{const v=RBA.codes[x.c],cb=h('input',{type:'checkbox'});cb.checked=cur.includes(x.c);
    const ts=[...x.fs.map(f=>f.title),...x.ex.map(f=>'(cũng vi phạm) '+f.title)].filter((t,i,a)=>t&&a.indexOf(t)===i).slice(0,3);
    return{c:x.c,cb,el:h('label',{class:'pc-ch'},cb,h('span',null,h('b',null,`Hạng mục ${v.no}. ${v.t}`),x.c===m?h('i',null,'AI chọn trọng tâm'):null,h('small',null,ts.join(' · '))))}});
  const fin=sel=>{pcConfirmSel(p,sel);if(onDone)onDone()};
  return h('div',{class:'pc-alt pc-chs',onclick:e=>e.stopPropagation()},
    h('b',null,`⚠ Ảnh này liên quan ${cs.length} hạng mục. Chọn hạng mục tính điểm (một hoặc nhiều):`),
    ...rows.map(r=>r.el),
    h('div',{class:'pc-altb'},
      h('button',{class:'btn sm primary',onclick:()=>fin(rows.filter(r=>r.cb.checked).map(r=>r.c))},'Xác nhận lựa chọn'),
      h('button',{class:'btn sm',onclick:()=>fin([m])},`Chỉ tính HM ${RBA.codes[m].no} (trọng tâm)`)),
    h('small',{class:'pc-chh'},'Hạng mục được chọn đều bị chấm 0 điểm. Lỗi của hạng mục không chọn được chuyển về hạng mục đã chọn.'));
}
function pcAltBox(p){return pcChooser(p)}
function pcAskDlg(p){
  const ov=h('div',{class:'pc-ov',onclick:e=>{if(e.target===ov)ov.remove()}}),done1=()=>ov.remove(),ch=pcChooser(p,done1);
  if(!ch)return;
  ov.append(h('div',{class:'pc-ovb',role:'dialog','aria-label':'Chọn hạng mục cho ảnh'},h('div',{class:'pc-ovh'},h('img',{src:p.thumb,alt:''}),h('b',null,p.area||p.name||'Ảnh')),ch,h('button',{class:'btn sm',onclick:done1},'Để sau')));
  document.body.append(ov);
}
/* Thứ tự hạng mục 1 → 25 cho toàn app */
function pcPhotoRank(p){if(p.sample)return-1;if(p.pcEvid&&RBA.codes[p.pcEvid])return pcRank(p.pcEvid)+.5;const m=pcMain(p);if(m)return pcRank(m);const e=p.findings.some(f=>done(f)&&pcCodeOf(f,p)==='EH000');return e?90:p.analysis||p.findings.length?95:99}
function pcSortPhotos(arr){const idx=new Map(S.photos.map((p,i)=>[p,i]));return arr.slice().sort((a,b)=>pcPhotoRank(a)-pcPhotoRank(b)||idx.get(a)-idx.get(b))}
function pcFindRank(p,f){return done(f)?pcRank(pcCodeOf(f,p)):98}
{const _aw=applyWhole;applyWhole=function(p,data,quiet){const r=_aw(p,data,quiet);
  try{const m=String((data&&data.main_item)||'').toUpperCase().match(/\b(HM\d{3}|EH000)\b/);if(p.analysis)p.analysis.mainItem=m?m[1]:'';
    p.pcMain='';p.pcSel=null;p.pcSeen=null;Store.touch(p);
    if(pcNeedAsk(p)&&!quiet)setTimeout(()=>toast(`Ảnh có lỗi liên quan ${pcCands(p).length} hạng mục. Hãy chọn một hay nhiều hạng mục để tính điểm.`),1200);
  }catch(e){console.warn(e)}
  return r}}
/* Hạng mục phụ AI đề xuất cho chính lỗi (also_items) và đánh dấu lỗi mơ hồ */
const PC_VAGUE=/(có thể|có vẻ|nghi ngờ|dường như|chưa rõ|cần xác minh|cần kiểm tra thêm|không chắc|hình như)/i;
{const _fa=fillAI;fillAI=function(f,a,k){const r=_fa(f,a,k);
  try{const xs=(Array.isArray(a&&a.also_items)?a.also_items:[]).map(x=>String(x).toUpperCase().match(/HM\d{3}/)).filter(Boolean).map(x=>x[0]).filter(c=>RBA.codes[c]&&c!==f.code);
    f.xCand=[...new Set(xs)].slice(0,2);f.xItems=[];
    f.vague=PC_VAGUE.test(`${f.title||''}`);if(f.vague&&f.src==='ai')f.conf=Math.min(f.conf==null?55:f.conf,55)}catch(e){console.warn(e)}
  return r}}
/* ---------- Màn chấm điểm (trong Báo cáo & dữ liệu) ---------- */
let PC_OPEN='',PC_ARM=0,PC_KIND='ng';
function pcTyping(){const a=document.activeElement;return!!(a&&a.closest&&a.closest('#pcList')&&/^(TEXTAREA|INPUT)$/.test(a.tagName))}
function pcSetOK(c){if(!PC.canEdit())return;if(PC.st.m[c]==='OK')delete PC.st.m[c];else PC.st.m[c]='OK';PC.save();pcRender()}
function pcAddNote(c,t,a){t=String(t||'').trim();if(!t)return toast('Hãy nhập nội dung vấn đề.');if(!PC.canEdit())return;
  (PC.st.n[c]=PC.st.n[c]||[]).push({id:uid(),t:t.slice(0,600),a:String(a||'').trim().slice(0,120)});delete PC.st.m[c];PC.save();PC_OPEN='';pcRender(true)}
function pcDelNote(c,id){if(!PC.canEdit())return;PC.st.n[c]=(PC.st.n[c]||[]).filter(x=>x.id!==id);if(!PC.st.n[c].length)delete PC.st.n[c];PC.save();pcRender(true)}
function pcGoto(p,f){S.listAll=false;S.cur=p.id;S.sel=f.id;if(isMobile())setView('review');else setDView('review');renderAll();try{fit()}catch{}}
function pcRender(force){
  const box=$('pcList');if(!box)return;if(!force&&pcTyping())return;
  const st=pcState(),sum=$('pcSum');
  $('pcN').textContent=st.nOpen?`(còn ${st.nOpen} chưa chấm)`:'(đã chấm đủ)';
  sum.replaceChildren(...[
    h('div',{class:'pcscore'},h('b',{style:`color:${PC_GCOL[st.grade]}`},String(st.score)),h('small',null,'/100'),h('span',{class:'pcgrade',style:`background:${PC_GCOL[st.grade]}`},`Hạng ${st.grade}`)),
    h('div',{class:'pcstat'},h('span',{class:'ng'},`NG ${st.nNG}`),h('span',{class:'ok'},`OK ${st.nOK}`),st.nOpen?h('span',{class:'op'},`Chưa chấm ${st.nOpen}`):null,st.ehs.length?h('span',{class:'eh',title:'Ghi riêng trong PDF, không trừ điểm'},`EHS khác ${st.ehs.length}`):null),
    st.nOpen?h('p',{class:'hint'},st.nOpen===25?'Điểm tạm tính. Chấm OK hoặc NG cho từng hạng mục; hạng mục có lỗi đã xác nhận trên ảnh tự động NG.':`Điểm tạm tính, còn ${st.nOpen} hạng mục chưa chấm.`):null,
    st.nOpen?h('button',{class:'btn sm'+(PC_ARM?' is-armed':''),onclick:e=>{if(!PC.canEdit())return;if(Date.now()-PC_ARM>4000){PC_ARM=Date.now();e.currentTarget.textContent=`Bấm lần nữa: chấm OK cho ${st.nOpen} hạng mục chưa có lỗi`;e.currentTarget.classList.add('is-armed');setTimeout(()=>{PC_ARM=0;pcRender()},4100);return}
      PC_ARM=0;for(const it of st.items)if(!it.st&&!it.pend)PC.st.m[it.c]='OK';PC.save();pcRender(true);toast('Đã chấm OK cho các hạng mục chưa có lỗi. Hạng mục còn lỗi chờ xác nhận được giữ lại.')}},`Chấm OK cho ${st.nOpen} hạng mục chưa có lỗi`):null].filter(Boolean));
  const rows=[];
  const asks=pcAskList();
  if(asks.length)rows.push(h('div',{class:'pc-altlist'},h('h4',null,`Ảnh liên quan nhiều hạng mục: ${asks.length} ảnh cần bạn chọn`),
    h('p',{class:'hint'},'AI đã chọn hạng mục trọng tâm. Chọn thêm hạng mục khác nếu lỗi thực sự vi phạm cả hạng mục đó; lỗi của hạng mục chưa chọn chưa được tính điểm.'),
    ...asks.map(p=>h('div',{class:'pc-alti'},h('button',{class:'pcth',title:'Mở ảnh',onclick:()=>pcGoto(p,p.findings.find(done)||{})},h('img',{src:p.thumb,alt:''})),
      h('div',null,h('span',null,p.area||p.name||'Ảnh'),pcChooser(p))))));
  const FQ=pcFreq();
  for(const g of pcGroups(st)){
    rows.push(h('div',{class:'pcg'},h('b',null,g.g),h('small',null,g.gk),h('span',null,`${g.got}/${g.max}`)));
    for(const it of g.items){const v=it.v,c=it.c,open=PC_OPEN===c;
      const body=[];
      for(const{p,f}of it.faults)body.push(h('li',{class:'pcf'},h('button',{class:'pcth',title:'Mở ảnh',onclick:()=>pcGoto(p,f)},h('img',{src:p.thumb,alt:''})),h('span',null,(p.area?p.area+': ':'')+f.title),pcDelPic(p,f)));
      for(const p of pcSortPhotos(S.photos))if(!p.sample&&p.pcEvid===c)body.push(h('li',{class:'pcf ev'},h('button',{class:'pcth',title:'Mở ảnh',onclick:()=>pcGoto(p,{})},h('img',{src:p.thumb,alt:''})),h('i',{class:'pc-evt'},'Ảnh xác nhận đạt'),h('span',null,(p.area&&p.area!=='Ảnh bổ sung'?p.area+': ':'')+(p.pcNote||'')),pcDelPic(p,null)));
      for(const n of it.notes)body.push(h('li',{class:'pcf note'},h('i',null,'Hồ sơ'),h('span',null,(n.a?n.a+': ':'')+n.t),h('button',{class:'icon','aria-label':'Xóa nội dung này',title:'Xóa',onclick:()=>pcDelNote(c,n.id)},'×')));
      if(it.pend)body.push(h('li',{class:'pcf pend'},h('span',null,`${it.pend} lỗi AI đề xuất đang chờ xác nhận`),h('button',{class:'btn sm btn-cfm',onclick:()=>showReview('pend')},'Đi xác nhận ›')));
      let ed=null;
      if(open){const ta=h('textarea',{rows:3,placeholder:'Nội dung vấn đề, ví dụ: Giấy phép làm việc có lửa chưa có mục kiểm tra tàn lửa sau 1 giờ và 3 giờ'}),ar=h('input',{placeholder:'Khu vực hoặc "Hồ sơ" (không bắt buộc)'});
        const kindOk=h('input',{type:'radio',name:'pck'+c,value:'ok'}),kindNg=h('input',{type:'radio',name:'pck'+c,value:'ng'});(PC_KIND==='ok'?kindOk:kindNg).checked=true;
        const fi=h('input',{type:'file',accept:'image/*',multiple:true,class:'vh',onchange:e=>{const fs=[...e.target.files];e.target.value='';pcAddPhotos(c,fs,ta.value,ar.value,kindOk.checked?'ok':'ng')}});
        ed=h('div',{class:'pced'},ar,ta,
          h('div',{class:'pc-kind'},h('span',null,'Loại ảnh khi chèn:'),h('label',null,kindOk,' Ảnh xác nhận đạt (không trừ điểm)'),h('label',null,kindNg,' Ảnh lỗi (hạng mục 0 điểm)')),
          h('div',{class:'acts'},h('button',{class:'btn sm primary',onclick:()=>pcAddNote(c,ta.value,ar.value)},'Lưu nội dung NG (không ảnh)'),
            h('button',{class:'btn sm pc-addimg',onclick:()=>{if(kindNg.checked&&!String(ta.value).trim()){toast('Ảnh lỗi: nhập nội dung vấn đề trước, rồi chọn ảnh.');ta.focus();return}fi.click()}},'📷 Chèn ảnh'),fi,
            h('button',{class:'btn sm',onclick:()=>{PC_OPEN='';pcRender(true)}},'Hủy')),
          h('p',{class:'hint'},'Chèn ảnh: chọn được nhiều ảnh. "Ảnh xác nhận đạt" dùng cho hạng mục OK (ví dụ ảnh hồ sơ, giấy phép), nội dung không bắt buộc, hạng mục vẫn giữ điểm. "Ảnh lỗi" dùng để bổ sung lỗi, cần nhập nội dung, hạng mục bị 0 điểm. Ảnh có trong file Excel và PDF; chọn nhầm thì bấm × trên ảnh để xóa.'));
        setTimeout(()=>{try{ta.focus()}catch{}},30)}
      rows.push(h('div',{class:'pci '+(it.st==='NG'?'ng':it.st==='OK'?'ok':'op')},
        h('div',{class:'pch'},h('b',{class:'pcno'},String(v.no)),
          h('div',{class:'pct'},h('span',null,v.vi),h('small',null,v.ko),v.doc?h('em',null,'Chủ yếu kiểm tra hồ sơ'):null,FQ.aud[c]>=2?h('em',{class:'pc-freq',title:'Số lần audit trước có lỗi ở hạng mục này'},`Hay vi phạm: ${FQ.aud[c]}/${FQ.nAud} lần audit`):null),
          h('div',{class:'pcp'},h('b',null,it.st==='NG'?'0':String(v.pts)),h('small',null,`/${v.pts}`)),
          h('div',{class:'pcb'},
            h('button',{class:'pcok'+(it.st==='OK'?' on':''),disabled:it.st==='NG',title:it.st==='NG'?'Hạng mục đang có lỗi nên là NG':'Đạt',onclick:()=>pcSetOK(c)},'OK'),
            h('button',{class:'pcng'+(it.st==='NG'?' on':''),title:'Không đạt: thêm nội dung vấn đề',onclick:()=>{PC_KIND='ng';PC_OPEN=open?'':c;pcRender(true)}},it.st==='NG'?`NG · ${it.faults.length+it.notes.length}`:'NG'),
            h('button',{class:'pcimg',title:'Chèn ảnh: ảnh xác nhận cho hạng mục OK hoặc ảnh lỗi bổ sung cho hạng mục NG',onclick:()=>{PC_KIND=it.st==='NG'?'ng':'ok';PC_OPEN=open?'':c;pcRender(true)}},'📷 Chèn ảnh'))),
        body.length?h('ul',{class:'pcl'},...body):null,ed))}
  }
  box.replaceChildren(...rows);
  if(st.ehs.length)box.append(h('div',{class:'pcg eh'},h('b',null,'Lỗi EHS nguy hiểm khác'),h('small',null,'Ghi riêng trong PDF, không trừ điểm'),h('span',null,String(st.ehs.length))),
    h('ul',{class:'pcl ehl'},...st.ehs.map(({p,f})=>h('li',{class:'pcf'},h('button',{class:'pcth',onclick:()=>pcGoto(p,f)},h('img',{src:p.thumb,alt:''})),h('span',null,(p.area?p.area+': ':'')+f.title)))));
  try{renderExportCheck()}catch{}
}
{const _rh=renderHub;renderHub=function(...a){const r=_rh.apply(this,a);try{pcRender()}catch(e){console.warn(e)}return r}}
{const _ra=renderAll;renderAll=function(...a){const r=_ra.apply(this,a);try{if($('pcList')&&$('pcList').offsetParent)pcRender()}catch{}return r}}
{const _ui=uiState;uiState=function(...a){const r=_ui.apply(this,a);try{$('btnFind').disabled=!S.photos.some(p=>!p.sample)&&!Object.keys(PC.st.m).length&&!Object.keys(PC.st.n).length}catch{}return r}}
/* Tổng quan: thẻ điểm */
{const _rd=renderDash;renderDash=function(...a){const r=_rd.apply(this,a);try{const B=$('dashB');if(!B)return r;const st=pcState(),old=B.querySelector('.pcdash');if(old)old.remove();
  const gs=pcGroups(st);
  B.prepend(h('div',{class:'dcard pcdash',style:'grid-column:1/-1'},
    h('div',{class:'pcd-l'},h('small',null,'Điểm checklist PCCC'+(st.nOpen?' (tạm tính)':'')),h('div',{class:'pcscore'},h('b',{style:`color:${PC_GCOL[st.grade]}`},String(st.score)),h('small',null,'/100'),h('span',{class:'pcgrade',style:`background:${PC_GCOL[st.grade]}`},`Hạng ${st.grade}`)),
      h('div',{class:'pcstat'},h('span',{class:'ng'},`NG ${st.nNG}`),h('span',{class:'ok'},`OK ${st.nOK}`),st.nOpen?h('span',{class:'op'},`Chưa chấm ${st.nOpen}`):null,st.ehs.length?h('span',{class:'eh'},`EHS khác ${st.ehs.length}`):null),
      h('button',{class:'btn sm primary',onclick:()=>openHub()},st.nOpen?'Chấm điểm ›':'Xem bảng điểm ›')),
    h('div',{class:'pcd-r'},...gs.map(g=>h('div',{class:'pcbar'},h('span',null,g.g),h('i',null,h('u',{style:`width:${g.max?Math.round(g.got/g.max*100):0}%;background:${g.got===g.max?'#15803D':g.got/g.max>=.5?'#B45309':'#B91C1C'}`})),h('b',null,`${g.got}/${g.max}`))))))}catch(e){console.warn(e)}return r}}

/* ---------- Điều kiện xuất: phải chấm đủ 25 hạng mục ---------- */
exportReady=function(){
  const real=S.photos.filter(p=>!p.sample),its=real.flatMap(p=>p.findings),pend=its.filter(f=>!f.ok).length,ok=its.length-pend;
  const run=real.filter(p=>p.bgRun||p.findings.some(f=>f.pending)).length,uns=real.filter(p=>!p.analysis&&!p.findings.length&&!p.bgRun);
  const vendor=$('mUnit').value.trim(),who=$('mWho').value.trim(),st=pcState();
  const goMeta=id=>()=>{openHub();const d=$(id).closest('details');if(d)d.open=true;setTimeout(()=>$(id).focus(),60)};
  const goPc=()=>{openHub();const d=$('pcBox');if(d){d.open=true;setTimeout(()=>{try{d.scrollIntoView({block:'start',behavior:'smooth'})}catch{}},60)}};
  const checks=[
    {ok:!!vendor,t:vendor?`Công ty: ${vendor}`:'Chưa nhập tên công ty',btn:vendor?null:['Nhập ›',goMeta('mUnit'),'primary']},
    {ok:!!who,warn:!who,t:who?`Người kiểm tra: ${who}`:'Chưa nhập người kiểm tra (PIC), nên nhập',btn:who?null:['Nhập',goMeta('mWho')]},
    {ok:!run,t:run?`AI đang soát ${run} ảnh, chờ xong`:'AI đã soát xong'},
    {ok:!uns.length,warn:!!uns.length,t:uns.length?`${uns.length} ảnh chưa được AI soát`:'Mọi ảnh đã được soát',btn:uns.length&&AI.ok?['Soát ngay',()=>runAll(uns)]:null},
    {ok:!pend,t:pend?`Còn ${pend}/${its.length} lỗi chưa xác nhận`:its.length?`Đã xác nhận hết ${its.length} lỗi`:'Không có lỗi nào từ ảnh',btn:pend?['Đi xác nhận ›',()=>showReview('pend'),'btn-cfm']:null},
    {ok:!st.alt,t:st.alt?`Còn ${st.alt} ảnh liên quan nhiều hạng mục, chưa chọn hạng mục tính điểm`:'Đã chốt hạng mục cho mọi ảnh',btn:st.alt?['Xem ›',goPc,'primary']:null},
    {ok:!st.nOpen,t:st.nOpen?`Còn ${st.nOpen}/25 hạng mục chưa chấm OK hoặc NG`:`Đã chấm đủ 25 hạng mục: ${st.score} điểm, hạng ${st.grade}`,btn:st.nOpen?['Chấm điểm ›',goPc,'primary']:null}];
  const ready=checks.every(c=>c.ok||c.warn);
  return{ready,checks,pend,ok,its,pc:st,why:checks.find(c=>!c.ok&&!c.warn)?.t||''};
};
gateExport=function(){const r=exportReady();if(r.ready)return true;toast(`Chưa xuất được: ${r.why}.`);if(r.pend)showReview('pend');else{openHub();if(r.pc&&r.pc.nOpen){const d=$('pcBox');if(d)d.open=true}}return false};

/* ---------- Dữ liệu xuất: lỗi theo hạng mục, đánh số trong từng hạng mục ---------- */
function pcCollect(){
  const st=pcState(),skip=new Set(pcAltList().map(x=>x.f.id));
  /* Báo cáo PCCC xuất MỌI lỗi đã xác nhận, từng ảnh một: KHÔNG gộp các lỗi giống nhau ở nhiều vị trí thành một dòng "lặp lại" như Audit RBA */
  const raw=p=>{const items=p.findings.map((f,i)=>({f,n:i+1})).filter(x=>fin(x.f));return items.length?{p,items}:null};
  const groups=splitGroupsByCode(pcSortPhotos(S.photos.filter(p=>!p.sample)).map(raw).filter(Boolean).map(g=>({...g,items:g.items.filter(x=>!skip.has(x.f.id))})).filter(g=>g.items.length)),by=new Map(),ehs=[];
  for(const g of groups){const c=pcCodeOf(g.items[0].f,g.p);if(c==='EH000'){ehs.push(g);continue}if(!by.has(c))by.set(c,[]);by.get(c).push(g)}
  /* lỗi được chọn tính thêm hạng mục phụ: ảnh xuất hiện thêm ở hạng mục đó */
  for(const p of pcSortPhotos(S.photos)){if(p.sample)continue;for(const[i,f]of p.findings.entries()){if(!fin(f)||skip.has(f.id))continue;
    for(const x of pcCodesOf(p,f).slice(1)){if(!by.has(x))by.set(x,[]);const gs=by.get(x);let g=gs.find(g=>g.p===p&&g.extra);if(!g){g={p,items:[],extra:true};gs.push(g)}g.items.push({f,n:i+1})}}}
  const rows=st.items.map(it=>{const gs=by.get(it.c)||[],ent=[],pics=[];let n=0;
    for(const g of gs){const items=g.items.map(x=>({f:x.f,n:++n}));pics.push({p:g.p,items});for(const x of items)ent.push({a:g.p.qxg?'':String(g.p.area||'').trim(),t:String(x.f.title||'').trim(),f:x.f})}
    for(const nt of it.notes)ent.push({a:nt.a,t:nt.t,note:true});
    for(const p of pcSortPhotos(S.photos))if(!p.sample&&p.pcEvid===it.c)pics.push({p,items:[],ev:true});
    return{...it,st:ent.length?'NG':it.st,ent,pics}});
  return{st,rows,ehs,groups};
}
function pcTexts(col){const out=[];for(const r of col.rows)for(const e of r.ent)out.push(e.a,e.t);for(const g of col.ehs){out.push(g.p.area);for(const x of g.items)out.push(x.f.title)}return out}
function pcItemText(r,L){
  const k=r.ent.length,num=i=>k>1?`${i+1}. `:'',tr=t=>L?lxT(L,t):'';
  const vi=r.ent.map((e,i)=>`${num(i)}${e.a?e.a+': ':''}${e.t}`);
  if(!L)return vi.join('\n');
  const x=r.ent.map((e,i)=>{const a=e.a?(tr(e.a)||e.a):'',t=tr(e.t);return t?`${num(i)}${a?a+': ':''}${t}`:''}).filter(Boolean);
  return x.length?vi.join('\n')+(k>1?'\n\n':'\n')+x.join('\n'):vi.join('\n');
}

/* ---------- Xuất checklist (.xlsx): điền vào mẫu cố định ---------- */
/* Bố cục Excel v1.0.8: ĐỌC TỪ MẪU CỦA CÔNG TY (bo-cuc-mau.json, do chuan_bi_mau.py tạo khi build).
   Giữ nguyên độ rộng cột, chiều cao hàng, ngắt trang của mẫu. Chỉ hàng có chữ quá dài hoặc từ 3 ảnh trở lên mới cao hơn. */
const PCT=RBA.tpl.lay;
const PCX={emu:9525,colPx:PCT.px.img,textPx:PCT.px.text-14};
const pcRowPt=r=>PCT.ht[r]||PCT.ht[String(r)]||114;
function pcTextPt(text,pt){const px=pt*4/3;let lines=0;for(const l of String(text).split('\n')){let w=0;for(const ch of l)w+=/[ᄀ-ᇿ⺀-鿿가-힣＀-￯]/.test(ch)?px*1.02:/[A-ZĐ0-9]/.test(ch)?px*.66:ch===' '?px*.28:px*.56;lines+=Math.max(1,Math.ceil(w*1.12/PCX.textPx))}return lines*pt*1.32+14}
/* Cỡ chữ ô nội dung NG: 18 → 14 → 11, chọn cỡ lớn nhất vừa chiều cao hàng */
function pcStyle(text,k,maxPt){const left=k>1,S=PCT.st;let last;for(const[pt,c,l]of[[18,S.c18,S.l18],[14,S.c14,S.l14],[11,S.c11,S.l11]]){const hpt=pcTextPt(text,pt);last={s:left?l:c,pt:hpt};if(hpt<=maxPt)return last}return last}
/* ẢNH TRONG Ô: mọi ảnh cùng MỘT kích thước 4:3, luôn căn giữa ô theo cả chiều ngang và dọc, chừa lề đều ở 4 cạnh.
   Kích thước tính từ ô hình ảnh nhỏ nhất của mẫu: 2 ảnh đặt cạnh nhau vẫn vừa chiều ngang, 1 dòng ảnh vừa hàng thấp nhất. */
const PCI=(()=>{const pad=10,gap=8,perLine=2,minRowPx=Math.min(...Object.values(PCT.ht))*4/3;
  let w=Math.floor((PCX.colPx-2*pad-(perLine-1)*gap)/perLine),h=Math.floor(w*3/4);
  if(h>minRowPx-2*pad){h=Math.floor(minRowPx-2*pad);w=Math.floor(h*4/3)}
  return{w,h,gap,pad,scale:4,perLine,max:8}})();
function pcDraw(g,im,p,items,x,y,w,h,mo){drawUniform43(g,im,p,(items||[]).filter(x=>x&&x.f&&x.f.s&&!x.f.whole),x,y,w,h,{...(mo||{}),cover:true})}
async function pcTile(pic,more){
  const W=PCI.w*PCI.scale,H=PCI.h*PCI.scale,c=mk(W,H),g=c.getContext('2d');await fonts();
  g.fillStyle='#FFFFFF';g.fillRect(0,0,W,H);
  const im=await ensureImg(pic.p);if(im)pcDraw(g,im,pic.p,pic.items,0,0,W,H,{lw:Math.max(3,W/180),r:clamp(W/18,16,40),minFrac:.62});
  if(pic.ev){const t='ĐẠT',fs=Math.round(H/9);g.font=`700 ${fs}px ${fontD}`;const tw=g.measureText(t).width+fs;g.fillStyle='#15803D';g.fillRect(W-tw-10,10,tw,fs*1.5);g.fillStyle='#fff';g.textBaseline='middle';g.textAlign='center';g.fillText(t,W-10-tw/2,10+fs*.78)}
  if(more>0){g.fillStyle='rgba(15,23,42,.62)';g.fillRect(0,0,W,H);g.fillStyle='#fff';g.font=`700 ${Math.round(H/3.2)}px ${fontD}`;g.textAlign='center';g.textBaseline='middle';g.fillText(`+${more}`,W/2,H/2)}
  return toBlob(c,'image/jpeg',.88);
}
function pcTileLayout(n){const m=Math.min(n,PCI.max),lines=Math.ceil(m/PCI.perLine),bh=lines*PCI.h+(lines-1)*PCI.gap;return{m,lines,bh,needPx:bh+2*PCI.pad}}
/* Vị trí từng ảnh trong ô: căn giữa khối ảnh trong ô (rowPx × colPx), mỗi dòng ảnh cũng căn giữa */
function pcTilePos(k,m,rowPx){const TL=pcTileLayout(m),line=Math.floor(k/PCI.perLine),inLine=Math.min(PCI.perLine,TL.m-line*PCI.perLine),c=k%PCI.perLine,lw=inLine*PCI.w+(inLine-1)*PCI.gap;
  return{x:Math.max(0,Math.round((PCX.colPx-lw)/2))+c*(PCI.w+PCI.gap),y:Math.max(0,Math.round((rowPx-TL.bh)/2))+line*(PCI.h+PCI.gap)}}
const pcCell=(ref,s,v)=>typeof v==='number'?`<c r="${ref}" s="${s}"><v>${v}</v></c>`:v?`<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`:`<c r="${ref}" s="${s}"/>`;
function pcSetCell(body,ref,xml){const rx=new RegExp(`<c r="${ref}"(?: [^>/]*)?(?:/>|>[\\s\\S]*?</c>)`);if(!rx.test(body))throw new Error('Mẫu thiếu ô '+ref);return body.replace(rx,()=>xml)}
const pcStyleOf=(body,ref,def)=>(body.match(new RegExp(`<c r="${ref}" s="(\\d+)"`))||[])[1]||def;
/* In ấn: giữ ngắt trang của mẫu. Nếu hàng nào phải cao hơn (ngoại lệ) làm một trang bị tràn,
   chỉ giảm tỷ lệ in (scale) cho vừa, không đổi bố cục. */
function pcFitPrint(sh){
  const ps=sh.match(/<pageSetup [^>]*\/>/);if(!ps)return sh;
  const sc0=Number((ps[0].match(/scale="(\d+)"/)||[])[1]||100),land=/orientation="landscape"/.test(ps[0]);
  const pm=sh.match(/<pageMargins [^>]*\/>/),mg=k=>Number(((pm&&pm[0].match(new RegExp(`${k}="([\\d.]+)"`)))||[])[1]||.75);
  const def=Number((sh.match(/defaultRowHeight="([\d.]+)"/)||[])[1]||15),ht={};let maxR=0;
  for(const m of sh.matchAll(/<row r="(\d+)"([^>]*)>/g)){const r=+m[1];maxR=Math.max(maxR,r);const h=m[2].match(/ht="([\d.]+)"/);ht[r]=h?+h[1]:def}
  const brk=[...sh.matchAll(/<brk id="(\d+)"/g)].map(m=>+m[1]).sort((a,b)=>a-b),secs=[];let a=1;
  for(const b of[...brk,maxR]){if(b>=a){secs.push([a,b]);a=b+1}}
  const tall=Math.max(...secs.map(([s,e])=>{let t=0;for(let r=s;r<=e;r++)t+=ht[r]??def;return t}));
  const avail=((land?8.27:11.69)-mg('top')-mg('bottom'))*72*0.97;  /* A4, chừa 3% an toàn */
  const need=Math.floor(100*avail/tall);
  if(need>=sc0)return sh;
  return sh.replace(ps[0],ps[0].replace(/scale="\d+"/,`scale="${Math.max(10,need)}"`));
}
let pcBusy=false;
async function pcExportXlsx(){
  if(pcBusy)return;if(!gateExport())return;
  if(!window.JSZip)return toast('Thư viện tạo file chưa tải xong. Hãy thử lại sau vài giây.');
  const B=$('btnFind'),B2=$('btnFind2'),old=[B.textContent,B2.textContent];pcBusy=true;B.disabled=B2.disabled=true;B.textContent=B2.textContent='Đang tạo…';
  try{
    try{if(typeof qxPrep==='function')await qxPrep()}catch(e){console.warn(e)}
    const col=pcCollect(),L=lxL();let miss=0;
    if(L){busy(cur(),`Đang dịch nội dung sang ${CAPN[L]}…`);try{miss=await lxEnsure(L,pcTexts(col),t=>busy(cur(),t))}catch(e){console.warn(e)}finally{busy(null)}}
    const z=await JSZip.loadAsync(RBA.tpl.b64,{base64:true}),put=(k,v)=>z.file(k,v,{createFolders:false});
    let sh=await z.file('xl/worksheets/sheet1.xml').async('string');
    const T=PCT,C=T.col,date=$('mDate').value||today(),head={[T.info.unit]:$('mUnit').value.trim(),[T.info.who]:$('mWho').value.trim(),[T.info.date]:vnDate(date),[T.info.sub]:$('mSub').value.trim()};
    let pics='',rels='',no=0;const score=col.rows.reduce((s,r)=>s+(r.st==='NG'?0:r.v.pts),0),grade=PC_GRADE(score);
    const byRow=new Map(col.rows.map(r=>[r.v.row,r]));
    const media=[],rowOf=ref=>Number(ref.replace(/\D/g,''));
    sh=sh.replace(/<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g,(m,rn,attrs,body)=>{
      const r=Number(rn);
      /* thông tin đầu trang */
      for(const[ref,v]of Object.entries(head))if(rowOf(ref)===r)body=pcSetCell(body,ref,pcCell(ref,pcStyleOf(body,ref,'0'),v));
      if(rowOf(T.grade)===r)body=body.replace(new RegExp(`(<c r="${T.grade}"[^>]*>[\\s\\S]*?<v>)[^<]*(</v>)`),`$1${grade}$2`);
      if(r===T.total.row)body=body.replace(new RegExp(`(<c r="${T.total.score}"[^>]*>[\\s\\S]*?<v>)[^<]*(</v>)`),`$1${score}$2`);
      const it=byRow.get(r);
      if(it){
        const allPics=it.pics,TL=pcTileLayout(allPics.length);let pt=pcRowPt(r),sty=null,text='';
        if(allPics.length)pt=Math.max(pt,TL.needPx*.75);
        if(it.st==='NG'){text=pcItemText(it,L);sty=pcStyle(text,it.ent.length,pt);pt=Math.max(pt,sty.pt)}
        pt=Math.min(409,Math.round(pt*4)/4);
        attrs=(/ht="/.test(attrs)?attrs.replace(/ht="[\d.]+"/,`ht="${pt}"`):attrs+` ht="${pt}"`);attrs=/customHeight=/.test(attrs)?attrs.replace(/customHeight="[^"]*"/,'customHeight="1"'):attrs+' customHeight="1"';
        const sc=C.score+r,rs=C.res+r,tx=C.text+r,okS=pcStyleOf(body,sc,'0');
        if(it.st==='NG'){body=pcSetCell(body,sc,pcCell(sc,T.st.ng,0));body=pcSetCell(body,rs,pcCell(rs,T.st.ng,'NG'));body=pcSetCell(body,tx,pcCell(tx,sty.s,text))}
        else{body=pcSetCell(body,sc,pcCell(sc,okS,it.v.pts));body=pcSetCell(body,rs,pcCell(rs,pcStyleOf(body,rs,okS),'OK'))}
        if(allPics.length){const rowPx=pt*4/3;
          for(let k=0;k<TL.m;k++){const{x,y}=pcTilePos(k,TL.m,rowPx);no++;
            media.push({no,pic:allPics[k],more:k===TL.m-1&&allPics.length>TL.m?allPics.length-TL.m+1:0});
            rels+=`<Relationship Id="rId${no}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${no}.jpeg"/>`;
            pics+=`<xdr:oneCellAnchor><xdr:from><xdr:col>${T.imgCol0}</xdr:col><xdr:colOff>${x*PCX.emu}</xdr:colOff><xdr:row>${r-1}</xdr:row><xdr:rowOff>${y*PCX.emu}</xdr:rowOff></xdr:from><xdr:ext cx="${PCI.w*PCX.emu}" cy="${PCI.h*PCX.emu}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${no+1}" name="HM${it.v.no} anh ${k+1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${no}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${PCI.w*PCX.emu}" cy="${PCI.h*PCX.emu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`}}
      }
      return`<row r="${rn}"${attrs}>${body}</row>`});
    sh=pcFitPrint(sh);
    for(const{no:k,pic,more}of media)put(`xl/media/image${k}.jpeg`,await pcTile(pic,more));
    put('xl/worksheets/sheet1.xml',sh);
    put('xl/drawings/drawing1.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pics}</xdr:wsDr>`);
    put('xl/drawings/_rels/drawing1.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);
    const blob=await z.generateAsync({type:'blob',compression:'DEFLATE',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    await saveFile(`Checklist-PCCC_${safeName($('mUnit').value||'kiem-tra')}_${date.split('-').reverse().join('')}.xlsx`,blob);
    inheritAfterExport(col.groups).catch(e=>console.error(e));
    const notes=[`${score} điểm, hạng ${grade}`];if(miss>0)notes.push(`${miss} câu chưa dịch được nên chỉ có tiếng Việt`);if(col.ehs.length)notes.push(`${col.ehs.reduce((s,g)=>s+g.items.length,0)} lỗi EHS khác chỉ có trong PDF`);
    setTimeout(()=>toast('Đã xuất checklist: '+notes.join('; ')+'.'),900);
  }catch(e){console.error(e);toast('Không tạo được file checklist. Hãy thử lại.')}
  finally{pcBusy=false;B.textContent=old[0];B2.textContent=old[1];uiState();try{renderExportCheck()}catch{}}
}
exportFindings=pcExportXlsx;

/* ---------- PDF báo cáo nhanh (16:9): bìa có điểm, bảng điểm, danh sách NG, mỗi ảnh một trang ---------- */
const PCL={
  vi:{score:'Điểm đánh giá',grade:'Xếp hạng',cls:'Phân loại',board:'Bảng điểm 25 hạng mục',item:'Hạng mục',std:'Chuẩn',got:'Đạt',res:'Kết quả',nglist:'Nội dung NG theo hạng mục',ehs:'Lỗi EHS nguy hiểm khác (không tính điểm)',ehsShort:'EHS khác',tot:'Tổng',ngItems:'Hạng mục NG',faults:'Số lỗi',photos:'Số ảnh',noNG:'Không có hạng mục NG.',doc:'Hồ sơ'},
  ko:{score:'점검 점수',grade:'등급',cls:'구분',board:'점검 항목별 점수',item:'점검 항목',std:'기준',got:'점수',res:'결과',nglist:'항목별 부적합 내용',ehs:'기타 중대 EHS 위험 (점수 미반영)',ehsShort:'기타 EHS',tot:'합계',ngItems:'부적합 항목',faults:'부적합 건수',photos:'사진 수',noNG:'부적합 항목 없음.',doc:'기록'},
  zh:{score:'检查得分',grade:'等级',cls:'分类',board:'25项检查得分表',item:'检查项目',std:'标准分',got:'得分',res:'结果',nglist:'各项目不符合内容',ehs:'其他重大EHS隐患（不计分）',ehsShort:'其他EHS',tot:'合计',ngItems:'不符合项目',faults:'问题数',photos:'照片数',noNG:'无不符合项目。',doc:'记录'},
  en:{score:'Score',grade:'Grade',cls:'Category',board:'Scores of 25 items',item:'Item',std:'Std',got:'Score',res:'Result',nglist:'NG details by item',ehs:'Other major EHS hazards (not scored)',ehsShort:'Other EHS',tot:'Total',ngItems:'NG items',faults:'Findings',photos:'Photos',noNG:'No NG item.',doc:'Record'}};
const pcLab=(k,L)=>L==='vi'||!PCL[L]?PCL.vi[k]:`${PCL.vi[k]} / ${PCL[L][k]}`;
const PCW=1920,PCH=1080,PCM=64,PCNAVY='#14324A';
function pcFrame(g,L,FB,title,sub,page,total){
  g.fillStyle='#FFFFFF';g.fillRect(0,0,PCW,PCH);g.fillStyle=PCNAVY;g.fillRect(0,0,PCW,10);g.textBaseline='alphabetic';g.textAlign='left';
  g.fillStyle='#14191C';g.font=`700 44px ${FB}`;g.fillText(trunc(g,title,PCW-2*PCM-520),PCM,92);
  if(sub){g.fillStyle='#1F4E8C';g.font=`500 26px ${FB}`;g.fillText(trunc(g,sub,PCW-2*PCM-520),PCM,130)}
  g.textAlign='right';const ven=$('mUnit').value.trim();if(ven){g.fillStyle='#14191C';fitFont(g,ven,500,`600 #px ${FB}`,28,20);g.fillText(trunc(g,ven,500),PCW-PCM,80)}
  g.fillStyle='#55626A';g.font=`400 24px ${FB}`;g.fillText(vnDate($('mDate').value),PCW-PCM,ven?118:96);g.textAlign='left';
  g.fillStyle='#E3E8EA';g.fillRect(PCM,158,PCW-2*PCM,2);
  g.fillStyle='#8A979D';g.font=`400 22px ${FB}`;g.fillText(capLab('rep',L),PCM,PCH-36);g.textAlign='right';g.fillText(`${page} / ${total}`,PCW-PCM,PCH-36);g.textAlign='left';
}
function pcChip(g,x,y,text,bg,FB,size){g.font=`700 ${size}px ${FB}`;const w=g.measureText(text).width+size*1.1,hh=size*1.55;g.fillStyle=bg;rrect(g,x,y,w,hh,hh/2);g.fill();g.fillStyle='#fff';g.textBaseline='middle';g.textAlign='left';g.fillText(text,x+size*.55,y+hh/2+1);g.textBaseline='alphabetic';return w}
async function pcCover(col,L){
  await fonts();const FB=fontL(L),W=PCW,H=PCH,c=mk(W,H),g=c.getContext('2d'),st=col.st,score=col.rows.reduce((s,r)=>s+(r.st==='NG'?0:r.v.pts),0),grade=PC_GRADE(score);
  g.fillStyle='#FFFFFF';g.fillRect(0,0,W,H);g.fillStyle=PCNAVY;g.fillRect(0,0,780,H);g.fillStyle='#F5C518';g.fillRect(0,0,780,14);g.textAlign='left';g.textBaseline='alphabetic';
  let y=300;g.fillStyle='#FFFFFF';g.font=`700 88px ${fontD}`;for(const l of wrapX(g,CAPL.vi.rep,620)){g.fillText(l,90,y);y+=94}
  if(L!=='vi'){y+=14;g.fillStyle='#F5C518';g.font=`600 52px ${FB}`;for(const l of wrapX(g,CAPL[L].rep,620)){g.fillText(l,90,y);y+=64}}
  y+=30;g.fillStyle='#C9D6E2';g.font=`400 30px ${FB}`;for(const l of wrapX(g,'Checklist kiểm tra PCCC · 25 hạng mục · 100 điểm',620)){g.fillText(l,90,y);y+=42}
  g.fillStyle='#8FA6BA';g.font=`600 26px ${FB}`;g.fillText('Audit PCCC',90,H-70);
  const X=880,VW=W-X-90,rows=[['ven',$('mUnit').value.trim()],['date',vnDate($('mDate').value)],['who',$('mWho').value.trim()],['cls',$('mSub').value.trim()]].filter(r=>r[1]);
  let ry=120;for(const[k,v]of rows){g.fillStyle='#55626A';g.font=`400 24px ${FB}`;g.fillText(trunc(g,k==='cls'?pcLab('cls',L):capLab(k,L),VW),X,ry);
    g.fillStyle='#14191C';fitFont(g,v,VW,`700 #px ${FB}`,44,26);g.fillText(trunc(g,v,VW),X,ry+54);g.fillStyle='#E3E8EA';g.fillRect(X,ry+80,VW,2);ry+=128}
  const by=Math.max(ry+10,660),bh=H-by-90;g.fillStyle='#F3F6F8';rrect(g,X,by,VW,bh,24);g.fill();
  g.fillStyle='#55626A';g.font=`400 26px ${FB}`;g.fillText(pcLab('score',L),X+40,by+56);
  g.fillStyle=PC_GCOL[grade];g.font=`700 190px ${fontD}`;const sw=g.measureText(String(score)).width;g.fillText(String(score),X+40,by+bh-56);
  g.fillStyle='#55626A';g.font=`600 60px ${fontD}`;g.fillText('/100',X+52+sw,by+bh-60);
  const gx=X+VW-250;g.fillStyle=PC_GCOL[grade];rrect(g,gx,by+44,210,210,28);g.fill();g.fillStyle='#fff';g.textAlign='center';g.font=`700 150px ${fontD}`;g.fillText(grade,gx+105,by+200);
  g.fillStyle='#55626A';g.font=`400 24px ${FB}`;g.fillText(pcLab('grade',L),gx+105,by+292);g.textAlign='left';
  const nf=col.rows.reduce((s,r)=>s+r.ent.length,0),np=col.rows.reduce((s,r)=>s+r.pics.length,0)+col.ehs.length,nn=col.rows.filter(r=>r.st==='NG').length,ne=col.ehs.reduce((s,x)=>s+x.items.length,0);
  const sx=X+40+sw+170,sww=gx-sx-24;let sy=by+bh-56-3*40-(ne?40:0)+30;
  for(const[k,v]of[['ngItems',`${nn}/25`],['faults',String(nf)],['photos',String(np)],...(ne?[['ehsShort',String(ne)]]:[])]){g.fillStyle='#55626A';g.font=`400 23px ${FB}`;const lb=trunc(g,PCL.vi[k]+':',sww-70);g.fillText(lb,sx,sy);g.fillStyle='#14191C';g.font=`700 25px ${FB}`;g.fillText(v,sx+g.measureText(lb).width+34,sy);sy+=40}
  return c;
}
async function pcBoard(col,L,page,total){
  await fonts();const FB=fontL(L),c=mk(PCW,PCH),g=c.getContext('2d');pcFrame(g,L,FB,PCL.vi.board,L==='vi'?'':PCL[L].board,page,total);
  const top=186,bot=PCH-78,colW=(PCW-2*PCM-40)/2,per=13,rh=(bot-top-44)/per,score=col.rows.reduce((s,r)=>s+(r.st==='NG'?0:r.v.pts),0);
  for(let k=0;k<2;k++){const x=PCM+k*(colW+40);g.fillStyle='#EEF2F5';g.fillRect(x,top,colW,40);g.fillStyle='#55626A';g.font=`600 20px ${FB}`;g.textAlign='left';
    g.fillText('No',x+14,top+27);g.fillText(pcLab('item',L),x+70,top+27);g.textAlign='center';g.fillText(pcLab('std',L).split(' / ')[0],x+colW-250,top+27);g.fillText(pcLab('got',L).split(' / ')[0],x+colW-160,top+27);g.fillText(pcLab('res',L).split(' / ')[0],x+colW-62,top+27);g.textAlign='left';
    const part=col.rows.slice(k*per,k*per+per);
    part.forEach((r,i)=>{const y=top+44+i*rh,ng=r.st==='NG';if(ng){g.fillStyle='#FFF7CC';g.fillRect(x,y,colW,rh-3)}
      g.fillStyle='#14191C';g.font=`700 26px ${fontD}`;g.fillText(String(r.v.no),x+16,y+rh*.5+8);
      const tw=colW-70-300;g.font=`500 18px ${FB}`;g.fillStyle='#14191C';const vl=wrapX(g,r.v.vi,tw).slice(0,2),more=wrapX(g,r.v.vi,tw).length>2;let ty=y+(vl.length>1?17:27);vl.forEach((l,q)=>{g.fillText(q===1&&more?trunc(g,l+' …',tw):l,x+70,ty);ty+=21});
      g.font=`400 14px ${FB}`;g.fillStyle='#1F4E8C';g.fillText(trunc(g,r.v.ko,tw),x+70,ty-2);
      g.textAlign='center';g.fillStyle='#55626A';g.font=`500 24px ${FB}`;g.fillText(String(r.v.pts),x+colW-250,y+rh*.5+8);
      g.fillStyle=ng?'#B91C1C':'#14191C';g.font=`700 26px ${FB}`;g.fillText(ng?'0':String(r.v.pts),x+colW-160,y+rh*.5+8);g.textAlign='left';
      pcChip(g,x+colW-100,y+rh*.5-17,ng?'NG':'OK',ng?'#B91C1C':'#15803D',FB,20);
      g.fillStyle='#E3E8EA';g.fillRect(x,y+rh-3,colW,1)});
    if(k===1){const y=top+44+part.length*rh;g.fillStyle=PCNAVY;g.fillRect(x,y,colW,rh-3);g.fillStyle='#fff';g.font=`700 28px ${FB}`;g.fillText(pcLab('tot',L),x+70,y+rh*.5+9);g.textAlign='center';g.fillText('100',x+colW-250,y+rh*.5+9);g.fillStyle='#F5C518';g.font=`700 32px ${FB}`;g.fillText(String(score),x+colW-160,y+rh*.5+10);g.font=`700 28px ${FB}`;g.fillText(PC_GRADE(score),x+colW-62,y+rh*.5+9);g.textAlign='left'}}
  return c;
}
/* Danh sách NG: chia trang theo chiều cao chữ */
/* Danh sách lỗi chi tiết: MỌI lỗi của mọi hạng mục NG (kể cả lỗi không ảnh) và lỗi EHS khác.
   Mỗi lỗi: số thứ tự, khu vực: nội dung, bản dịch (không in mức độ, biện pháp khắc phục). Hạng mục dài được chia sang trang sau, không cắt bớt. */
const PC_SEV={Priority:'Nghiêm trọng',Major:'Lớn',Minor:'Nhỏ'};
function pcNgBlocks(col,L,FB){
  const m=mk(10,10).getContext('2d'),tw=PCW-2*PCM-90,out=[];
  const mkLines=(ents)=>{const lines=[];ents.forEach((e,i)=>{
      m.font=`600 25px ${FB}`;const vi=`${ents.length>1?i+1+'. ':''}${e.a?e.a+': ':''}${e.t}`;for(const l of wrapX(m,vi,tw))lines.push({t:l,c:'#14191C',f:`600 25px ${FB}`,hh:34,k:i});
      if(L!=='vi'){const x=lxT(L,e.t);if(x){m.font=`400 22px ${FB}`;const a=e.a?(lxT(L,e.a)||e.a)+': ':'';for(const l of wrapX(m,a+x,tw))lines.push({t:l,c:'#1F4E8C',f:`400 22px ${FB}`,hh:30,k:i})}}
      lines.push({gap:12,k:i})});return lines};
  for(const r of col.rows){if(r.st!=='NG')continue;out.push({head:{no:`${r.v.no}`,t:r.v.vi,s:`0/${r.v.pts}`,c:'#B91C1C'},lines:mkLines(r.ent)})}
  const eh=col.ehs.flatMap(g=>g.items.map(x=>({a:g.p.qxg?'':String(g.p.area||'').trim(),t:String(x.f.title||'').trim(),f:x.f})));
  if(eh.length)out.push({head:{no:'EHS',t:PCL.vi.ehs,s:'—',c:'#7C3AED'},lines:mkLines(eh)});
  return out;
}
/* Chia trang theo từng dòng: không dòng nào bị bỏ; phần nối tiếp có tiêu đề "(tiếp)". Không tách giữa một lỗi nếu lỗi đó vừa một trang. */
function pcNgPages(blocks){
  const max=PCH-78-186,HEAD=58,END=14,pages=[];let cur=[],hh=0;
  const flush=()=>{if(cur.length){pages.push(cur);cur=[];hh=0}};
  for(const b of blocks){
    const groups=[];for(const l of b.lines){const g=groups[groups.length-1];if(g&&g.k===l.k)g.ls.push(l);else groups.push({k:l.k,ls:[l]})}
    let part={head:b.head,cont:false,lines:[]},ph=HEAD+END;
    const room=()=>max-hh;
    if(room()<HEAD+END+120)flush();
    for(const g of groups){const gh=g.ls.reduce((s,l)=>s+(l.gap||l.hh),0);
      if(ph+gh>room()&&part.lines.length){cur.push(part);hh+=ph;flush();part={head:b.head,cont:true,lines:[]};ph=HEAD+END}
      for(const l of g.ls){const lh=l.gap||l.hh;if(ph+lh>room()&&part.lines.length){cur.push(part);hh+=ph;flush();part={head:b.head,cont:true,lines:[]};ph=HEAD+END}part.lines.push(l);ph+=lh}}
    cur.push(part);hh+=ph}
  flush();return pages;
}
function pcNgCanvas(blocks,L,FB,page,total,part,parts){
  const c=mk(PCW,PCH),g=c.getContext('2d');pcFrame(g,L,FB,PCL.vi.nglist+(parts>1?` (${part}/${parts})`:''),L==='vi'?'':PCL[L].nglist,page,total);
  let y=186;
  for(const b of blocks){const h0=b.head;g.fillStyle='#F3F6F8';g.fillRect(PCM,y,PCW-2*PCM,46);const w=pcChip(g,PCM+10,y+7,h0.no,h0.c,FB,21);
    g.fillStyle='#14191C';g.font=`700 25px ${FB}`;g.fillText(trunc(g,h0.t+(b.cont?' (tiếp)':''),PCW-2*PCM-w-220),PCM+24+w,y+32);g.textAlign='right';g.fillStyle=h0.c;g.font=`700 25px ${FB}`;g.fillText(h0.s,PCW-PCM-14,y+32);g.textAlign='left';
    y+=58;for(const l of b.lines){if(l.gap){y+=l.gap;continue}g.fillStyle=l.c;g.font=l.f;g.fillText(l.t,PCM+70,y+l.hh*.74);y+=l.hh}y+=14}
  return c;
}
/* Trang ảnh có nhiều lỗi không vừa một trang (chữ nhỏ nhất 16 px) thì chia sang trang nối tiếp cùng ảnh, không bỏ lỗi nào */
function pcSlideChunks(items,L,FB){
  const m=mk(10,10).getContext('2d'),bh=(PCH-82)-188,tw=PCW-PCM-(PCM+980+52+66);
  const hOf=(f,z)=>{const lh=Math.round(z*1.3),xs=Math.round(z*.88),xlh=Math.round(xs*1.3),cs=Math.max(15,Math.round(z*.62)),ch=Math.round(cs*1.55)+8;
    m.font=`600 ${z}px ${FB}`;const tl=wrapX(m,f.title,tw).length,tr=L==='vi'?'':capOf(L,f.title);m.font=`500 ${xs}px ${FB}`;const xl=tr?wrapX(m,tr,tw).length:0,fx=0;
    return ch+tl*lh+(xl?8+xl*xlh:0)+(fx?6+fx*xlh:0)+Math.round(z*.9)};
  const all=items.reduce((s,x)=>s+hOf(x.f,16),0);if(all<=bh)return[items];
  const out=[];let cur=[],hh=0;for(const x of items){const v=hOf(x.f,20);if(cur.length&&hh+v>bh){out.push(cur);cur=[];hh=0}cur.push(x);hh+=v}if(cur.length)out.push(cur);return out;
}
/* Một ảnh một trang: ảnh có khoanh vùng bên trái, lỗi kèm số hạng mục bên phải */
async function pcSlide(p,items,idx,L,page,total,only,cont){
  const im=await ensureImg(p);await fonts();
  const FB=fontL(L),W=PCW,H=PCH,M=PCM,c=mk(W,H),g=c.getContext('2d');
  g.fillStyle='#FFFFFF';g.fillRect(0,0,W,H);g.textBaseline='alphabetic';g.textAlign='left';g.fillStyle=PCNAVY;g.fillRect(0,0,W,10);
  rrect(g,M,40,88,88,16);g.fill();g.fillStyle='#FFFFFF';g.font=`700 46px ${fontD}`;g.textAlign='center';g.textBaseline='middle';g.fillText(String(idx+1).padStart(2,'0'),M+44,86);g.textAlign='left';g.textBaseline='alphabetic';
  const area=(String(p.area||'').trim()||`${CAPL.vi.photo} ${idx+1}`)+(cont?' (tiếp)':''),areaX=L==='vi'?'':capOf(L,p.area),hx=M+116,hw=W-M-hx-640;
  g.fillStyle='#14191C';fitFont(g,area,hw,`700 #px ${FB}`,46,26);g.fillText(trunc(g,area,hw),hx,areaX?82:100);
  if(areaX){g.fillStyle='#1F4E8C';fitFont(g,areaX,hw,`500 #px ${FB}`,32,20);g.fillText(trunc(g,areaX,hw),hx,126)}
  g.textAlign='right';const ven=$('mUnit').value.trim();if(ven){g.fillStyle='#14191C';fitFont(g,ven,600,`600 #px ${FB}`,28,20);g.fillText(trunc(g,ven,600),W-M,80)}
  g.fillStyle='#55626A';g.font=`400 24px ${FB}`;g.fillText(vnDate($('mDate').value),W-M,ven?118:96);g.textAlign='left';g.fillStyle='#E3E8EA';g.fillRect(M,158,W-2*M,2);
  const top=188,bot=H-82,bh=bot-top,FW=980,FH=735,px=M,py=top+(bh-FH)/2,nos=items.map(x=>({...x,f:{...x.f,sev:''}}));
  pcDraw(g,im,p,nos,px,py,FW,FH,{lw:Math.max(3.5,FW/340),r:clamp(FW/46,18,26),minFrac:.82});g.strokeStyle='#D8E0EA';g.lineWidth=2;g.strokeRect(px,py,FW,FH);
  const single=items.length<=1,x0=px+FW+52,tx=x0+(single?24:66),tw=W-M-tx,cols=colorsOf(items);
  let F=null;
  for(const z of[34,31,28,26,24,22,20,18,16]){const lh=Math.round(z*1.3),xs=Math.round(z*.88),xlh=Math.round(xs*1.3),cs=Math.max(15,Math.round(z*.62)),ch=Math.round(cs*1.55)+8,gap=Math.round(z*.9);let tot=0;
    const bl=items.map(({f,n})=>{g.font=`600 ${z}px ${FB}`;const tl=wrapX(g,f.title,tw),tr=L==='vi'?'':capOf(L,f.title);g.font=`500 ${xs}px ${FB}`;const xl=tr?wrapX(g,tr,tw):[];const fx=[];const hh=ch+tl.length*lh+(xl.length?8+xl.length*xlh:0)+(fx.length?6+fx.length*xlh:0);tot+=hh+gap;return{f,n,tl,xl,fx,hh}});
    tot-=gap;F={z,lh,xs,xlh,cs,ch,gap,bl,tot};if(tot<=bh)break}
  g.save();g.beginPath();g.rect(x0-6,top-6,W-M-x0+12,bh+12);g.clip();
  let y=top+Math.max(0,(bh-F.tot)/2);
  F.bl.forEach((b,i)=>{let ty=y;const code=only||pcCodeOf(b.f,p),v=RBA.codes[code],eh=code==='EH000';
    if(single){g.fillStyle=cols[b.f.id][0];rrect(g,x0,ty+4,8,Math.max(24,b.hh-8),4);g.fill()}else badge(g,b.n,'',x0+26,ty+F.ch+F.lh*.5,clamp(F.z*.6,14,23),cols[b.f.id]);
    const okEv=b.f.pcEvidence===true,cw=pcChip(g,tx,ty,okEv?`${PCL.vi.item} ${v.no} · Đạt`:eh?pcLab('ehsShort',L).split(' / ')[L==='vi'?0:1]||PCL.vi.ehsShort:`${PCL.vi.item} ${v.no}`,okEv?'#15803D':eh?'#7C3AED':'#B91C1C',FB,F.cs);
    g.fillStyle='#55626A';g.font=`500 ${F.cs}px ${FB}`;g.fillText(trunc(g,eh?PCL.vi.ehs:okEv?`${v.t} · ${v.pts}/${v.pts}`:`${v.t} · 0/${v.pts}`,tw-cw-14),tx+cw+12,ty+F.cs*1.15);ty+=F.ch;
    g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle='#14191C';g.font=`600 ${F.z}px ${FB}`;b.tl.forEach(l=>{g.fillText(l,tx,ty+F.lh*.78);ty+=F.lh});
    if(b.xl.length){ty+=8;g.fillStyle='#1F4E8C';g.font=`500 ${F.xs}px ${FB}`;b.xl.forEach(l=>{g.fillText(l,tx,ty+F.xlh*.78);ty+=F.xlh})}
    if(b.fx.length){ty+=6;g.fillStyle='#166534';g.font=`500 ${F.xs}px ${FB}`;b.fx.forEach(l=>{g.fillText(l,tx,ty+F.xlh*.78);ty+=F.xlh})}
    y+=b.hh;if(i<F.bl.length-1){g.fillStyle='#E3E8EA';g.fillRect(x0,y+F.gap/2-1,W-M-x0,2);y+=F.gap}});
  g.restore();
  g.fillStyle='#8A979D';g.font=`400 22px ${FB}`;g.textAlign='left';g.fillText(capLab('rep',L),M,H-36);g.textAlign='right';g.fillText(`${page} / ${total}`,W-M,H-36);g.textAlign='left';
  return c;
}
exportPdf=async function(){
  if(pdfBusy)return;if(!gateExport())return;
  const L=capLang(),btns=['btnPdf','prevPdf'].map(id=>$(id)).filter(Boolean),old=btns.map(b=>b.textContent),say=t=>btns.forEach(b=>{b.textContent=t;b.disabled=true});
  pdfBusy=true;
  try{
    try{if(typeof qxPrep==='function')await qxPrep()}catch(e){console.warn(e)}
    const col=pcCollect();let miss=0;
    if(L!=='vi'){say('Đang dịch nội dung…');try{miss=await lxEnsure(L,pcTexts(col),say)}catch(e){console.warn(e)}}
    await fonts();const FB=fontL(L);
    /* Ảnh xếp đúng thứ tự hạng mục 1 → 25, mỗi trang một ảnh của một hạng mục (không gộp hạng mục), cuối cùng là lỗi EHS khác */
    const slides=[...col.rows.flatMap(r=>r.pics.map(pc=>({p:pc.p,items:pc.ev?[{f:{id:'ev'+pc.p.id,title:pc.p.pcNote||'Ảnh xác nhận hạng mục đạt yêu cầu',sev:'',pcEvidence:true,whole:true,s:{t:'rect',x:0,y:0,w:1,h:1}},n:1}]:pc.items,code:r.c}))),...col.ehs.map(g=>({p:g.p,items:g.items,code:'EH000'}))],ngPages=pcNgPages(pcNgBlocks(col,L,FB));
    const sl=[];let pno=-1;for(const x of slides){const ch=x.items[0]&&x.items[0].f.pcEvidence?[x.items]:pcSlideChunks(x.items,L,FB);pno++;ch.forEach((items,k)=>sl.push({...x,items,idx:pno,cont:k>0}))}
    const N=2+ngPages.length+sl.length,pages=[];let pg=0;
    const push=async(c,q)=>{pages.push({blob:await toBlob(c,'image/jpeg',q||.88),w:c.width,h:c.height});c.width=c.height=0;await new Promise(r=>setTimeout(r,0))};
    say(`Đang tạo PDF ${++pg}/${N}…`);await push(await pcCover(col,L),.9);
    say(`Đang tạo PDF ${++pg}/${N}…`);await push(await pcBoard(col,L,pg,N),.9);
    for(const[i,bl]of ngPages.entries()){say(`Đang tạo PDF ${++pg}/${N}…`);await push(pcNgCanvas(bl,L,FB,pg,N,i+1,ngPages.length),.9)}
    for(const{p,items,code,idx,cont}of sl){say(`Đang tạo PDF ${++pg}/${N}…`);await push(await pcSlide(p,items,idx,L,pg,N,code,cont),.86)}
    const ven=$('mUnit').value.trim(),date=$('mDate').value||today();
    const blob=await buildPdf(pages,`${CAPL.vi.rep}${ven?' – '+ven:''} – ${vnDate(date)}`);
    await saveFile(`Bao-cao-nhanh-PCCC_${safeName(ven||'kiem-tra')}_${date.split('-').reverse().join('')}.pdf`,blob);
    if(miss>0)toast(`Lưu ý: ${miss} câu chưa dịch được (chưa có mạng hoặc key AI), tạm hiện tiếng Việt.`);
  }catch(e){console.error(e);toast('Không tạo được PDF. Hãy thử lại.')}
  finally{pdfBusy=false;btns.forEach((b,k)=>{b.textContent=old[k];b.disabled=false});syncCap();try{renderExportCheck()}catch{}}
};
{const _sc=syncCap;syncCap=function(...a){const r=_sc.apply(this,a);try{if($('btnPdf')&&!pdfBusy)$('btnPdf').textContent=`Xuất PDF báo cáo nhanh (${CAPS[capLang()]})`;if($('prevPdf')&&!pdfBusy)$('prevPdf').textContent='Xuất PDF báo cáo nhanh'}catch{}return r}}
/* Các nút không dùng trong bản PCCC */
for(const id of['btnDocx','prevDocx','btnRev'])try{if($(id))$(id).hidden=true}catch{}
try{const i=$('libFile');if(i)i.setAttribute('accept','.json,application/json')}catch{}

/* ---------- Chọn tay hạng mục vi phạm (Xác nhận lỗi > Sửa, Sửa nhóm lỗi lặp lại) ----------
   Người đánh giá chọn đúng hạng mục để tránh AI gán sai. Đổi hạng mục: lỗi chuyển sang hạng mục mới
   (hạng mục mới 0 điểm, hạng mục cũ hết lỗi thì về chưa chấm), loại lỗi mẫu không thuộc hạng mục mới bị bỏ,
   giữ nguyên nội dung. AI ghi nhận lần sửa vào Sổ kinh nghiệm khi bấm Xác nhận. */
function pcItemLabel(c){const v=RBA.codes[c];return v?(v.no?`${v.no}. ${v.t} (${v.pts} điểm)`:'EHS nguy hiểm khác (không tính điểm)'):'— Chưa chọn —'}
function pcCodeSelect(cur,onPick){
  const groups=[];for(const c of RBA.order){const v=RBA.codes[c];let g=groups[groups.length-1];if(!g||g.n!==v.g){g={n:v.g,l:[]};groups.push(g)}g.l.push(c)}
  return h('select',{class:'pc-hm','aria-label':'Hạng mục vi phạm',onchange:e=>{if(e.target.value)onPick(e.target.value)}},
    cur&&RBA.codes[cur]?null:h('option',{value:'',selected:true},'— Chọn hạng mục —'),
    ...groups.map(g=>h('optgroup',{label:g.n},...g.l.map(c=>h('option',{value:c,selected:c===cur},pcItemLabel(c))))),
    h('optgroup',{label:'Ngoài checklist'},h('option',{value:'EH000',selected:cur==='EH000'},pcItemLabel('EH000'))));
}
function pcSetCode(f,c){
  const v=RBA.codes[c];if(!v||f.code===c)return false;
  f.code=c;f.req=v.r[0][0];f.law=v.l[0]?v.l[0][1]:'';
  if(f.rule&&RULES[f.rule]&&RULES[f.rule].c!==c)f.rule='';
  f.codeManual=true;f.userEdited=true;return true;
}
/* Danh sách loại lỗi mẫu: chỉ hiện lỗi mẫu của hạng mục đang chọn */
function pcFilterRules(sel,c){
  if(!sel)return;let any=false;
  for(const og of sel.querySelectorAll('optgroup')){let n=0;for(const o of og.querySelectorAll('option')){const r=RULES[o.value],on=!c||!r||r.c===c;o.hidden=!on;o.disabled=!on;if(on)n++}og.hidden=!n;og.disabled=!n;if(n)any=true}
  const first=sel.querySelector('option[value=""]');
  if(first&&!sel.value)first.textContent=any?'— Chọn lỗi mẫu của hạng mục này (không bắt buộc) —':'— Hạng mục này chưa có lỗi mẫu —';
}
{const _ie=iEditor;iEditor=function(p,f,n){
  const el=_ie(p,f,n);
  try{resolveRbaCode(f,p);const box=el.querySelector('.ifs'),sRule=el.querySelector('select[aria-label="Loại lỗi theo danh mục"]');
    const sHm=pcCodeSelect(f.code,c=>{if(!PC.canEdit()){sHm.value=f.code;return}hist(p);if(pcSetCode(f,c)){Store.touch(p);
      const others=p.findings.filter(x=>x!==f&&done(x)&&pcCodeOf(x,p)!=='EH000');if(!others.length||others.every(x=>pcCodeOf(x,p)===c))p.pcMain='';
      toast(c==='EH000'?'Đã chuyển lỗi sang "EHS nguy hiểm khác": ghi riêng, không trừ điểm.':pcNeedAsk(p)?`Đã chuyển lỗi sang hạng mục ${RBA.codes[c].no}. Ảnh này liên quan nhiều hạng mục, hãy chọn hạng mục tính điểm ở khung bên trên.`:`Đã chuyển lỗi sang hạng mục ${RBA.codes[c].no}. Hạng mục này bị chấm 0 điểm khi lỗi được xác nhận.`);
      renderList();renderDesk();try{pcRender(true)}catch{}}});
    const lab=h('label',{class:'pc-hml'},h('span',null,'Hạng mục vi phạm (chọn tay nếu AI gán sai)'),sHm,
      h('small',{class:'pc-hmh'},f.code==='EH000'?'Lỗi EHS ngoài checklist: chỉ ghi trong PDF, không trừ điểm.':`Hạng mục có lỗi đã xác nhận được chấm 0/${(RBA.codes[f.code]||{}).pts||0} điểm.`+(f.codeManual?' · Đã chọn tay':'')));
    pcFilterRules(sRule,f.code);
    if(sRule){const lr=sRule.closest('label');if(lr&&lr.firstChild&&lr.firstChild.nodeType===3)lr.firstChild.textContent='Loại lỗi mẫu (trong hạng mục đã chọn)'}
    if(box){const ref=box.querySelector('.g2')||box.firstChild;box.insertBefore(lab,ref)}
    if(box&&pcNeedAsk(p)){const ab=pcChooser(p);if(ab)box.insertBefore(ab,lab)}
    else if(box&&pcDecided(p)&&p.pcSel.length>1)box.insertBefore(h('p',{class:'pc-altok'},`Ảnh này tính ${p.pcSel.length} hạng mục: ${p.pcSel.map(c=>'HM '+RBA.codes[c].no).join(', ')}.`,h('button',{class:'btn sm',onclick:()=>pcResetSel(p)},'Chọn lại')),lab)
  }catch(e){console.warn(e)}
  return el}}
/* Sửa nhóm lỗi lặp lại: chọn hạng mục áp cho mọi vị trí trong nhóm */
if(typeof gxEdit==='function'){const _gx=gxEdit;gxEdit=function(g){
  const r=_gx(g);
  try{const d=$('gxDlg'),body=d&&d.querySelector('.gxbody'),sR=d&&d.querySelector('select[aria-label="Loại lỗi theo danh mục"]'),R=g.rep.f;resolveRbaCode(R,g.rep.p);
    const sHm=pcCodeSelect(R.code,c=>{if(!PC.canEdit()){sHm.value=R.code;return}const touched=new Set();
      for(const x of g.items){if(!touched.has(x.p)){hist(x.p);touched.add(x.p)}pcSetCode(x.f,c)}for(const p of touched)Store.touch(p);
      pcFilterRules(sR,c);if(sR)sR.value='';toast(`Đã chuyển ${g.items.length} lỗi của nhóm sang ${c==='EH000'?'"EHS nguy hiểm khác"':'hạng mục '+RBA.codes[c].no}.`);try{pcRender(true)}catch{}});
    pcFilterRules(sR,R.code);
    const lab=h('label',{class:'gxf pc-hml'},h('span',null,'Hạng mục vi phạm (áp cho cả nhóm, chọn tay nếu AI gán sai)'),sHm);
    const anchor=sR&&sR.closest('label');if(body&&anchor){body.insertBefore(lab,anchor);const sp=anchor.querySelector('span');if(sp)sp.textContent='Loại lỗi mẫu (trong hạng mục đã chọn)'}
    if(d)d.addEventListener('close',()=>{try{qxRefresh()}catch{}},{once:true});
  }catch(e){console.warn(e)}
  return r}}

/* v1.0.4 — Nút chọn nhanh hạng mục ngay trên dòng lỗi (bảng Xác nhận lỗi + thẻ điện thoại) */
function pcQuick(p,f,mob){
  const c0=(typeof pcCodeOf==='function'?pcCodeOf(f,p):'')||f.code,cur=RBA.codes[c0]?c0:'';
  const s=pcCodeSelect(cur,nc=>{try{hist(p)}catch{}if(pcSetCode(f,nc)){if(p.pcSel&&p.pcSeen&&nc!=='EH000'){if(!p.pcSel.includes(nc))p.pcSel.push(nc);if(!p.pcSeen.includes(nc))p.pcSeen.push(nc)}Store.touch(p);toast(`Đã chuyển lỗi sang hạng mục ${pcItemLabel(nc)}`);pcAll()}});
  s.classList.add('pc-q');s.title='Bấm để chọn đúng hạng mục trong 25 hạng mục checklist';
  for(const ev of['click','mousedown','pointerdown','touchstart','keydown'])s.addEventListener(ev,e=>e.stopPropagation());
  const ask=pcNeedAsk(p),xs=done(f)&&pcDecided(p)?(f.xItems||[]).filter(x=>x!==c0&&RBA.codes[x]):[];
  const stop=e=>e.stopPropagation();
  return h('span',{class:'pc-qw'+(mob?' mob':'')+(cur?'':' empty')},
    h('span',{class:'pc-ql',text:mob?'Hạng mục:':'▾'}),s,
    ...xs.map(x=>h('span',{class:'pc-qx',title:'Lỗi này được chọn tính thêm hạng mục '+RBA.codes[x].no},`+HM ${RBA.codes[x].no}`)),
    ask?h('button',{type:'button',class:'pc-qa',title:'Ảnh này liên quan nhiều hạng mục: bấm để chọn một hoặc nhiều hạng mục tính điểm',onclick:e=>{stop(e);pcAskDlg(p)},onpointerdown:stop},'⚠ Chọn HM'):null,
    f.rejSim&&!f.ok?h('span',{class:'pc-qv',title:'Giống một phán định người đánh giá đã loại trước đây. Xem lại trước khi xác nhận.'},'Từng bị loại'):f.vague&&!f.ok?h('span',{class:'pc-qv',title:'Nội dung AI viết còn mơ hồ (có thể, nghi ngờ…). Xem lại ảnh trước khi xác nhận.'},'Mơ hồ'):null);
}
/* Nút xóa nhanh trên dòng lỗi (bấm 2 lần) */
function pcDelBtn(p,f){return h('button',{type:'button',class:'btn sm danger pc-del',title:f.src==='ai'&&!f.ok?'Xóa: không phải lỗi (AI ghi nhận để lần sau không báo lại)':'Xóa lỗi',onclick:e=>{e.stopPropagation();if(!PC.canEdit())return;iDel(e.currentTarget,p,f,f.src==='ai'&&!f.ok?'reject':'')}},'🗑 Xóa')}
/* Danh mục lỗi: nhóm theo 25 hạng mục checklist (không dùng nhóm RBA) */
catGroups=function(fn){
  const out=[];
  for(const c of[...RBA.order,'EH000']){const v=RBA.codes[c];if(!v)continue;
    const l=RBA.rules.filter(r=>r.c===c&&(!fn||fn(r))).sort((a,b)=>sevRank(a.v)-sevRank(b.v)||a.id.localeCompare(b.id,'vi',{numeric:true}));
    if(!l.length)continue;
    const lb=v.no?`Hạng mục ${v.no} · ${v.t}`:'EH000 · EHS nguy hiểm khác';
    CAT_TIER[lb]=v.no?v.g:'Ngoài checklist (không tính điểm)';out.push([lb,l])}
  return out;
};


/* v1.0.5 — Thứ tự hạng mục 1 → 25 cho bảng Xác nhận lỗi */
function pcRowCmp(a,b){return pcFindRank(a.p,a.f)-pcFindRank(b.p,b.f)||pcPhotoRank(a.p)-pcPhotoRank(b.p)||a.pi-b.pi||a.n-b.n}
/* v1.0.5 — Chèn ảnh lỗi phát sinh / bổ sung ngay ở màn chấm điểm */
async function pcAddPhotos(c,files,text,area,kind){
  if(!PC.canEdit())return;const v=RBA.codes[c],ok=kind==='ok';files=[...files].filter(isImgF);text=String(text||'').trim();
  if(!v)return;if(!files.length)return toast('Hãy chọn ảnh JPG hoặc PNG.');if(!ok&&!text)return toast('Ảnh lỗi: nhập nội dung vấn đề trước, rồi chọn ảnh.');
  let n=0;S.photos=S.photos.filter(p=>!p.sample);
  for(const[i,file]of files.entries()){
    try{toast(files.length>1?`Đang chèn ảnh ${i+1}/${files.length}…`:'Đang chèn ảnh…');const cv=await decodeImg(file);
      const p=makePhoto({name:file.name||'Ảnh bổ sung',img:cv,w:cv.width,h:cv.height,blob:await toBlob(cv,'image/jpeg',.9),thumb:thumbOf(cv),by:who1(),at:Date.now()});
      p.area=String(area||'').trim()||(ok?'Ảnh xác nhận':'Ảnh bổ sung');
      p.analysis={scene:`Ảnh ${ok?'xác nhận đạt':'lỗi bổ sung'} do người đánh giá chèn cho hạng mục ${v.no}`,ok:[],verify:[],mainItem:ok?'':c,manual:true};
      if(ok){p.pcEvid=c;p.pcNote=text.slice(0,300)}
      else{const r=RBA.rules.find(x=>x.c===c),f=newFinding({t:'rect',x:0,y:0,w:1,h:1},{title:text.slice(0,600),src:'manual',user:true,whole:true,sev:(r&&SEV.includes(r.v)?r.v:'Major'),kind:'violation'});
        pcSetCode(f,c);f.ok=true;p.findings.push(f);p.pcSel=[c];p.pcSeen=[c];p.pcMain=c}
      S.photos.push(p);Store.touch(p);touchImg(p);n++}
    catch(e){console.error(e)}}
  if(!n)return toast('Không đọc được ảnh. Hãy chọn ảnh JPG hoặc PNG.');
  if(ok){if(!pcState().items.find(x=>x.c===c&&x.st==='NG'))PC.st.m[c]='OK'}else delete PC.st.m[c];
  PC.save();PC_OPEN='';pcAll();
  toast(ok?`Đã chèn ${n} ảnh xác nhận vào hạng mục ${v.no}. Ảnh có trong file Excel và PDF.`:`Đã chèn ${n} ảnh lỗi vào hạng mục ${v.no}. Hạng mục bị chấm 0 điểm; ảnh có trong file Excel và PDF.`);
}
/* Xóa nhanh ảnh/lỗi chọn nhầm ở màn chấm điểm (bấm 2 lần). Ảnh chèn tay: xóa cả ảnh. Ảnh hiện trường: chỉ xóa lỗi này. */
function pcDelPic(p,f){
  const whole=!!(p.analysis&&p.analysis.manual)&&(!f||p.findings.filter(done).length<=1);
  return h('button',{type:'button',class:'icon pc-xdel','aria-label':whole?'Xóa ảnh này':'Xóa lỗi này',title:whole?'Xóa ảnh (chọn nhầm)':'Xóa lỗi này khỏi hạng mục',onclick:e=>{e.stopPropagation();if(!PC.canEdit())return;const b=e.currentTarget;
    if(!b.dataset.arm){b.dataset.arm='1';b.classList.add('is-armed');b.textContent='Xóa?';setTimeout(()=>{if(b.isConnected){delete b.dataset.arm;b.classList.remove('is-armed');b.textContent='×'}},4000);return}
    if(whole){removePhoto(p.id);toast('Đã xóa ảnh.')}else{hist(p);p.findings=p.findings.filter(x=>x!==f);Store.touch(p);toast('Đã xóa lỗi.')}
    pcAll()}},'×');
}
/* v1.0.5 — Học từ các lần kiểm tra: hạng mục hay vi phạm, cách ghi lỗi đã xác nhận, phán định bị loại, gán nhầm */
function pcFreq(){
  const ven=libNorm(($('mUnit')&&$('mUnit').value)||''),cnt={},tt={},aud={};
  const put=(c,t,w)=>{if(!RBA.codes[c]||c==='EH000')return;cnt[c]=(cnt[c]||0)+w;t=String(t||'').trim();if(!t)return;const m=tt[c]=tt[c]||new Map(),k=libNorm(t),e=m.get(k)||{t,n:0};e.n+=w;m.set(k,e)};
  try{for(const x of Lib.items||[])put(x.code,x.vi,(x.n||1)*(ven&&libNorm(x.vendor||'')===ven?2:1))}catch{}
  for(const p of S.photos){if(p.sample)continue;for(const f of p.findings)if(fin(f))for(const c of pcCodesOf(p,f))put(c,f.title,1)}
  let nAud=0;try{for(const a of HIST.items||[]){nAud++;for(const c of new Set(a.codes||[]))aud[c]=(aud[c]||0)+1}}catch{}
  return{cnt,tt,aud,nAud};
}
function pcFreqPrompt(){
  const F=pcFreq(),top=Object.keys(F.cnt).sort((a,b)=>F.cnt[b]-F.cnt[a]).slice(0,8),out=[];
  if(top.length){out.push('Hạng mục hay vi phạm và cách ghi lỗi đã được xác nhận (soi kỹ các hạng mục này; đúng tình huống thì dùng đúng hạng mục và cách diễn đạt):');
    for(const c of top){const v=RBA.codes[c],ts=[...(F.tt[c]||new Map()).values()].sort((a,b)=>b.n-a.n).slice(0,3).map(e=>`"${e.t.slice(0,140)}"`);out.push(`- ${c} · Hạng mục ${v.no} (${F.cnt[c]} lần${F.aud[c]?`, ${F.aud[c]}/${F.nAud} lần audit`:''}): ${ts.join('; ')}`)}}
  const L=(typeof Learn!=='undefined'&&Learn.items)||[];
  const rej=L.filter(x=>x.t==='reject'||x.t==='unclear').slice(0,14);
  if(rej.length){out.push('Phán định đã bị người đánh giá loại vì không phải lỗi hoặc mơ hồ (KHÔNG báo lại khi tình huống tương tự):');for(const x of rej)out.push(`- [${(x.to&&x.to.code)||'?'}] "${String(x.title).slice(0,140)}"${x.area?` (khu ${x.area})`:''}`)}
  const mis=L.filter(x=>x.t==='fix'&&x.from&&x.to&&x.from.code&&x.to.code&&x.from.code!==x.to.code).slice(0,10);
  if(mis.length){out.push('Đã từng gán nhầm hạng mục, phải dùng hạng mục đúng:');for(const x of mis)out.push(`- "${String(x.title).slice(0,120)}": ${x.from.code} → đúng là ${x.to.code}`)}
  return out.length?`HỌC TỪ CÁC LẦN KIỂM TRA TRƯỚC (để phán định đúng trọng tâm, không báo lỗi mơ hồ)\n${out.join('\n')}\n\n`:'';
}
{const _lf=lessonsFor;lessonsFor=function(p){let s='';try{s=_lf(p)}catch{}try{s+=pcFreqPrompt()}catch(e){console.warn(e)}return s}}
/* Lỗi AI mới giống phán định đã bị loại trước đó → hạ độ chắc chắn để không đưa vào báo cáo */
{const _fa2=fillAI;fillAI=function(f,a,k){const r=_fa2(f,a,k);
  try{if(f.src==='ai'&&f.title){const L=(typeof Learn!=='undefined'&&Learn.items)||[];const hit=L.find(x=>(x.t==='reject'||x.t==='unclear')&&x.title&&tSim(x.title,f.title)>=.8&&(!x.to||!x.to.code||x.to.code===f.code));
    if(hit){f.rejSim=true;f.conf=Math.min(f.conf==null?50:f.conf,50)}}}catch(e){console.warn(e)}
  return r}}

window.__PC={photos:()=>S.photos,alts:pcAltList,main:pcMain,state:pcState,collect:pcCollect,st:()=>PC.st,xlsx:pcExportXlsx,pdf:()=>exportPdf(),freq:()=>pcFreqPrompt(),add:(c,fs,t,a,k)=>pcAddPhotos(c,fs,t,a,k),del:(p,f)=>pcDelPic(p,f),sel:(p,s)=>pcConfirmSel(p,s),asks:()=>pcAskList(),cat:()=>catGroups(),openCat:()=>openCat()};
