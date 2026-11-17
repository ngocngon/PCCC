// AI giả lập cho Audit PCCC: thay lời gọi Gemini bằng câu trả lời mẫu để kiểm thử, không tốn lượt, không cần key thật.
// Chỉ dùng trên máy thử (http://localhost). Không đưa file này lên mạng.
// Cách dùng (trong Console của trình duyệt, xem HUONG-DAN-DUNG-LAI.md mục 5):
//   await import('/_mock.js'); await __addPhotos(4);   // thêm 4 ảnh thử, AI giả lập tự soát
//   await __addZip();                                   // thử nhập file .zip chứa ảnh
//   window.__g                                          // các lời nhắc app đã gửi cho AI (để kiểm tra)
window.__g = [];
const realFetch = window.fetch.bind(window);
let k = 0;
const AREAS = ['Nhà máy 2: Xưởng NC tầng 1', 'Phòng sơn Mobase 1', 'Xưởng 1 tầng 1', 'Xưởng mạ tầng 1, nhà máy 2'];
const KO = ['비상문 3개가 봉인된 채 잠겨 있어 개방 불가능함', '전선이 배선함에서 나오는 부분이 케이블 그랜드로 보호되지 않음', '제2공장 1층 NC공장', '모베이스1 도장실', '전기박스 내에 가연성 물질이 적치되어 있음', '화재감지기 배선이 이탈된 채 관리되지 않음', '1층 1공장', '제2공장 1층 도금공장'];
const ZH = ['叉车检验标签已过期', '灭火器超过检查期限且未悬挂检查卡', '化学品仓库', '空压机房', '紧急出口前堆放物品，疏散通道受阻', '配电箱未安装盖板且未张贴警示标签', '冲压车间', '员工食堂'];
// box_2d theo cách của Gemini: [y1, x1, y2, x2], thang 0–1000
const F = (rule, title, sev, box, code) => ({ rule, kind: 'violation', title, evidence: 'Nhìn thấy trong ảnh', severity: sev, confidence: 88, fix_now: 'Xử lý ngay', fix_root: 'Khắc phục triệt để', cause: 'Facility', item: code || '', box_2d: box });

window.fetch = async (u, o = {}) => {
  u = String(u);
  if (!u.includes('generativelanguage')) return realFetch(u, o);
  if (u.includes('/models?')) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }));
  const b = JSON.parse(o.body), t = b.contents[0].parts.at(-1).text, sys = b.systemInstruction ? b.systemInstruction.parts[0].text : '';
  window.__g.push({ sys, t });
  let out;
  if (t.includes('một chữ')) out = 'OK';                                   // kiểm tra key
  else if (t.includes('Dịch')) {                                           // dịch phụ đề, tiếng Anh
    const list = JSON.parse(t.slice(t.lastIndexOf('[')));
    const tb = t.includes('tiếng Hàn') ? KO : t.includes('tiếng Trung') ? ZH : null;
    out = JSON.stringify(list.map((s, i) => tb ? tb[(s.length + i) % tb.length] : 'EN: ' + s));
  } else if (t.includes('CĂN CỨ CỦA NGƯỜI ĐÁNH GIÁ')) {                    // AI viết lại theo ý người dùng
    const hint = (t.match(/CĂN CỨ CỦA NGƯỜI ĐÁNH GIÁ \(bắt buộc dùng làm căn cứ\): ([^\n]*)/) || [])[1] || '';
    out = JSON.stringify({ no_violation: false, ...F('', 'AI viết lại: ' + hint, 'Major', [300, 300, 600, 600], 'HM020') });
  } else if (t.includes('KIỂM TRA LẠI KẾT QUẢ SOÁT ẢNH')) {                // AI tự kiểm tra lại: giữ nguyên
    out = JSON.stringify({ findings: [], missed: [] });
  } else {                                                                  // soát cả ảnh
    const i = k++ % 4;
    let list = [                                                            // ảnh 1: hai lỗi cùng hạng mục 23
      F('E21', 'Có 3 cửa thoát nạn bị khóa niêm phong, không mở được', 'Priority', [150, 150, 550, 550]),
      F('E24', 'Đèn EXIT phía trên cửa thoát nạn không sáng', 'Major', [40, 600, 140, 800])];
    if (i === 1) list = [                                                   // ảnh 2: ba lỗi hạng mục 11 (trong trần)
      F('B5', 'Dây điện ra khỏi hộp đấu nối không có đầu siết cáp hoặc ống bảo vệ', 'Major', [100, 100, 400, 400]),
      F('B4', 'Đầu dây quấn băng keo treo tự do ngoài hộp đấu nối', 'Major', [450, 500, 700, 800]),
      F('B8', 'Lỗ xuyên trần chưa được bịt kín bằng vật liệu chống cháy', 'Major', [720, 120, 950, 420])];
    if (i === 2) list = [                                                   // ảnh 3: lỗi trùng, lỗi ngoài danh mục, lỗi EHS khác
      F('C10', 'Phát sinh vật liệu dễ cháy (bìa, nilon) trong tủ điện', 'Major', [100, 100, 400, 400]),
      F('C10', 'Vật liệu dễ cháy gồm bìa và nilon để bên trong tủ điện', 'Major', [110, 110, 390, 390]),
      F('', 'Dây điện tạm kéo lộn xộn trên sàn, một ổ cắm cắm quá nhiều thiết bị', 'Major', [600, 100, 900, 400], 'HM012'),
      F('', 'Công nhân đứng trên mái tôn không đeo dây đai an toàn, không có lan can', 'Priority', [600, 500, 950, 900], 'EH000')];
    if (i === 3) list = [                                                   // ảnh 4: hạng mục 19 và 20
      F('E1', 'Dây cảm biến báo cháy tại trạm đổi nguồn điện 1 chiều bị tuột', 'Major', [150, 150, 450, 450]),
      F('B5', 'Đầu báo cháy bị bọc nilon kín, không nhận được khói', 'Major', [50, 600, 140, 760], 'HM019'),  // rule lệch hạng mục: phải theo item
      F('E11', 'Trạm đổi nguồn điện 1 chiều chưa có bình cầu chữa cháy', 'Major', [500, 300, 900, 800])];
    out = JSON.stringify({ scene: 'Khu vực', area_guess: AREAS[i], main_item: ['HM023', 'HM011', 'HM014', 'HM019'][i], findings: list, compliant: [], verify: [] });  // ảnh 3, 4 có lỗi của hạng mục thứ hai
  }
  await new Promise(r => setTimeout(r, 150));
  const enc = new TextEncoder();
  return new Response(new ReadableStream({ start(c) { c.enqueue(enc.encode('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: out }] }, finishReason: 'STOP' }] }) + '\n\n')); c.close() } }));
};

window.__img = async (i, portrait) => {
  const c = document.createElement('canvas'); c.width = portrait ? 1800 : 2400; c.height = portrait ? 2400 : 1800;
  const g = c.getContext('2d'); g.fillStyle = `hsl(${i * 70},35%,55%)`; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; g.font = '200px sans-serif'; g.fillText('Ảnh ' + (i + 1), 200, 400);
  return new Promise(r => c.toBlob(r, 'image/jpeg', .85));
};
window.__addPhotos = async n => {
  const dt = new DataTransfer();
  for (let i = 0; i < n; i++) dt.items.add(new File([await __img(i, i === 1)], `anh-${i + 1}.jpg`, { type: 'image/jpeg' }));
  const inp = document.getElementById('file'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
};
window.__addZip = async () => {
  const z = new JSZip(); z.file('B/anh-10.jpg', await __img(5)); z.file('A/anh-2.jpg', await __img(6)); z.file('__MACOSX/A/._anh-2.jpg', 'x'); z.file('ghichu.txt', 'abc');
  const dt = new DataTransfer(); dt.items.add(new File([await z.generateAsync({ type: 'blob' })], 'anh-hien-truong.zip', { type: 'application/zip' }));
  const inp = document.getElementById('pack'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
};
