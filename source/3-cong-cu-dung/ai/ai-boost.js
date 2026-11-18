/* ================= Tăng độ chính xác AI (v1.4) =================
   Gắn vào app qua patch_ai.py, chạy trong cùng phạm vi với mã app và cloud.js.
   1. Danh sách kiểm tra theo khu vực, mốc mức độ, quy tắc chọn mã, mẫu khắc phục: bổ sung vào lời nhắc.
   2. Học chung cả đội: lấy lỗi đã xác nhận trên máy chủ (cùng khu vực, cùng công ty) làm mẫu.
   3. AI tự kiểm tra lại: sau khi soát, gửi ảnh có khung đánh số + ảnh phóng to từng lỗi để AI xác nhận, sửa mã, mức độ, mô tả; loại lỗi không chắc; bổ sung lỗi rõ ràng bị sót.
   4. Cố định cách trả lời: giảm độ ngẫu nhiên (Gemini 2.x), đọc ảnh độ phân giải cao.
   5. Ghi nhận quyết định của người đánh giá (giữ, sửa, loại, bỏ sót) lên máy chủ để thống kê độ chính xác theo mã. */
const AIX={
  cfg:Object.assign({verify:true,team:true,owner:true,det:true,hires:true},(()=>{try{return JSON.parse(localStorage.getItem('soat-pccc-aix')||'{}')}catch{return{}}})()),
  mr:localStorage.getItem('soat-pccc-aix-mr')!=='0',detOk:localStorage.getItem('soat-pccc-aix-det')!=='0',
  save(){try{localStorage.setItem('soat-pccc-aix',JSON.stringify(this.cfg))}catch{}},
  gen(model,o){
    const g={};
    if(this.cfg.det&&this.detOk&&/gemini-(1|2)\./.test(model)){g.temperature=0.2;g.topP=0.8;g.seed=17}
    if(this.mr&&o&&o.images&&o.images.length)g.mediaResolution='MEDIA_RESOLUTION_HIGH';
    return g;
  },
  genFail(m){
    m=String(m||'');
    if(this.mr&&/media.?resolution/i.test(m)){this.mr=false;try{localStorage.setItem('soat-pccc-aix-mr','0')}catch{}return true}
    if(this.detOk&&/seed|temperature|top.?p/i.test(m)){this.detOk=false;try{localStorage.setItem('soat-pccc-aix-det','0')}catch{}return true}
    return false;
  }
};
window.__AIX=AIX;

/* ---------- 1. Danh sách kiểm tra theo khu vực ---------- */
const AREA_CK=[
  {n:'Khu vực hàn, cắt, mài, thi công có lửa',k:/h[aà]n|c[aắ]t|m[aà]i|thi c[oô]ng|h[oỏ]a kh[ií]|c[oó] l[uử]a|sinh nhi[eệ]t|nh[aà] th[aầ]u|hot ?work|weld/i,i:[
    'Giấy phép làm việc có lửa dán hoặc treo tại vị trí; đọc ngày, ca, chữ ký phê duyệt nếu rõ (A1, A2)','Thợ hàn, cắt: mặt nạ hoặc kính hàn, găng tay da, tạp dề, giày (A4)',
    'Bình oxy, gas: dựng đứng, có xích, nắp chụp, van chống cháy ngược, ống dẫn không nứt; cách xa điểm hàn (A5, A6)','Máy hàn, cáp hàn, kìm hàn: không hở lõi, không nối băng keo, vỏ máy nối đất (A7)',
    'Vật dễ cháy trong bán kính 11 m: carton, pallet, nilon, xốp, dung môi, giẻ dầu (A8)','Vật không di dời được: có phủ bạt chống cháy, màn chắn tia lửa đúng loại, che kín (A9, A10)',
    'Người giám sát lửa đứng tại chỗ (A11); ít nhất 2 bình chữa cháy trong tầm với (A12)','Sau khi làm: xỉ hàn, tàn lửa, vật còn khói (A14); mục kiểm tra sau 1 giờ và 3 giờ trên giấy phép (A13)',
    'Lối thoát nạn, cửa thoát nạn cạnh nơi thi công bị vật tư, giàn giáo chắn (A15); đèn EXIT bị che hoặc tắt (A16)']},
  {n:'Trần nhà, khoảng trần, mái',k:/tr[aầ]n|la ph[oô]ng|m[aá]i|tr[eê]n cao|ceiling/i,i:[
    'Vật dễ cháy, phế liệu thi công, bao bì, ống, dây thừa bỏ lại trên tấm trần, máng cáp (B1); bụi, xơ bám dày (B2)','Dây điện nằm trực tiếp trên trần, không ống luồn, không máng (B3)',
    'Mối nối quấn băng keo, đầu dây treo ngoài hộp; hộp nối không nắp (B4)','Dây ra khỏi hộp đấu nối không có đầu siết cáp, ống bảo vệ (B5)','Vỏ dây nứt, cháy sém, bị gặm (B6); cách nhiệt, bảo ôn rách, bong, cháy sém (B7)',
    'Lỗ xuyên trần, xuyên tường quanh cáp, ống chưa bịt bằng vật liệu chống cháy (B8)','Đầu báo cháy: tuột dây, chỉ còn đế, bị bọc nilon, bị sơn (E1, E2); nhìn rõ phần lớn trần mà không có đầu báo (E5)','Đầu phun sprinkler bị che, sơn, hàng xếp quá sát (E10)']},
  {n:'Tủ điện, bảng phân phối, trạm điện',k:/t[uủ] đi[eệ]n|b[aả]ng đi[eệ]n|ph[oò]ng đi[eệ]n|tr[aạ]m|bi[eế]n [aá]p|m[aá]y ph[aá]t|aptomat|panel|mcc|ats|ngu[oồ]n/i,i:[
    'Dấu hiệu quá nhiệt: cháy sém, đổi màu, nhựa chảy ở đầu cos, aptomat, thanh cái (C9)','Vật dễ cháy, vật lạ trong tủ: giấy, giẻ, nilon, găng tay, đồ cá nhân (C10)',
    'Hàng hóa, carton, pallet để sát hoặc chắn trước tủ (C11)','Cửa tủ mở, mất cửa, không khóa, thiếu tấm che phần mang điện (C12)','Tủ bụi bẩn, dầu mỡ (C8); dây thừa, dây cũ bỏ trong tủ (C6, C7)',
    'Đầu cos: không bấm chặt, sai cỡ, lõi đồng tòe (C16); chưa bọc cách điện, lộ kim loại (C17); nhiều dây đấu chung một cực (C25)','Dây trong tủ đổi màu, chảy nhựa (C18); aptomat, contactor cháy sém, nứt vỏ (C26); vết đánh lửa, muội đen (C32); ảnh nhiệt có điểm nóng (C20)',
    'Ốc siết, bulông lỏng (C21); đầu nối, thanh cái gỉ, oxy hóa (C19); thanh cái không có tấm che (C22)','Lỗ cáp, lỗ kỹ thuật của tủ chưa bịt (C23); cửa tủ hỏng bản lề, khóa, không đóng kín (C24); nước thấm, đọng trong hoặc trên tủ (C30); quạt, lưới lọc tắc (C31)',
    'Thiếu dây nối đất vỏ tủ, cửa tủ (C27); thiếu tên tủ, biển cảnh báo điện (C28); aptomat không nhãn mạch, không có sơ đồ điện (C29)',
    'Trạm điện, phòng máy phát, phòng kỹ thuật: vật dễ cháy để trong phòng (D2); không có bình chữa cháy hoặc bình cầu tự động (E11); không có đầu báo cháy (E5)','Lỗ luồn cáp vào tủ, xuyên tường chưa bịt kín (B8)']},
  {n:'Dây điện, ổ cắm, thiết bị điện tại xưởng',k:/d[aâ]y đi[eệ]n|ổ c[aắ]m|o cam|ph[ií]ch|c[aá]p|đi[eệ]n|electric|x[uư][oở]ng|chuy[eề]n|line/i,i:[
    'Vỏ dây trầy, nứt, hở lõi, bị kẹp, bị đè (C1)','Dây thả lỏng, không cố định, cọ vào cạnh sắc (C34); dây chui qua lỗ kim loại không có vòng đệm, ống lót (C35)','Dây tạm, dây kéo trên sàn, lối đi, vắt qua máy, rối không có máng (C2)','Ổ cắm kéo dài cắm nối tiếp, một ổ cắm chật kín phích (C3)',
    'Mối nối xoắn quấn băng keo, không hộp nối (C4)','Ổ cắm, phích, công tắc vỡ, cháy sém, cắm dây trần vào ổ (C5)','Dây không còn dùng treo lủng lẳng, đầu dây hở (C6)']},
  {n:'Máy móc, thiết bị sản xuất',k:/m[aá]y|thi[eế]t b[iị]|đ[oộ]ng c[oơ]|s[oơ]n|[eé]p|m[aạ]|anod|coating|inject|l[oò]|s[aấ]y|n[eé]n kh[ií]/i,i:[
    'Rò rỉ dầu, vũng dầu, giẻ dầu chất quanh máy (C13)','Bụi, xơ, bụi sơn, mạt bám dày trên động cơ, quạt, ống hút, tủ điều khiển (C14)','Dấu hiệu quá nhiệt: cháy sém, đổi màu, bốc khói (C15)',
    'Vật dễ cháy cạnh nguồn nhiệt: lò, máy sấy, bộ gia nhiệt, ống xả (D9)','Dung môi, sơn, cồn để tại chuyền ngoài tủ quy định, mở nắp, không nhãn (D5, D7)','Dây điện, ổ cắm quanh máy (C1 đến C5)']},
  {n:'Kho, khu tập kết chất thải, khu ngoài nhà xưởng',k:/kho|ch[aấ]t th[aả]i|r[aá]c|ph[eế] li[eệ]u|b[aã]i|ngo[aà]i nh[aà]|ngo[aà]i x[uư][oở]ng|pallet|k[eệ]|warehouse/i,i:[
    'Chất thải nhựa, xốp, bao bì, carton để ngoài khu quy định, chất đống trên lối đi (D1); rác tràn thùng (D3)','Pallet, carton xếp sát vách nhà xưởng, dưới mái hiên, cạnh trạm gas, trạm điện (D4)',
    'Hàng xếp sát đầu phun sprinkler, che đầu báo cháy (E10, E2)','Bình chữa cháy, tủ họng nước bị hàng che chắn (E6, E9)','Lối thoát nạn, cửa thoát nạn trong kho bị chắn, khóa (E21, E22, E23)','Hút thuốc, tàn thuốc trong kho (D10)']},
  {n:'Kho hóa chất, dung môi, sơn, khí dễ cháy',k:/h[oó]a ch[aấ]t|dung m[oô]i|s[oơ]n|gas|lpg|x[aă]ng|d[aầ]u|c[oồ]n|thinner|chemical|kh[ií] d[eễ] ch[aá]y/i,i:[
    'Chất lỏng dễ cháy để ngoài kho, ngoài tủ chống cháy, vượt lượng dùng trong ca (D5)','Bình gas, bình khí dễ cháy ngoài khu quy định, không xích, không nắp chụp (D6)',
    'Can, phuy mở nắp, không nhãn, không khay chống tràn (D7)','Đèn, quạt, công tắc, ổ cắm trong kho không phải loại phòng nổ; không có quạt hút; phuy không tiếp địa khi chiết rót (D8)',
    'Thiếu biển cấm lửa, cấm hút thuốc (E28); thiếu bình chữa cháy phù hợp (E11)','Vật dễ cháy khác, nguồn nhiệt, tia lửa gần kho (D9)']},
  {n:'Lối thoát nạn, cửa thoát hiểm, hành lang, cầu thang',k:/tho[aá]t|exit|h[aà]nh lang|c[aầ]u thang|l[oố]i đi|c[uử]a|corridor|stair/i,i:[
    'Cửa thoát nạn bị khóa, xích, niêm phong, chốt ngoài (E21)','Hàng hóa, thiết bị chắn trước hoặc sau cửa (E23); vật cản trên lối đi, cầu thang (E22)','Đèn EXIT, đèn chiếu sáng sự cố: thiếu, tắt, bị che (E24)',
    'Chiều mở cửa: phải mở theo hướng thoát ra; cửa cuốn, cửa trượt làm lối thoát duy nhất (E25)','Cửa thoát buộc dây, chèn, cài then (E37); hỏng tay nắm, thanh đẩy, kẹt (E36)',
    'Lối thoát bị máy, kệ lấn làm hẹp (E34); sàn lối thoát có dầu, nước, dây, ống gây vấp (E35); phía ngoài cửa thoát bị hàng rào, xe, vật tư chắn (E33)','Biển, đèn EXIT bị hàng, thiết bị che khuất (E32); ngã rẽ không có biển chỉ hướng (E31); chỉ còn một lối ra, lối thứ hai bị bịt (E38)','Cửa chống cháy bị chèn mở, tháo tay co, không tự khép (E17); hỏng gioăng, kính, khóa (E18)',
    'Sơ đồ thoát nạn, danh sách liên lạc khẩn cấp, tiêu lệnh tại khu vực (E26, E27, E28)']},
  {n:'Bình chữa cháy, tủ họng nước, phòng bơm, tủ báo cháy',k:/b[iì]nh ch[uữ]a ch[aá]y|c[uứ]u h[oỏ]a|pccc|h[oọ]ng n[uư][oớ]c|sprinkler|b[oơ]m|b[aá]o ch[aá]y|van|fire/i,i:[
    'Bình: bị che chắn (E6); kim ngoài vùng xanh, mất chốt, vòi nứt, vỏ gỉ (E7); đặt trên sàn, sai vị trí (E8)','Tem, thẻ bảo dưỡng: đọc ngày, quá 6 tháng so với ngày kiểm tra hoặc không có tem (E16); phiếu kiểm tra hằng tháng bỏ trống (E15)',
    'Tủ họng nước: bị chắn, thiếu vòi, lăng phun (E9); trụ nước ngoài nhà bị che, mất nắp (E12)','Van đường ống chữa cháy: sai trạng thái, không khóa, không biển (E13)',
    'Tủ bơm chữa cháy không ở chế độ tự động, đồng hồ áp lực về 0 (E14)','Tủ trung tâm báo cháy: đèn lỗi, đèn cô lập sáng, tắt chuông, mất nguồn (E3); nút nhấn, chuông hỏng hoặc bị che (E4)']},
  {n:'Hồ sơ, giấy phép, bảng tin (ảnh chụp tài liệu)',k:/h[oồ] s[oơ]|gi[aấ]y ph[eé]p|bi[eê]n b[aả]n|b[aả]ng tin|ni[eê]m y[eế]t|s[oổ]|checklist|t[aà]i li[eệ]u/i,i:[
    'Giấy phép làm việc có lửa: chữ ký phê duyệt của Tổng giám đốc, ngày giờ hiệu lực, vị trí, mục kiểm tra trước khi làm (A2)','Mục kiểm tra tàn lửa sau 1 giờ và sau 3 giờ: có ghi giờ và chữ ký không (A13)',
    'Biên bản đào tạo an toàn cho công nhân, nhà thầu trước khi làm (A3)','Sổ, biên bản tự kiểm tra PCCC hằng tháng (E29); hồ sơ huấn luyện, diễn tập (E30)',
    'Bảng tin: sơ đồ thoát nạn, mạng lưới liên lạc khẩn cấp, quy trình báo cháy, sơ tán (E26, E27)','Chỉ kết luận khi đọc được nội dung tài liệu trong ảnh; không đọc được thì ghi vào "verify"']}
];
function areaLists(text){
  const t=String(text||'');const hit=AREA_CK.filter(a=>a.k.test(t)).slice(0,2);
  if(!hit.length)return `DANH SÁCH KIỂM TRA THEO KHU VỰC\nChưa rõ loại khu vực. Trước tiên xác định ảnh chụp gì (khu hàn cắt, trần nhà, tủ điện, dây và ổ cắm, máy móc, kho, khu chất thải, kho hóa chất dễ cháy, lối thoát nạn, phương tiện chữa cháy, hồ sơ giấy phép), rồi rà theo các mục điển hình của loại đó trong 25 hạng mục checklist.\n\n`;
  return `DANH SÁCH KIỂM TRA THEO KHU VỰC (rà từng mục; mục nào nhìn thấy vi phạm thì báo, mục không nhìn thấy thì bỏ qua, không suy đoán)\n${hit.map(a=>`[${a.n}]\n${a.i.map(x=>`- ${x}`).join('\n')}`).join('\n')}\n\n`;
}
const AIX_RULES=()=>`QUY TẮC CHỌN HẠNG MỤC
- Chọn id theo VẬT THỂ chính và bản chất mối nguy, không theo tên khu vực. Ví dụ: bình chữa cháy bị che trong kho hóa chất thuộc hạng mục 20; dây điện quấn băng keo trong trần thuộc hạng mục 11; cùng lỗi đó ở dưới sàn xưởng thuộc hạng mục 12.
- Phân biệt các cặp dễ nhầm:
  + Bình chữa cháy: thiếu tại vị trí đang hàn cắt là hạng mục 7; bị che, hỏng, thiếu tại khu vực thường là hạng mục 20; quá hạn bảo dưỡng, phiếu kiểm tra bỏ trống là hạng mục 21.
  + Lối thoát nạn (TRỌNG TÂM hạng mục 23): mọi lỗi của cửa thoát nạn, lối, hành lang, cầu thang thoát nạn thuộc hạng mục 23: bị hàng hóa, pallet, xe đẩy chắn; cửa bị khóa, buộc dây, chèn; cửa mở ngược chiều; hỏng tay nắm, thanh đẩy; lối bị thu hẹp do máy, kệ; sàn lối thoát có dầu, nước; phía ngoài cửa thoát bị hàng rào, xe chắn; biển EXIT, đèn chỉ dẫn, đèn chiếu sáng sự cố hỏng, thiếu, bị che. Chỉ khi lối thoát bị vật tư thi công chắn ngay cạnh nơi đang làm việc có lửa mới là hạng mục 9.
  + Cửa chống cháy bị chèn mở, không tự đóng, cong vênh, mất gioăng là hạng mục 22 (không phải 23). Sơ đồ thoát nạn sai, cũ, không niêm yết là hạng mục 24.
  + Vật che chắn: chắn lối, cửa thoát nạn là 23; chắn trước tủ điện là 14; che bình chữa cháy, họng nước, đầu phun là 20. Một đống hàng chắn cả lối thoát và tủ chữa cháy: "item" là hạng mục bị ảnh hưởng nặng nhất, hạng mục kia ghi vào "also_items".
  + Vật dễ cháy: quanh điểm hàn cắt là hạng mục 4; trong trần là hạng mục 10; trong hoặc quanh tủ điện là hạng mục 14; cạnh nguồn nhiệt là hạng mục 18; chất thải, bao bì để sai nơi là hạng mục 16; chất lỏng, khí dễ cháy là hạng mục 17.
  + Tủ điện, bảng phân phối điện (TRỌNG TÂM hạng mục 14): mọi lỗi nhìn thấy Ở TRONG hoặc TRÊN tủ điện, tủ điều khiển thuộc hạng mục 14: đầu cos không bấm, không bọc cách điện; điểm đấu nối, dây, aptomat cháy sém, đổi màu, chảy nhựa; ốc siết lỏng, gỉ; nhiều dây đấu chung một cực; thanh cái không có tấm che; tủ thiếu cửa, nắp, cửa không đóng kín; lỗ cáp chưa bịt; bụi bẩn, vật dễ cháy trong tủ; nước thấm vào tủ; quạt, lưới lọc tắc; thiếu nối đất, nhãn, sơ đồ; hàng hóa chắn trước tủ.
  + Dây điện NGOÀI tủ: trong trần là hạng mục 11; dây hỏng vỏ, lộ lõi, dây tạm, lộn xộn, cọ cạnh sắc, mối nối băng keo, ổ cắm quá tải là hạng mục 12; dây, cáp không còn dùng bỏ lại, đầu dây thừa để hở là hạng mục 13 (kể cả khi nằm trong tủ).
  + Nhiệt độ: chỉ báo "điểm nóng" khi ảnh có số đo hoặc ảnh nhiệt cho thấy bất thường so với điểm bên cạnh; không kết luận chỉ vì một mốc 60°C. Dấu hiệu quá nhiệt nhìn bằng mắt (đổi màu, chảy nhựa, cháy sém) thì báo bình thường.
  + Lỗ xuyên chưa bịt: xuyên trần, quanh cáp là hạng mục 11; trên tường, vách ngăn cháy là hạng mục 22.
- Một ảnh có thể có lỗi của nhiều hạng mục; một hạng mục có thể có nhiều lỗi. Ghi đủ.
- Hai id cùng khớp: chọn id có "dấu hiệu" trùng nhiều chi tiết nhìn thấy nhất và nêu chi tiết trong evidence.
- "item" luôn là một trong 25 hạng mục của checklist (hoặc EH000); "rule" chỉ là lỗi mẫu bên trong hạng mục đó. Lỗi EHS thông thường không nguy hiểm lớn: không báo, không dùng EH000.

MỐC MỨC ĐỘ (đối chiếu trước khi chọn)
- Priority: cửa hoặc lối thoát nạn bị khóa, buộc, chặn hoàn toàn; cửa thoát hỏng không mở được; thanh cái, phần mang điện hở dễ chạm; dây, aptomat, điểm đấu nối cháy sém, đánh lửa, quá nhiệt rõ; nước vào tủ điện; tủ trung tâm báo cháy bị tắt, cô lập; hàn cắt ngay cạnh dung môi, khí dễ cháy; các lỗi EH000 đe dọa tính mạng tức thời.
- Major: đầu cos không chắc, chi tiết đấu nối gỉ, tủ điện hở lỗ cáp, thiếu che chắn, cửa tủ hỏng; biển EXIT, đèn chiếu sáng sự cố không hoạt động; lối thoát bị thu hẹp; bình chữa cháy bị che, hỏng, quá hạn; đầu báo tuột dây, bị bọc; dây điện hở, mối nối băng keo, ổ cắm nối tiếp; vật dễ cháy trong tủ điện, trong trần, cạnh nguồn nhiệt; cửa chống cháy bị chèn mở; hàn cắt thiếu giấy phép, thiếu người giám sát lửa.
- Minor: tủ điện bám bụi nhẹ, thiếu nhãn thiết bị, thiếu sơ đồ điện; phiếu kiểm tra chưa cập nhật, niêm yết mờ, rách; bình đặt sai vị trí nhưng còn dùng được; rác tồn đọng ít; bụi trong trần.

`;
const AIX_FIX=()=>`CÁCH VIẾT KHẮC PHỤC
- "fix_now": việc làm ngay trong ca tại đúng vị trí, nêu đúng vật thể. Ví dụ: "Tháo niêm phong 3 cửa thoát nạn xưởng NC tầng 1, giữ cửa mở được từ bên trong". Không viết "tăng cường", "chú ý", "nhắc nhở" chung chung.
- "fix_root": biện pháp triệt để ngăn tái diễn, chọn bậc cao nhất khả thi theo thứ bậc: loại bỏ → thay thế → biện pháp kỹ thuật (ống luồn dây, hộp nối, tấm chắn, tủ chống cháy, bịt lỗ chống cháy) → hành chính (giấy phép, vạch kẻ, kiểm tra định kỳ, đào tạo) → PPE. Nêu rõ cái gì, ở đâu.${AIX.cfg.owner?`
- Cuối "fix_root" ghi thêm "(Phụ trách: <bộ phận>; Hạn: <thời hạn>)". Bộ phận: Bảo trì, cơ điện cho điện, trần, thiết bị, hệ thống PCCC; EHS cho giấy phép làm việc có lửa, phương tiện chữa cháy, niêm yết, huấn luyện; Bộ phận sử dụng khu vực cho sắp xếp, vật dễ cháy, lối thoát nạn; Nhà thầu cho lỗi trong lúc thi công. Hạn: Priority "trong ca"; Major "7 ngày"; Minor "30 ngày".`:''}

`;

/* ---------- 2. Học chung cả đội ---------- */
const EXC=new Map();
async function teamExamples(area,note){
  if(!AIX.cfg.team||typeof clOn!=='function'||!clOn()||NET.off||!navigator.onLine)return '';
  const vendor=($('mUnit').value||'').trim(),key=`${area}|${vendor}|${note||''}`.toLowerCase();
  let c=EXC.get(key);
  if(!c||Date.now()-c.at>600000){
    try{const q=new URLSearchParams({area:area||'',vendor,q:note||'',n:'24'});
      const r=await Promise.race([api('GET','/api/ai/examples?'+q),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),3500))]);
      c={at:Date.now(),list:r.examples||[]};EXC.set(key,c)}catch{return c?fmtEx(c.list):''}
  }
  return fmtEx(c.list);
}
function fmtEx(list){
  if(!list||!list.length)return '';
  const cut=(t,n)=>t&&t.length>n?t.slice(0,n-1)+'…':(t||'');
  return `MẪU LỖI ĐÃ ĐƯỢC NGƯỜI ĐÁNH GIÁ CỦA ĐỘI XÁC NHẬN (ưu tiên cùng khu vực, cùng công ty; dùng làm chuẩn chọn mã, mức độ, văn phong và cách khắc phục; ảnh có tình huống tương tự thì báo đúng như mẫu)
${list.map(x=>`- [${[x.rule,x.req||x.code||'?',x.sev||'?'].filter(Boolean).join(' | ')}${x.kind==='hazard'?' | mối nguy':''}] ${cut(x.title,160)}${x.area?` (khu: ${cut(x.area,40)})`:''}${x.vendor?' (cùng công ty)':''}${x.from?` — AI từng gán ${[x.from.rule,x.from.code,x.from.sev].filter(Boolean).join('/')}${x.from.title&&x.from.title!==x.title?` ("${cut(x.from.title,70)}")`:''} và đã được người đánh giá sửa thành ${[x.rule,x.code,x.sev].filter(Boolean).join('/')}`:''}${x.fixNow?` → ngay: ${cut(x.fixNow,100)}`:''}${x.fixRoot?`; triệt để: ${cut(x.fixRoot,120)}`:''}`).join('\n')}

`;
}

/* ---------- 3. Ảnh gửi AI ---------- */
const BLOBP=new WeakMap();
async function hiBlob(p,side){const im=await ensureImg(p),k=Math.min(1,side/Math.max(p.w,p.h)),c=mk(p.w*k,p.h*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);return toBlob(c,'image/jpeg',.9)}
{const _ab=aiBlob;aiBlob=async function(p,f){const b=(!f&&AIX.cfg.hires&&tier()==='complex')?await hiBlob(p,2400):await _ab(p,f);try{BLOBP.set(b,p)}catch{}return b}}
const boxOk=b=>Array.isArray(b)&&b.length>=4&&b.slice(0,4).every(v=>Number.isFinite(Number(v)));
const box2=a=>{if(a&&Array.isArray(a.box_2d)&&a.box_2d.length>=4){const[y1,x1,y2,x2]=a.box_2d.map(Number);if([y1,x1,y2,x2].every(Number.isFinite))a.box=[x1,y1,x2,y2]}return a};
async function annotated(p,fs){
  const im=await ensureImg(p),k=Math.min(1,1600/Math.max(p.w,p.h)),c=mk(p.w*k,p.h*k),g=c.getContext('2d');g.drawImage(im,0,0,c.width,c.height);
  const lw=Math.max(3,c.width/300),fz=Math.max(18,Math.round(c.width/45));g.font=`bold ${fz}px sans-serif`;g.textBaseline='top';
  fs.forEach((a,i)=>{if(!boxOk(a.box))return;const[x1,y1,x2,y2]=a.box.map(Number),X=Math.min(x1,x2)/1000*c.width,Y=Math.min(y1,y2)/1000*c.height,W=Math.abs(x2-x1)/1000*c.width,H=Math.abs(y2-y1)/1000*c.height;
    g.lineWidth=lw;g.strokeStyle='#FF00C8';g.strokeRect(X,Y,W,H);const t=String(i+1),tw=g.measureText(t).width+fz*.6;g.fillStyle='#FF00C8';g.fillRect(X,Math.max(0,Y-fz*1.2),tw,fz*1.2);g.fillStyle='#fff';g.fillText(t,X+fz*.3,Math.max(0,Y-fz*1.2)+fz*.1)});
  return toBlob(c,'image/jpeg',.88);
}
async function zoomBlob(p,b){
  const im=await ensureImg(p),[x1,y1,x2,y2]=b.map(Number),bx=Math.min(x1,x2)/1000*p.w,by=Math.min(y1,y2)/1000*p.h,bw=Math.abs(x2-x1)/1000*p.w,bh=Math.abs(y2-y1)/1000*p.h;
  const pad=Math.max(bw,bh)*.25+20,x=Math.max(0,bx-pad),y=Math.max(0,by-pad),w=Math.min(p.w-x,bw+2*pad),hh=Math.min(p.h-y,bh+2*pad);
  if(w<8||hh<8)return null;const k=Math.min(1280/Math.max(w,hh),3),c=mk(w*k,hh*k);c.getContext('2d').drawImage(im,x,y,w,hh,0,0,c.width,c.height);return toBlob(c,'image/jpeg',.9);
}

/* ---------- 4. Bổ sung lời nhắc và AI tự kiểm tra lại ---------- */
const TASK='\nNHIỆM VỤ\n';
async function augment(prompt,p){
  const k=prompt.indexOf(TASK);if(k<0||!/DANH MỤC LỖI/.test(prompt))return prompt;
  const area=p?String(p.area||''):'',note=p?String(p.note||''):'',scene=p&&p.analysis?String(p.analysis.scene||''):'';
  const blk=areaLists(`${area} ${note} ${scene}`)+(await teamExamples(area,note))+AIX_RULES()+AIX_FIX();
  return prompt.slice(0,k)+'\n'+blk+prompt.slice(k);
}
async function verifyWhole(prompt,o,data,p){
  if(!AIX.cfg.verify||tier()==='quick'||!p||!data||!Array.isArray(data.findings)||!data.findings.length)return data;
  const fs=data.findings.slice(0,10),k=prompt.indexOf(TASK);if(k<0)return data;
  const ov=$('ovMsg');if(ov&&!$('ov').hidden)ov.textContent=`AI đang kiểm tra lại ${fs.length} lỗi…`;
  try{
    const imgs=[await annotated(p,fs)],zi=[];
    for(let i=0;i<fs.length&&zi.length<6;i++)if(boxOk(fs[i].box)){const z=await zoomBlob(p,fs[i].box);if(z){imgs.push(z);zi.push(i+1)}}
    const list=fs.map((a,i)=>({i:i+1,item:a.item||a.rba_code||(RULES[a.rule]?RULES[a.rule].c:''),rule:a.rule||'',title:a.title||'',evidence:a.evidence||'',kind:a.kind||'',severity:a.severity||'',confidence:a.confidence}));
    const task=`${TASK}KIỂM TRA LẠI KẾT QUẢ SOÁT ẢNH. Ảnh 1 là toàn cảnh, các lỗi AI đã đề xuất được khoanh khung hồng và đánh số. ${zi.length?zi.map((n,j)=>`Ảnh ${j+2} là ảnh phóng to lỗi số ${n}.`).join(' '):''} Khung và số do ứng dụng vẽ, không phải vật thể hiện trường.
Với TỪNG lỗi trong danh sách dưới đây, làm lần lượt:
1. Nhìn kỹ ảnh phóng to: lỗi có thật và nhìn thấy rõ không? Không thấy rõ, chỉ là suy đoán, nhầm vật thể, hoặc cần hồ sơ mới kết luận được: "keep": false và nêu lý do ngắn ở "reason".
2. Đối chiếu "item" với yêu cầu nguyên văn của 25 hạng mục checklist và QUY TẮC CHỌN HẠNG MỤC; sai thì ghi "item" đúng và "rule" là lỗi mẫu của hạng mục đó (hoặc để trống). Lỗi không thuộc phòng cháy chữa cháy và không nguy hiểm lớn về EHS: "keep": false.
3. Kiểm tra mức độ theo MỐC MỨC ĐỘ và tiêu chí MỨC ĐỘ; sai thì ghi mức đúng.
4. Viết lại "title" và "evidence" cụ thể: vật thể, vị trí trong ảnh, số lượng, chữ hoặc ngày đọc được. Không viết chung chung.
5. Viết lại "fix_now", "fix_root" theo CÁCH VIẾT KHẮC PHỤC, bám đúng hiện trạng.
6. "box": chỉ sửa khi khung lệch khỏi vật thể; [x1,y1,x2,y2] thang 0 đến 1000 trên ảnh 1.
Sau đó nhìn lại toàn bộ ảnh 1 theo DANH SÁCH KIỂM TRA THEO KHU VỰC: lỗi nhìn thấy RÕ RÀNG mà danh sách chưa có thì ghi vào "missed" (tối đa 3, confidence từ 70 trở lên, không trùng lỗi đã có). Không chắc thì không ghi.
${ctx(p)}

DANH SÁCH LỖI CẦN KIỂM TRA
${JSON.stringify(list)}

Chỉ trả về một JSON:
{"findings":[{"i":1,"keep":true,"reason":"",${FIND},"box":[0,0,0,0]}],"missed":[{${FIND},"box":[0,0,0,0]}]}`;
    const r=await API_SAMPLE.json(prompt.slice(0,k)+task,{...o,images:imgs,onText:null,__aixInner:true});
    if(!r||!Array.isArray(r.findings))return data;
    const out=[],gone=[];
    fs.forEach((a,i)=>{const c=r.findings.find(x=>x&&Number(x.i)===i+1);if(!c){out.push(a);return}
      if(c.keep===false){gone.push(`AI kiểm tra lại đã loại: ${a.title}${c.reason?` (${str(c.reason)})`:''}`);return}
      const m={...a};for(const[key,v]of Object.entries(c)){if(['i','keep','reason','box_2d'].includes(key))continue;if(key==='box'){if(boxOk(v)&&v.some(n=>Number(n)>0))m.box=v;continue}if(v!==''&&v!=null)m[key]=v}
      out.push(m)});
    for(const a of(Array.isArray(r.missed)?r.missed:[]).slice(0,3)){box2(a);if(a&&a.title&&(Number(a.confidence)||0)>=70&&boxOk(a.box))out.push(a)}
    data.findings=out;data.verify=[...gone.slice(0,3),...(data.verify||[])];data._aixChecked=fs.length;
    return data;
  }catch(e){if(e&&e.code==='cancelled')throw e;console.warn('AI kiểm tra lại lỗi',e);return data}
}
{const _json=API_SAMPLE.json;
  API_SAMPLE.json=async(i,o={})=>{
    if(o.__aixInner||typeof i!=='string'||!/DANH MỤC LỖI/.test(i))return _json(i,o);
    const p=o.images&&o.images[0]?BLOBP.get(o.images[0]):null;
    const whole=/\nNHIỆM VỤ\nSoát ảnh hiện trường/.test(i),Q=typeof qxPrompt==='function';
    const prompt=await augment(whole&&Q?qxPrompt(i):i,p);
    let d=await _json(prompt,o);
    if(whole&&Q)d=qxGround(d);
    return whole?verifyWhole(prompt,o,d,p):d;
  }}

/* ---------- 5. Ghi nhận quyết định để thống kê độ chính xác ---------- */
const AIEV={q:(()=>{try{return JSON.parse(localStorage.getItem('soat-pccc-aiev')||'[]')}catch{return[]}})(),t:0,
  push(e){if(!e)return;const m=(AILOG.find(x=>x.ok&&x.model)||{}).model||'';this.q.push({id:uid()+uid(),at:Date.now(),audit_id:(typeof CL!=='undefined'&&CL.audit&&CL.audit.id)||'',model:m,...e});if(this.q.length>500)this.q.splice(0,this.q.length-500);this.save();clearTimeout(this.t);this.t=setTimeout(()=>this.flush(),4000)},
  save(){try{localStorage.setItem('soat-pccc-aiev',JSON.stringify(this.q))}catch{}},
  async flush(){const vw=typeof CL!=='undefined'&&CL.auth&&CL.auth.user&&CL.auth.user.role==='viewer';if(!this.q.length||typeof clOn!=='function'||!clOn()||NET.off||vw){if(vw){this.q=[];this.save()}return}
    const b=this.q.slice(0,200);try{await api('POST','/api/ai/events',{events:b});this.q=this.q.slice(b.length);this.save()}catch{}}
};
{const _learn=learn;learn=function(f,p,quiet){
  const r=_learn(f,p,quiet);
  try{if(r&&r.t)AIEV.push({t:r.t,code:(r.to&&r.to.code)||f.code||'',sev:(r.to&&r.to.sev)||f.sev||'',from_code:(r.from&&r.from.code)||'',from_sev:(r.from&&r.from.sev)||'',area:r.area||'',title:r.title||''})}catch{}
  return r}}
{const _add=Learn.add.bind(Learn);Learn.add=function(x){try{if(x&&(x.t==='reject'||x.t==='unclear'))AIEV.push({t:x.t,code:(x.to&&x.to.code)||'',sev:(x.to&&x.to.sev)||'',area:x.area||'',title:x.title||''})}catch{}return _add(x)}}
setInterval(()=>{if(!document.hidden)AIEV.flush()},60000);

/* ---------- Cài đặt ---------- */
{const card=$('setAIcard')||$('setAI');if(card){
  const opt=(k,label,hint)=>h('label',{class:'aixo'},h('input',{type:'checkbox',checked:!!AIX.cfg[k],onchange:e=>{AIX.cfg[k]=e.target.checked;AIX.save();toast(`${label}: ${e.target.checked?'bật':'tắt'}.`)}}),h('span',null,h('b',null,label),h('small',null,hint)));
  card.append(h('div',{class:'aixbox'},h('h4',null,'Nâng cao độ chính xác'),
    opt('verify','AI tự kiểm tra lại','Sau khi soát, AI phóng to từng lỗi để xác nhận, sửa mã, mức độ, loại lỗi không chắc. Thêm 1 lượt gọi AI mỗi ảnh (không áp dụng ở chế độ Nhanh).'),
    opt('team','Học từ lỗi cả đội đã xác nhận','Dùng lỗi đã xác nhận trên hệ thống (cùng khu vực, cùng công ty) làm mẫu. Cần đăng nhập và có mạng.'),
    opt('owner','Ghi bộ phận phụ trách và thời hạn','Thêm "(Phụ trách: …; Hạn: …)" vào cuối khắc phục triệt để, theo mức độ.'),
    opt('hires','Ảnh nét hơn ở chế độ Kỹ','Gửi ảnh 2400 px để đọc rõ tem, nhãn, ngày tháng, vật nhỏ.'),
    opt('det','Kết quả ổn định','Giảm độ ngẫu nhiên để cùng một ảnh soát nhiều lần cho kết quả giống nhau.')))}}

/* ---------- Quản trị: độ chính xác AI ---------- */
function clAdmAI(){
  const A=CL.adm;A.aiDays=A.aiDays||90;
  if(!A.ai||A.ai.days!==A.aiDays){api('GET','/api/admin/ai-stats?days='+A.aiDays).then(r=>{A.ai=r;renderAdmin()}).catch(e=>{A.ai={days:A.aiDays,err:e.message};renderAdmin()});
    return h('div',null,h('p',{class:'hint'},'Đang tải thống kê…'))}
  const S0=A.ai;if(S0.err)return h('div',null,h('p',{class:'hint'},S0.err));
  const T={};for(const r of S0.totals||[])T[r.t]=r.n;const dec=(T.keep||0)+(T.fix||0)+(T.reject||0)+(T.unclear||0);const pc=n=>dec?Math.round(n*100/dec)+'%':'—';
  const by={};for(const r of S0.by_code||[]){const c=r.c||'(chưa có mã)';by[c]=by[c]||{keep:0,fix:0,reject:0,unclear:0,miss:0};by[c][r.t]=(by[c][r.t]||0)+r.n}
  const rows=Object.entries(by).map(([c,v])=>({c,...v,tot:v.keep+v.fix+v.reject+v.unclear})).sort((a,b)=>b.tot-a.tot||b.miss-a.miss);
  const acc=r=>r.tot?Math.round(r.keep*100/r.tot):null;
  const per=h('select',{'aria-label':'Khoảng thời gian',onchange:e=>{A.aiDays=Number(e.target.value);A.ai=null;renderAdmin()}},...[[30,'30 ngày'],[90,'90 ngày'],[365,'12 tháng'],[3650,'Toàn bộ']].map(([d,l])=>h('option',{value:d,selected:A.aiDays===d},l)));
  const cards=h('div',{class:'clstats'},...[['Đề xuất đã xử lý',dec,''],['Giữ nguyên',pc(T.keep||0),`${T.keep||0} lỗi`],['Sửa mã hoặc mức độ',pc(T.fix||0),`${T.fix||0} lỗi`],['Bắt nhầm (bị loại)',pc(T.reject||0),`${T.reject||0} lỗi`],['AI bỏ sót',T.miss||0,'người đánh giá tự thêm']].map(([a,b,c])=>h('div',{class:'dcard'},h('small',null,a),h('b',null,String(b)),c?h('small',null,c):null)));
  const tb=h('div',{class:'tscroll'},h('table',{class:'ftab cltab'},h('thead',null,h('tr',null,...['Mã','Đề xuất','Giữ','Sửa','Loại','Không rõ','Bỏ sót','Độ chính xác'].map(t=>h('th',null,t)))),
    h('tbody',null,...(rows.length?rows.map(r=>{const a=acc(r);return h('tr',null,h('td',null,h('b',null,r.c)),h('td',null,String(r.tot)),h('td',null,String(r.keep)),h('td',null,String(r.fix)),h('td',null,String(r.reject)),h('td',null,String(r.unclear)),h('td',null,String(r.miss)),
      h('td',null,a==null?'—':h('span',{class:'pill '+(a>=80?'okc':a>=60?'Minor':'Priority')},a+'%')))}):[h('tr',null,h('td',{colspan:8},'Chưa có dữ liệu. Thống kê có khi người đánh giá xác nhận, sửa hoặc loại lỗi AI đề xuất.'))]))));
  const ch=(S0.changes||[]).length?h('div',{class:'dcard'},h('h3',null,'AI hay gán sai thế nào'),h('ul',{class:'aixch'},...S0.changes.map(c=>h('li',null,h('span',null,[c.from_code,c.from_sev].filter(Boolean).join(' / ')||'—'),' → ',h('b',null,[c.code,c.sev].filter(Boolean).join(' / ')||'—'),h('small',null,` ${c.n} lần`))))):null;
  const TL={fix:'Sửa',reject:'Loại',miss:'Bỏ sót'};
  const rec=(S0.recent||[]).length?h('div',{class:'dcard'},h('h3',null,'Gần đây'),h('ul',{class:'aixch'},...S0.recent.slice(0,20).map(e=>h('li',null,h('span',{class:'pill '+(e.t==='fix'?'Minor':e.t==='reject'?'Priority':'wait')},TL[e.t]||e.t),' ',e.title||'',h('small',null,` · ${[e.t==='fix'?`${e.from_code||'?'}/${e.from_sev||'?'} → ${e.code||'?'}/${e.sev||'?'}`:[e.code,e.sev].filter(Boolean).join('/'),e.area,e.user_name,vnDT(e.at)].filter(Boolean).join(' · ')}`))))):null;
  const bm={};for(const r of S0.by_model||[]){bm[r.model]=bm[r.model]||{keep:0,fix:0,reject:0,unclear:0,miss:0};bm[r.model][r.t]=r.n}
  const md=Object.keys(bm).length?h('div',{class:'dcard'},h('h3',null,'Theo model AI'),h('ul',{class:'aixch'},...Object.entries(bm).map(([m,v])=>{const t=v.keep+v.fix+v.reject+v.unclear;return h('li',null,h('b',null,m),h('small',null,` ${t} đề xuất · giữ nguyên ${t?Math.round(v.keep*100/t):0}% · bị loại ${t?Math.round(v.reject*100/t):0}%`))}))):null;
  return h('div',null,h('div',{class:'dhead aixhd'},h('h2',null,'Độ chính xác AI'),h('span',{class:'spacer'}),per,h('button',{class:'btn',onclick:()=>{A.ai=null;renderAdmin()}},'Làm mới')),
    h('p',{class:'hint'},'Tính từ quyết định của người đánh giá: Giữ = xác nhận đúng như AI đề xuất; Sửa = đổi mã hoặc mức độ; Loại = không phải lỗi; Bỏ sót = người đánh giá tự thêm. Mã có độ chính xác thấp: bổ sung mẫu (nạp file checklist cũ, sửa và xác nhận đúng) để AI học, hoặc chỉnh tiêu chí trong Cài đặt.'),
    cards,tb,h('div',{class:'sgrid'},ch,md),rec);
}
