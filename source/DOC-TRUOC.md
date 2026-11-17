# Audit PCCC – Gói mã nguồn

App soát ảnh hiện trường theo **Checklist kiểm tra PCCC 25 hạng mục, 100 điểm**: AI khoanh vùng và viết lỗi, người đánh giá xác nhận và chấm OK/NG, app xuất file checklist (.xlsx) đúng mẫu và PDF báo cáo nhanh. Dựng trên nền app Audit RBA v1.7.0.

## Trong gói có gì

| Thư mục, file | Dùng để |
|---|---|
| `DOC-TRUOC.md` | File này |
| `GHI-CHU-THIET-KE.md` | **Các quy tắc đã chốt**, cách chấm điểm, cách điền file Excel, bố cục PDF, kiến trúc, giới hạn |
| `HUONG-DAN-DUNG-LAI.md` | Dựng lại, sửa danh mục, đổi mẫu checklist, kiểm thử, triển khai máy chủ |
| `PHU-LUC-DANH-MUC-VA-THOI-HAN.md` | 25 hạng mục, 90 lỗi mẫu, bảng thời hạn |
| `1-ma-nguon-app/soat-anh-pccc.html` | Mã nguồn app trong một file: giao diện, xử lý ảnh, khoanh vùng, AI, xác nhận lỗi, lưu trữ |
| `3-cong-cu-dung/patch_pwa.py`, `pwa_assets.py`, `logo.webp` | Biến mã nguồn thành bản cài web dùng Gemini; icon, manifest, service worker |
| `3-cong-cu-dung/cloud/`, `patch_cloud.py` | Lớp online: đăng nhập, Kho audit, phân quyền, trang Quản trị |
| `3-cong-cu-dung/ai/`, `patch_ai.py` | Lớp nâng cao AI: danh sách kiểm tra theo khu vực, tự kiểm tra lại, bảng từ khóa, gom lỗi lặp lại, song ngữ |
| `3-cong-cu-dung/pccc/` | **Lớp PCCC**: chấm điểm 25 hạng mục, xuất checklist, PDF (`pccc.js`, `pccc.css`, `patch_pccc.py`); `nap_danh_muc.py` nạp danh mục và mẫu vào mã nguồn; `lam_sach_mau.py` làm mẫu trống từ một file đã điền |
| `5-mau-checklist-pccc/mau-checklist-pccc.xlsx` | **Mẫu checklist trống** (được nhúng vào app) |
| `5-mau-checklist-pccc/danh-muc-pccc.json` | **Danh mục lỗi**: lỗi mẫu, dấu hiệu, từ khóa, căn cứ tham khảo |
| `7-kiem-thu/` | `mock-gemini.js` (AI giả lập), `chay-thu.mjs` (kiểm thử tự động), `kiem-tra-file-xuat.py` (đối chiếu file xuất với mẫu) |

## Dùng nhanh

- **Dựng:** từ thư mục gốc của repo chạy `python3 build.py <số phiên bản>`. Kết quả nằm ở `docs/`.
- **Sửa lỗi mẫu, từ khóa:** sửa `5-mau-checklist-pccc/danh-muc-pccc.json` rồi dựng lại.
- **Sửa cách chấm, cách điền Excel, PDF:** `3-cong-cu-dung/pccc/pccc.js`.
- **Sửa lời nhắc AI:** hằng `BASE` trong `1-ma-nguon-app/soat-anh-pccc.html`; danh sách kiểm tra theo khu vực trong `ai/ai-boost.js`, theo loại ảnh trong `ai/ai-data.js`.

## Lưu ý quan trọng nhất

1. **File checklist là mẫu cố định.** Không đổi 25 hạng mục, điểm tiêu chuẩn, công thức. Sau mỗi lần sửa phần xuất file, chạy `7-kiem-thu/kiem-tra-file-xuat.py` để chắc chắn mẫu không bị đổi.
2. Hạng mục có lỗi đã xác nhận được 0 điểm; liệt kê đủ mọi lỗi.
3. Lỗi EHS nguy hiểm ngoài checklist ghi riêng, không trừ điểm.
4. Phải chấm đủ 25 hạng mục mới xuất được.
5. AI chỉ đề xuất; người đánh giá xác nhận từng lỗi.
6. Gói này không chứa key AI, ảnh hiện trường hay file checklist đã điền của bất kỳ công ty nào.
