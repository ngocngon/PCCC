/* ======================================================================
   Audit PCCC — Kiểm tra theo loại ảnh (luôn gửi kèm lời nhắc)
   Danh mục lỗi và bảng từ khóa nằm ở 5-mau-checklist-pccc/danh-muc-pccc.json
   (nạp vào RBA.rules bằng nap_danh_muc.py). File này chỉ bổ sung lời nhắc.
   Chèn sau ai-quality.js, trước ai-group.js.
   ====================================================================== */
const DX_RULES=[];
const DX_BLK=`ẢNH CHỤP HỒ SƠ, GIẤY PHÉP, PHIẾU KIỂM TRA, BẢNG TIN (chỉ áp dụng khi ảnh chụp tài liệu)
- Trong "objects" ghi từng tài liệu kèm tiêu đề, ngày, chữ ký đọc được; không đọc được thì ghi "không đọc được".
- Giấy phép làm việc có lửa: thiếu chữ ký phê duyệt, ngày giờ đã qua, bỏ trống mục kiểm tra (A2); mục kiểm tra tàn lửa sau 1 giờ và sau 3 giờ không ghi (A13).
- Phiếu, thẻ kiểm tra bình, họng, tủ chữa cháy: bỏ trống các tháng gần đây so với NGÀY AUDIT (E15); tem bảo dưỡng bình quá 6 tháng hoặc không có (E16).
- Bảng tin: đọc được tiêu đề phần lớn tài liệu mà không có sơ đồ thoát nạn, mạng lưới liên lạc khẩn cấp, quy trình báo cháy và sơ tán (E26); có nhưng mờ, rách, lỗi thời (E27).
- Không đọc rõ nội dung: không kết luận, ghi vào "verify". "box" bao đúng tài liệu hoặc mục bị thiếu.

`;
const DX_SCENE=`KIỂM TRA THEO LOẠI ẢNH (xác định ảnh chụp gì rồi rà đúng nhóm; mục không nhìn thấy thì bỏ qua, không suy đoán)
[Ảnh chụp trần nhà, bên trong trần, phần trên cao]
- Vật dễ cháy, phế liệu, bao bì, ống, dây thừa bỏ lại trong trần (B1); bụi, xơ dày (B2).
- Dây đi tự do không ống luồn, không máng (B3); mối nối băng keo, đầu dây treo ngoài hộp, hộp nối không nắp (B4); dây ra khỏi hộp không có đầu siết cáp (B5); vỏ dây nứt, cháy sém (B6).
- Cách nhiệt, bảo ôn rách, bong, cháy sém (B7); lỗ xuyên trần quanh cáp, ống chưa bịt kín (B8).
- Đầu báo cháy tuột dây, chỉ còn đế (E1), bị bọc, bị sơn (E2); đầu phun sprinkler bị che, hàng xếp quá sát (E10). Chỉ thấy một góc trần: không kết luận thiếu đầu báo, ghi vào "verify".
[Ảnh chụp khu vực đang hàn, cắt, mài, thi công]
- Giấy phép dán tại chỗ (A1); bảo hộ của thợ (A4); bình khí, ống dẫn, van chống cháy ngược (A5, A6); máy và cáp hàn (A7).
- Vật dễ cháy trong 11 m (A8); tấm chắn tia lửa có và đúng loại (A9, A10); người giám sát lửa (A11); đếm bình chữa cháy tại chỗ, phải từ 2 bình (A12).
- Lối thoát nạn và đèn EXIT cạnh nơi thi công (A15, A16). Dây điện tạm của thi công kéo lộn xộn, ổ cắm nối tiếp (C2, C3).
[Ảnh chụp tủ điện, bảng phân phối, trạm điện, máy phát]
- Soát kỹ bên trong: vết cháy sém, đổi màu (C9); vật dễ cháy, vật lạ (C10); bụi bẩn, đầu dây không bấm cos (C8); dây thừa, dây cũ cắt cụt (C6, C7); thiếu tấm che phần mang điện (C12).
- Xung quanh: hàng hóa, carton sát tủ (C11); vật dễ cháy trong phòng máy phát, trạm điện (D2); không có bình chữa cháy hoặc bình cầu (E11).
[Ảnh chụp cửa, lối ra vào, hành lang, cầu thang]
- Cửa thoát nạn khóa, xích, niêm phong (E21); vật chắn hai phía cửa (E23); vật cản trên lối đi (E22); đèn EXIT (E24); chiều mở cửa (E25).
- Cửa chống cháy bị chèn mở, không tự khép (E17), hư hỏng (E18). Không xác định được cửa có phải cửa thoát nạn hay cửa chống cháy: ghi vào "verify".
[Ảnh chụp bình chữa cháy, tủ họng nước, van, tủ bơm, tủ báo cháy]
- Bình: che chắn (E6); kim áp suất, chốt, vòi, vỏ (E7); đặt trên sàn (E8); tem bảo dưỡng (E16); phiếu kiểm tra hằng tháng (E15).
- Tủ họng nước (E9); van sai trạng thái, không khóa (E13); tủ bơm không ở chế độ tự động, áp lực về 0 (E14); tủ báo cháy báo lỗi, bị tắt, cô lập (E3).
[Ảnh chụp kho, khu chất thải, khu ngoài nhà xưởng]
- Chất thải nhựa, xốp, bao bì sai nơi (D1, D3); pallet, carton sát vách nhà xưởng (D4); dung môi, sơn, bình gas ngoài khu quy định (D5, D6, D7); tàn thuốc, hút thuốc (D10).

`;
{const _al=areaLists;areaLists=function(text){return _al(text)+DX_SCENE+DX_BLK}}
window.__DX={rules:[],blk:()=>DX_BLK};
