# Hướng dẫn dựng lại, sửa và kiểm thử

## 1. Cần gì

- **Python 3** và **Pillow** (`python3 -m pip install Pillow`) để tạo icon.
- **Node.js** để kiểm tra cú pháp khi dựng.
- Chrome hoặc Edge để thử.
- Tài khoản Google để lấy key Gemini tại https://aistudio.google.com/apikey.

## 2. Dựng

Từ thư mục gốc của repo:

```bash
python3 build.py 1.0.1
```

Kết quả nằm ở `docs/`. **Đổi số phiên bản mỗi lần phát hành**, nếu không điện thoại có thể giữ bản cũ.

Có máy chủ thì thêm địa chỉ (chỉ cần một lần, địa chỉ được nhớ trong `api-url.txt`):

```bash
python3 build.py 1.0.1 https://audit-pccc-api.<tai-khoan>.workers.dev
```

## 3. Đưa lên mạng

- **GitHub Pages:** repo → Settings → Pages → Source: Deploy from a branch → nhánh chính, thư mục `/docs`.
- **Cloudflare Pages:** tạo project, thư mục xuất bản là `docs`.

Thêm địa chỉ trang vào `ALLOWED_ORIGINS` trong `server/wrangler.toml` rồi `npx wrangler deploy`.

## 4. Sửa app

| Muốn sửa | Sửa ở đâu |
|---|---|
| Lỗi mẫu, dấu hiệu, mức độ, khắc phục mẫu, từ khóa | `5-mau-checklist-pccc/danh-muc-pccc.json` |
| Tên ngắn, căn cứ, "chủ yếu hồ sơ" của hạng mục | Phần `items` trong cùng file JSON |
| Lời nhắc chính cho AI, phạm vi lỗi | `const BASE=` trong `1-ma-nguon-app/soat-anh-pccc.html` |
| Danh sách kiểm tra theo khu vực, quy tắc chọn hạng mục, mốc mức độ | `AREA_CK`, `AIX_RULES` trong `3-cong-cu-dung/ai/ai-boost.js` |
| Kiểm tra theo loại ảnh, ảnh chụp hồ sơ | `DX_SCENE`, `DX_BLK` trong `ai/ai-data.js` |
| Kiến thức chất lỏng, khí dễ cháy; gợi ý "vấn đề có thể có" | `GX_CHEM`, `SX_SC` trong `ai/ai-group.js` |
| Cách chấm điểm, màn chấm | `pcState`, `pcRender` trong `pccc/pccc.js` |
| Cách điền Excel | `pcExportXlsx`, `pcItemText`, `pcStyle`, `pcImgLayout` |
| PDF | `pcCover`, `pcBoard`, `pcNgCanvas`, `pcSlide` |
| Văn phong bản dịch | `TRP` trong mã nguồn chính |
| Tên, icon | `patch_pwa.py`, `pwa_assets.py`, `logo.webp` |

**Thêm một lỗi mẫu:** thêm một phần tử vào `rules` của file JSON: `id` chưa dùng, `hm` là số hạng mục (0 là EHS khác), `t`, `k`, `v`, `z`, `kd`, `n`, `x`, `kw`. Nhóm đầu của `kw` là vật thể; nhóm bắt đầu bằng `!` là loại trừ; viết không dấu.

## 5. Đổi mẫu checklist

Khi khách hàng phát hành mẫu mới:

```bash
python3 3-cong-cu-dung/pccc/lam_sach_mau.py file-moi-da-dien.xlsx 5-mau-checklist-pccc/mau-checklist-pccc.xlsx
python3 build.py 1.1.0
```

`lam_sach_mau.py` giả định bố cục hiện tại: hạng mục ở dòng 8–32, cột B (No), C (phân loại), D (hạng mục, tiếng Hàn rồi xuống dòng tiếng Việt), E (điểm chuẩn), F (điểm), G (kết quả), H (nội dung), I (ảnh), tổng ở dòng 33, xếp hạng ở I2. Nếu mẫu mới đổi số hạng mục hoặc bố cục thì sửa `FIRST`, `LAST` ở hai file `lam_sach_mau.py`, `nap_danh_muc.py`, cập nhật `items` và `hm` trong file JSON, và rà `pcExportXlsx`. `nap_danh_muc.py` sẽ dừng nếu tổng điểm chuẩn khác 100 hoặc có hạng mục chưa có lỗi mẫu.

## 6. Kiểm thử không tốn lượt AI

```bash
python3 build.py 1.0.1
cp source/7-kiem-thu/mock-gemini.js docs/_mock.js
cd docs && python3 -m http.server 8765
```

Mở http://localhost:8765, F12 → Console:

```js
localStorage.setItem('soat-pccc-gkey','AIza-test-key');
localStorage.setItem('soat-pccc-gmodels',JSON.stringify({all:['gemini-2.5-flash'],main:'gemini-2.5-flash',deep:'gemini-2.5-flash'}));
await import('/_mock.js'); await __addPhotos(4);
```

AI giả lập trả 4 kịch bản: hai lỗi cùng hạng mục 23; ba lỗi hạng mục 11; lỗi trùng + lỗi ngoài danh mục + lỗi EHS khác; hạng mục 19 và 20.

Kiểm thử tự động (cần `npm i playwright`): `node source/7-kiem-thu/chay-thu.mjs anh1.jpg anh2.jpg anh3.jpg anh4.jpg`.

**Sau mỗi lần sửa phần xuất Excel, đối chiếu file xuất với mẫu:**

```bash
python3 source/7-kiem-thu/kiem-tra-file-xuat.py source/5-mau-checklist-pccc/mau-checklist-pccc.xlsx file-vua-xuat.xlsx
```

Công cụ báo lỗi nếu thiếu ô, cột B–E hoặc công thức bị đổi, điểm NG khác 0, tổng điểm hoặc hạng lưu sai, số ảnh không khớp.

**Xóa `docs/_mock.js` trước khi đưa lên mạng.**

Danh sách nên thử trước mỗi lần phát hành:

- [ ] Thêm ảnh: AI tự soát, lỗi vào đúng hạng mục, lỗi trùng được gộp.
- [ ] Xác nhận lỗi; đổi hạng mục của một lỗi; lỗi EHS khác không làm đổi điểm.
- [ ] Màn chấm điểm: hạng mục có lỗi tự NG và khóa nút OK; thêm, xóa nội dung NG chấm tay; nút chấm OK hàng loạt.
- [ ] Nút xuất chỉ bấm được khi chấm đủ 25 hạng mục.
- [ ] File .xlsx mở được bằng Excel: điểm, hạng, nội dung song ngữ, ảnh đúng dòng; `kiem-tra-file-xuat.py` báo ĐẠT.
- [ ] PDF: bìa đúng điểm và hạng, bảng điểm, nội dung NG, mỗi ảnh một trang.
- [ ] Điện thoại (375px) và máy tính (1440px), sáng và tối.
- [ ] Có máy chủ: đăng nhập, lưu online, mở audit trên máy khác thấy đúng bảng chấm.

## 7. Máy chủ

Triển khai lần đầu: xem `README.md` ở thư mục gốc. Thử trên máy:

```bash
cd server && npm install
printf 'ADMIN_EMAIL=admin@test.local\nADMIN_PASSWORD=Test-12345678\n' > .dev.vars
npx wrangler d1 execute audit-pccc --local --file schema.sql
npx wrangler dev --local --port 8787 --var ALLOWED_ORIGINS:http://localhost:8765
```

rồi dựng app với `python3 build.py 1.0.1 http://localhost:8787`. Thử xong xóa `api-url.txt` (hoặc dựng lại với địa chỉ thật) để bản phát hành không trỏ về máy thử.

Nếu đã có cơ sở dữ liệu tạo từ bản trước khi có cột `extra`: `npx wrangler d1 execute audit-pccc --remote --command "ALTER TABLE audits ADD COLUMN extra TEXT NOT NULL DEFAULT '{}'"`.
