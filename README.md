# Audit PCCC

App soát ảnh hiện trường về an toàn phòng cháy chữa cháy theo **Checklist kiểm tra PCCC 25 hạng mục (100 điểm)**. AI khoanh vùng và viết lỗi, người đánh giá xác nhận và chấm OK/NG từng hạng mục, app xuất **file checklist (.xlsx) đúng mẫu** và **PDF báo cáo nhanh**. Dựng trên nền app [Audit RBA](https://github.com/ngocngon/audit-rba): cùng quy trình, cùng giao diện, cùng phần lưu online và phân quyền.

## Quy tắc chấm (đã chốt)

- Hạng mục có **bất kỳ lỗi nào đã xác nhận** thì NG và được **0 điểm**. Một hạng mục có thể có nhiều lỗi: app ghi đủ mọi lỗi kèm ảnh để đơn vị khắc phục hết.
- Chỉ ghi hai loại lỗi: lỗi về PCCC thuộc 25 hạng mục; và lỗi không thuộc PCCC nhưng **nguy hiểm, nguy cơ lớn về EHS**. Loại thứ hai được **ghi riêng trong PDF, không trừ điểm, không vào file Excel**.
- Hạng mục không có lỗi từ ảnh (nhất là các mục hồ sơ: giấy phép, đào tạo, diễn tập) **bắt buộc chấm tay** OK hoặc NG kèm nội dung. Chưa chấm đủ 25 hạng mục thì chưa xuất được.
- File checklist là **mẫu cố định**: app chỉ điền thông tin đầu trang, cột Điểm đánh giá, Kết quả, Nội dung vấn đề, Hình ảnh. Không đổi hạng mục, điểm tiêu chuẩn, công thức, khổ in.
- AI chỉ đề xuất; file xuất chỉ gồm lỗi đã được người đánh giá xác nhận.

## Quy trình dùng

**Ảnh → Kiểm tra vi phạm → Xác nhận lỗi → Chấm điểm 25 hạng mục → Xuất báo cáo**

1. Nhập tên công ty, người kiểm tra, ngày, phân loại.
2. Chụp hoặc thêm ảnh. AI tự soát, khoanh vùng, gán lỗi vào đúng hạng mục.
3. Xác nhận, sửa hoặc xóa từng lỗi (sửa ngay tại chỗ, đổi hạng mục được).
4. Màn **Báo cáo → Chấm điểm 25 hạng mục**: hạng mục có lỗi tự NG; các hạng mục còn lại chấm OK, hoặc NG kèm nội dung (cho lỗi hồ sơ không có ảnh).
5. Xuất **checklist (.xlsx)** và **PDF báo cáo nhanh** (bìa có điểm và hạng, bảng điểm 25 hạng mục, nội dung NG, mỗi ảnh một trang). Song ngữ Việt – Hàn mặc định; đổi được sang Việt – Trung, Việt – Anh, chỉ tiếng Việt.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `docs/` | Bản cài web (PWA) đã dựng, đưa lên GitHub Pages hoặc Cloudflare Pages là chạy |
| `server/` | Máy chủ Cloudflare Workers + D1 (+ R2): đăng nhập, Kho audit online, phân quyền 3 cấp |
| `source/1-ma-nguon-app/` | Mã nguồn app trong một file HTML |
| `source/3-cong-cu-dung/` | Các lớp ghép vào khi dựng: cài app (`patch_pwa.py`), online (`cloud/`), nâng cao AI (`ai/`), **PCCC (`pccc/`)** |
| `source/5-mau-checklist-pccc/` | **Mẫu checklist trống** và **danh mục lỗi** (`danh-muc-pccc.json`) |
| `source/7-kiem-thu/` | AI giả lập, kiểm thử tự động, công cụ đối chiếu file xuất với mẫu |
| `build.py` | Đóng gói một lệnh |

Đọc tiếp: `source/DOC-TRUOC.md`, `source/GHI-CHU-THIET-KE.md`, `source/HUONG-DAN-DUNG-LAI.md`, `source/PHU-LUC-DANH-MUC-VA-THOI-HAN.md`.

## Dựng và phát hành

```bash
python3 build.py 1.0.0                      # chạy trên máy, chưa có máy chủ
python3 build.py 1.0.0 https://audit-pccc-api.<tai-khoan>.workers.dev   # có máy chủ; địa chỉ được nhớ trong api-url.txt
git add -A && git commit -m "v1.0.0" && git push
```

Nhớ tăng số phiên bản mỗi lần phát hành để điện thoại lấy bản mới. Cần Python 3, Pillow và Node.js (để kiểm tra cú pháp).

**Đưa app lên mạng:** bật GitHub Pages cho thư mục `docs/` của nhánh chính (Settings → Pages), hoặc tạo project Cloudflare Pages trỏ vào `docs/`.

**Chưa có máy chủ vẫn dùng được:** app chạy đủ tính năng trên từng máy (lưu trong trình duyệt, chuyển máy bằng Xuất gói). Phần đăng nhập, Kho audit online và phân quyền bật lên sau khi triển khai `server/` và dựng lại với địa chỉ máy chủ.

## Triển khai máy chủ (làm một lần)

```bash
cd server && npm install
npx wrangler login
npx wrangler d1 create audit-pccc            # dán database_id nhận được vào wrangler.toml
npx wrangler d1 execute audit-pccc --remote --file schema.sql
npx wrangler secret put ADMIN_EMAIL          # email quản trị viên đầu tiên
npx wrangler secret put ADMIN_PASSWORD       # mật khẩu tạm, bị buộc đổi ở lần đăng nhập đầu
npx wrangler deploy
```

Sửa `ALLOWED_ORIGINS` trong `wrangler.toml` thành đúng địa chỉ trang app. Máy chủ này **tách hẳn** với máy chủ của Audit RBA (tên Worker, cơ sở dữ liệu, kho ảnh đều riêng).

## AI

Mỗi người dùng key Gemini của riêng mình (mức miễn phí dùng được), lưu trên máy. Ở mức miễn phí, Google có thể dùng ảnh gửi lên để cải thiện dịch vụ; ảnh thuộc diện bảo mật thì nên bật thanh toán cho dự án Google.
