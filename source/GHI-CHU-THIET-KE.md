# Audit PCCC – Ghi chú thiết kế và các quy tắc đã chốt

Phần A là quy tắc nghiệp vụ, không tự ý đổi. Phần B trở đi mô tả kỹ thuật.

---

## A. Quy tắc đã chốt với người dùng

### A1. Mục đích

- Soát ảnh hiện trường về **an toàn phòng cháy chữa cháy** theo checklist 25 hạng mục, 100 điểm (5 nhóm: Công việc có lửa 20, Trong trần nhà 10, Thiết bị điện 20, Vật liệu dễ cháy và nguy hiểm 20, Phòng cháy chữa cháy và ứng phó ngăn chặn lan rộng 30).
- AI chọn lỗi, khoanh vùng, ghi chi tiết lỗi và gán vào đúng hạng mục; người đánh giá xác nhận.
- Giữ nguyên khung của Audit RBA: dùng trên điện thoại (PWA) và máy tính, quy trình Ảnh → Kiểm tra vi phạm → Xác nhận lỗi → Báo cáo, lưu online, phân quyền 3 cấp.

### A2. Phạm vi lỗi

- Chỉ ghi lỗi **liên quan phòng cháy chữa cháy** thuộc 25 hạng mục.
- Lỗi không thuộc phòng cháy chỉ ghi khi **nguy hiểm, có nguy cơ lớn về EHS** (có thể gây chết người, chấn thương nặng, sự cố lớn). Mã `EH000`, hiển thị "EHS khác".
- Lỗi EHS thông thường (5S, vệ sinh, nhãn mác, PPE thông thường) không ghi.

### A3. Chấm điểm

- Hạng mục có **bất kỳ lỗi đã xác nhận nào** thì NG, **0 điểm**. Không có điểm một phần.
- **Một hạng mục có thể có nhiều lỗi; phải liệt kê hết** kèm ảnh để đơn vị ứng phó.
- Lỗi `EH000`: **ghi riêng, không trừ điểm**, chỉ có trong PDF, không vào file Excel.
- Hạng mục không có lỗi từ ảnh: người đánh giá **bắt buộc chấm** OK hoặc NG. NG chấm tay phải có nội dung vấn đề (dùng cho lỗi hồ sơ, phỏng vấn, không có ảnh).
- Có nút "Chấm OK cho các hạng mục chưa có lỗi" (bấm 2 lần); hạng mục còn lỗi AI chờ xác nhận không bị chấm OK.
- Xếp hạng theo công thức của file mẫu: A ≥ 90, B 80–89, C 70–79, D < 70.
- Mức độ Priority/Major/Minor chỉ để xếp ưu tiên khắc phục, **không ảnh hưởng điểm**.

### A3b. Một ảnh = một hạng mục trọng tâm (v1.0.2)

- Mỗi ảnh chỉ tính **một hạng mục** trong 25 hạng mục: hạng mục trọng tâm (vi phạm chính, nghiêm trọng nhất). AI ghi mã này vào `main_item`; mọi lỗi của hạng mục trọng tâm vẫn liệt kê đủ.
- Lỗi trên cùng ảnh thuộc hạng mục khác được đánh dấu **"hạng mục thứ hai"**, chưa tính điểm. Người đánh giá chọn: **Giữ, tính thêm** hạng mục đó; **Chuyển về** hạng mục trọng tâm; **Lấy làm trọng tâm**; hoặc xóa. Còn lỗi chưa quyết định thì chưa xuất được.
- Hạng mục trọng tâm lấy theo: người đánh giá đã chọn → AI đề xuất → lỗi nặng nhất, nhiều lỗi nhất.
- Lỗi EHS khác (EH000) không thuộc 25 hạng mục nên không bị giới hạn này.

### A3c. Chọn tay hạng mục (v1.0.2)

- Màn Xác nhận lỗi → Sửa và khung Sửa nhóm lỗi lặp lại có ô **"Hạng mục vi phạm"** đặt trên cùng, chọn được 25 hạng mục hoặc "EHS nguy hiểm khác".
- Đổi hạng mục thì danh sách lỗi mẫu chỉ còn lỗi của hạng mục đó; nội dung lỗi giữ nguyên; lỗi được đánh dấu "Đã chọn tay" và AI ghi nhận vào Sổ kinh nghiệm khi xác nhận.
- (v1.0.4) Bảng Xác nhận lỗi có cột **"Hạng mục (bấm để đổi)"**: mỗi dòng lỗi là một ô chọn 25 hạng mục ngay tại chỗ, không cần mở Sửa. Trên điện thoại, mỗi thẻ lỗi có dòng "Hạng mục:" với ô chọn tương tự. Dấu ⚠ = lỗi thuộc hạng mục thứ hai của ảnh, chờ quyết định.

### A3d. AI phán định theo 25 hạng mục checklist (v1.0.4)

- Lời nhắc AI không còn danh mục lỗi rời kiểu RBA. Danh mục gửi AI xếp theo **25 hạng mục**, mỗi hạng mục kèm **yêu cầu nguyên văn của checklist**, các lỗi mẫu nằm bên trong hạng mục đó.
- AI phải trả **"item"** (HM001…HM025 hoặc EH000) trước, bằng cách so hiện trạng với yêu cầu checklist; "rule" (lỗi mẫu) chỉ là phụ, phải thuộc đúng hạng mục đã chọn, không khớp thì để trống. "title" viết bám yêu cầu của hạng mục.
- Lỗi mẫu lệch hạng mục với "item" bị bỏ, hạng mục theo "item". Bộ sửa tự động theo từ khóa chỉ được đổi lỗi mẫu **bên trong** hạng mục AI đã chọn, không được chuyển sang hạng mục khác (chỉ người dùng hoặc Sổ kinh nghiệm đã xác nhận mới đổi được).
- Bảng "Danh mục lỗi", ô chọn loại lỗi ở Sửa và Sửa nhóm: nhóm theo "Hạng mục n · tên", tiêu đề lớn theo 5 phân loại của checklist; bỏ hẳn nhóm của RBA.

### A3e. Bản v1.0.5: chọn nhiều hạng mục, thứ tự 1 → 25, xóa nhanh, chèn ảnh, tự học

- **Một lỗi vi phạm 2 hạng mục**: AI ghi hạng mục trọng tâm vào "item" và hạng mục còn lại vào "also_items". Ảnh có lỗi liên quan từ 2 hạng mục trở lên hiện khung **"Chọn hạng mục tính điểm (một hoặc nhiều)"** (ô đánh dấu, mặc định chỉ hạng mục trọng tâm). Hiện ở: nút ⚠ Chọn HM trên dòng lỗi (mở hộp chọn), khung Sửa, đầu màn chấm điểm. Chưa chọn thì hạng mục phụ chưa tính điểm và chưa xuất được file. Hạng mục được chọn đều bị chấm 0 điểm, ảnh xuất hiện ở mỗi hạng mục đó trong Excel và PDF. Lỗi của hạng mục không chọn được chuyển về hạng mục đã chọn. Có nút "Chọn lại".
- **Thứ tự hạng mục 1 → 25 cho toàn app**: bảng Xác nhận lỗi, danh sách điện thoại, dải ảnh, nút ảnh trước/sau, số thứ tự ảnh đều xếp theo hạng mục trọng tâm của ảnh (lỗi EHS khác và ảnh chưa soát ở cuối).
- **Xóa nhanh**: nút 🗑 Xóa trên từng dòng lỗi (bấm 2 lần). Xóa đề xuất của AI chưa xác nhận = "không phải lỗi", AI ghi vào Sổ tự học.
- **Chèn ảnh ở màn chấm điểm**: nút 📷 Ảnh ở mỗi hạng mục → nhập nội dung → "Chèn ảnh lỗi" (nhiều ảnh). Mỗi ảnh thành một lỗi đã xác nhận của hạng mục đó (khoanh cả ảnh), không đưa cho AI soát, có trong Excel và PDF.
- **Tự học**: lời nhắc AI có thêm phần "HỌC TỪ CÁC LẦN KIỂM TRA TRƯỚC": hạng mục hay vi phạm và cách ghi lỗi đã xác nhận (thư viện lỗi + đợt hiện tại), phán định bị loại, các lần gán nhầm hạng mục. Lời nhắc cấm lỗi mơ hồ ("có thể", "nghi ngờ"…). Lỗi AI viết mơ hồ hoặc giống phán định đã bị loại bị hạ độ chắc chắn (≤55%/50%, dưới ngưỡng 60% thì chuyển sang mục cần kiểm tra thêm) và gắn nhãn "Mơ hồ"/"Từng bị loại". Màn chấm điểm hiện "Hay vi phạm: n/N lần audit".
- **PDF**: trang ảnh xếp đúng thứ tự hạng mục 1 → 25, mỗi trang một ảnh của một hạng mục (ảnh liên quan 2 hạng mục có 2 trang, không gộp), cuối cùng là lỗi EHS khác.

### A3f. Bản v1.0.6: chèn ảnh xác nhận/ảnh lỗi, xóa nhanh, ảnh và hàng Excel cố định

- Màn chấm điểm: nút **📷 Chèn ảnh** ở mỗi hạng mục, chọn loại ảnh: **Ảnh xác nhận đạt** (hạng mục OK, ví dụ ảnh hồ sơ; nội dung không bắt buộc; không trừ điểm; hạng mục chưa có lỗi được tự chấm OK) hoặc **Ảnh lỗi** (cần nội dung; hạng mục 0 điểm). Mỗi ảnh chèn tay có nút × (bấm 2 lần) để xóa nếu chọn nhầm; với lỗi trên ảnh hiện trường, × chỉ xóa lỗi đó.
- Ảnh trong báo cáo (Excel và PDF) phủ kín khung 4:3, không còn viền tối hay nền mờ; ảnh chèn tay không vẽ khung khoanh quanh cả ảnh.
- Excel: mọi ảnh cùng một kích thước 184×138 px, đặt trong ô cột I, 2 ảnh mỗi dòng, căn giữa. Cả 25 hàng hạng mục cùng chiều cao 160,5 pt (kể cả hàng OK). Chữ tự giảm cỡ 18 → 14 → 11 để vừa hàng; chỉ khi chữ vẫn không vừa hoặc hạng mục có từ 3 ảnh trở lên thì hàng đó mới cao hơn (ngoại lệ, tối đa 409 pt, tối đa 8 ảnh, ảnh cuối ghi +n). Ảnh xác nhận có nhãn ĐẠT.
- PDF: ảnh xác nhận đạt có trang riêng ở đúng vị trí hạng mục, nhãn xanh "Hạng mục n · Đạt".
- Lựa chọn hạng mục của ảnh, ảnh xác nhận và ghi chú được lưu trong p.analysis.pc nên còn sau khi tải lại và được đồng bộ máy chủ.

### A3g. Bản v1.0.7: sửa nhãn "Đạt" sai trong PDF, bố cục Excel chuẩn

- PDF: trước đây trang lỗi bị gắn nhãn xanh "Hạng mục n · Đạt" vì cờ ảnh xác nhận trùng tên trường `ev` (mô tả bằng chứng) của mọi lỗi. Nay dùng cờ riêng `pcEvidence`. Quy tắc nhãn: lỗi trong 25 hạng mục → nhãn đỏ "Hạng mục n", dòng phụ "tên · 0/điểm"; ảnh xác nhận đạt → nhãn xanh "Hạng mục n · Đạt", dòng phụ "điểm/điểm"; lỗi EHS khác → nhãn tím.
- Excel: mẫu gốc ghi `customHeight="160.5"` (không hợp lệ) nên Excel trên điện thoại tự co giãn hàng → hàng to hàng nhỏ, chữ bị khuất. Nay mọi hàng ghi `customHeight="1"`.
- Được phép đổi tỷ lệ hàng/cột (theo yêu cầu người dùng): cột H (nội dung NG) 58,3 → 72, cột I (hình ảnh) 53,6 → 66; 25 hàng hạng mục cùng cao 150 pt; in vừa 1 trang theo chiều ngang (fitToWidth=1). Các cột, ô, công thức, kiểu chữ khác giữ nguyên.
- Ảnh Excel 220×165 px, 2 ảnh mỗi dòng trong ô. Cỡ chữ nội dung NG tự chọn 18 → 14 → 11 theo chiều cao hàng thực tế; chỉ hàng có chữ quá dài hoặc từ 3 ảnh trở lên mới cao hơn.
- Kịch bản kiểm tra mẫu chấp nhận đổi độ rộng cột H, I và cách in; kiểm tra thêm 25 hàng phải có customHeight="1".

### A3h. Bản v1.0.8: dùng mẫu checklist chuẩn của công ty, bố cục đọc tự động

- Mẫu gốc của công ty đặt ở `source/5-mau-checklist-pccc/goc/mau-cong-ty.xlsx` (mẫu cũ lưu ở `goc/mau-cu-v1.0.7.xlsx`). Muốn đổi mẫu: thay file này rồi build lại.
- `chuan_bi_mau.py` (build tự chạy) đọc bố cục từ chính mẫu: dòng của 25 hạng mục (tìm theo cột "No" = 1…25, bỏ qua các dòng tiêu đề lặp ở đầu mỗi trang), cột theo tiêu đề (Điểm tiêu chuẩn, Điểm đánh giá, Kết quả, Nội dung, Hình ảnh), ô thông tin đầu trang (ô ngay bên phải nhãn Tên công ty, Người kiểm tra, Ngày kiểm tra, Phân loại), ô tổng (dòng SUM), ô xếp hạng (ô có công thức IF … "A"). Ghi ra `bo-cuc-mau.json`; app điền theo bố cục này.
- Mẫu công ty hiện tại: dòng hạng mục 8–13, 15–23, 25–34; tiêu đề lặp 7, 14, 24; cột F chuẩn, G điểm, H kết quả, J nội dung, K hình ảnh; tổng G35; hạng K2; đầu trang D2–D5.
- Giữ nguyên độ rộng cột, chiều cao hàng (160,5 / 127,5 / 114 theo từng trang), ngắt trang, lề, khổ in của mẫu. Chỉ sửa customHeight cho hợp lệ, bỏ calcChain và bật tính lại công thức khi mở, thêm phần khai báo ảnh và 7 kiểu ô nền vàng cho dòng NG.
- Ảnh: mọi ảnh cùng một kích thước tính từ ô hình ảnh nhỏ nhất của mẫu (hiện 173×129 px), luôn căn giữa ô theo cả hai chiều, lề 10 px; 2 ảnh mỗi dòng. Chỉ hàng có chữ quá dài hoặc từ 3 ảnh trở lên mới cao hơn; khi đó app chỉ giảm tỷ lệ in để mỗi trang vẫn vừa 1 tờ A4 ngang theo ngắt trang của mẫu.
- Kịch bản kiểm tra đọc `bo-cuc-mau.json`: kiểm tra ô cố định, công thức, cột, ô gộp, ngắt trang, styles, chiều cao hàng, điểm/kết quả, và ảnh (cùng kích thước, nằm trọn trong ô, khối ảnh căn giữa lệch ≤ 2 px).

### A3i. Bản v1.0.9: PDF và Excel xuất đầy đủ mọi lỗi

- Nguyên nhân thiếu lỗi: tính năng "gộp lỗi lặp lại khi xuất" thừa hưởng từ Audit RBA gộp các lỗi giống nhau ở nhiều vị trí thành một dòng "(lặp lại tại N vị trí)" và chỉ giữ một ảnh đại diện. Bản PCCC không dùng cơ chế này khi xuất: pcCollect lấy thẳng từng lỗi đã xác nhận của từng ảnh.
- Trang "Nội dung NG theo hạng mục" thành danh sách lỗi chi tiết: mọi lỗi của mọi hạng mục NG (kể cả lỗi không ảnh), thêm mục "Lỗi EHS khác"; mỗi lỗi có khu vực: nội dung, bản dịch. (v1.0.10: theo yêu cầu, PDF không in mức độ và biện pháp khắc phục, chỉ ảnh và lỗi vi phạm.) Trước đây hạng mục dài hơn một trang bị cắt; nay chia sang trang sau với tiêu đề "(tiếp)", không bỏ dòng nào.
- Trang ảnh: chỉ ảnh khoanh vùng và lỗi vi phạm; ảnh có nhiều lỗi không vừa một trang thì chia sang trang nối tiếp cùng ảnh "(tiếp)".
- Excel: nội dung cột NG liệt kê đủ mọi lỗi; ô hình ảnh vẫn tối đa 8 ảnh (ảnh cuối ghi +n) vì giới hạn chiều cao hàng 409 pt.

### A3j. Bản v1.1.0: PDF rút gọn, trọng tâm tủ điện và lối thoát nạn, tối ưu thao tác

- **PDF** chỉ còn 1 trang bìa + các trang ảnh. Bỏ bảng điểm 25 hạng mục và trang "Nội dung NG theo hạng mục" (hàm pcBoard, pcNgBlocks, pcNgPages, pcNgCanvas vẫn còn trong mã nhưng không gọi). Trang bìa không ghi điểm, không xếp hạng; chỉ có thông tin đợt kiểm tra, số ảnh, số lỗi. Trang ảnh không ghi "0/điểm". Hệ quả: lỗi không kèm ảnh (ghi chú hồ sơ) chỉ còn trong Excel.
- Trang ảnh chỉ có 1 lỗi: cắt ảnh tập trung vào vùng khoanh (minFrac .42, phóng tối đa khoảng 2,4 lần); nhiều lỗi: cắt theo vùng bao các khung (minFrac .6).
- **Danh mục lỗi mẫu** tăng 90 → 119: thêm C16–C36 (tủ điện, đấu nối, dây ngoài tủ, hồ sơ bảo dưỡng điện) và E31–E38 (lối thoát nạn) theo danh sách 45 lỗi phổ biến người dùng cung cấp. Quy ước trọng tâm: mọi lỗi ở trong/trên tủ điện → hạng mục 14 (đã chuyển C8 "tủ điện bụi bẩn" từ 13 sang 14); dây ngoài tủ → 12; dây trong trần → 11; dây bỏ không → 13; cửa, lối, biển, đèn thoát nạn → 23 (chỉ cạnh nơi làm việc có lửa mới là 9); cửa chống cháy, lỗ xuyên tường/sàn ngăn cháy → 22; sơ đồ thoát nạn → 24; hồ sơ bảo dưỡng tủ điện → 25. Mốc 60°C không tự kết luận là lỗi. Lời nhắc AI (AIX_RULES, AREA_CK, mốc mức độ) cập nhật theo.
- **Giao diện**: thanh lọc nhanh theo hạng mục ở Xác nhận lỗi (điện thoại và máy tính); thẻ lỗi điện thoại gọn, Sửa/Xác nhận/Xóa cùng một dòng; màn chấm điểm có lọc Tất cả / Chưa chấm / NG / OK, nút to hơn; khung chọn nhiều hạng mục có ô đánh dấu cùng dòng. Không đổi file Excel.

### A3k. Bản v1.1.1: ảnh tổng quát, mỗi ô một ảnh 16:9, bỏ dòng tiêu đề lặp

- **Ảnh báo cáo (PDF và Excel)**: không phóng sát lỗi nữa. Ảnh giữ toàn cảnh, chỉ cắt cho đúng tỷ lệ khung (minFrac 1), vùng cắt bám theo các khung khoanh lỗi.
- **Một ảnh không ghi hai lỗi giống nhau**: lời nhắc AI cấm ghi trùng; sau khi AI soát, pcDedupe gộp các lỗi AI trùng (hàm isDup). Hai lỗi trùng khác hạng mục: giữ lỗi của hạng mục trọng tâm, hạng mục kia thành lựa chọn "tính thêm" cho người dùng.
- **Excel, mỗi ô một ảnh**: ảnh 16:9 cùng một kích thước (hiện 235×132 px, tính từ hàng thấp nhất), căn giữa ô (trái = phải, trên = dưới). Hạng mục nhiều ảnh: ảnh tiếp theo sang ô liền kề bên phải (K, L, N, O…; bỏ qua cột M ẩn chứa danh sách OK/NG), tối đa 8 ảnh, ảnh thứ 8 ghi +n. Cột ảnh thêm rộng bằng ảnh + 2 lề 10 px; ô tiêu đề "Hình ảnh" gộp qua các cột ảnh. Hàng không còn cao thêm vì ảnh.
- Lưu ý: 4 lề bằng nhau tuyệt đối không đạt được ở cột K vì độ rộng cột K và chiều cao hàng của mẫu cố định (hàng cao 160,5 / 127,5 / 114 pt) trong khi ảnh giữ một kích thước; ở các cột ảnh thêm, lề trái/phải = 10 px.
- **Bỏ dòng tiêu đề lặp**: chuan_bi_mau.py xóa các dòng tiêu đề lặp giữa bảng (dòng 14, 24 của mẫu công ty), dồn dòng, sửa công thức, ô gộp, ngắt trang; 25 hạng mục nay ở dòng 8–32, tổng G33. Khi in, dòng tiêu đề vẫn lặp ở đầu mỗi trang nhờ Print Titles.
- **Cột J (nội dung NG)** nới từ 58,3 lên 76 để hiện đủ chữ. Tỷ lệ in tự giảm theo cả chiều rộng và chiều cao.

### A3l. Bản v1.1.2: ảnh Excel 4 lề đều, tối đa 3 ảnh một hàng

- Người dùng chọn: ảnh to nhỏ theo chiều cao hàng, tối đa 3 ảnh một hàng (cột K, L, N; ảnh thứ 3 ghi +n nếu còn). Mỗi ô một ảnh 16:9, căn giữa.
- Để 4 lề thực sự bằng nhau (10 px): cột ảnh thêm rộng bằng đúng cột K; **hàng có ảnh cao tối thiểu 165 pt** (ô 375×220 px, ảnh 355×200 px). Hàng không có ảnh giữ chiều cao của mẫu. Hàng phải cao hơn nữa vì chữ dài thì ảnh giữ 355×200, lề trên/dưới lớn hơn.
- pcImgSize(rowPx) tính kích thước ảnh theo hàng; PCI.fullPt là chiều cao tối thiểu của hàng có ảnh. Kịch bản kiểm tra: tối đa 3 ảnh/hàng, 16:9, căn giữa, 4 lề 8–14 px ở hàng cao chuẩn.

### A3m. Bản v1.1.3: PDF giữ nguyên ảnh gốc

- Trang ảnh PDF không cắt ảnh nữa: khung ảnh co theo đúng tỷ lệ ảnh gốc (tối đa 980 px ngang, hết chiều cao thân trang), ảnh ngang hay dọc đều hiện trọn, lỗi khoanh vùng trên ảnh; cột chữ bắt đầu ngay sau ảnh. Excel vẫn là ô 16:9 (cắt theo tỷ lệ ô, bám vùng lỗi).

### A4. File checklist (.xlsx) là mẫu cố định

- Mẫu trống tạo từ file ví dụ người dùng gửi (`5-mau-checklist-pccc/mau-checklist-pccc.xlsx`). **Không đổi** hạng mục, phân loại, điểm tiêu chuẩn, thang xếp hạng, công thức, bề rộng cột, ô gộp, danh sách chọn OK/NG, khổ in.
- App chỉ điền:
  - D2 tên công ty, D3 người kiểm tra, D4 ngày kiểm tra, D5 phân loại;
  - cột F (Điểm đánh giá): điểm tiêu chuẩn nếu OK, 0 nếu NG;
  - cột G (Kết quả): OK hoặc NG;
  - cột H (Nội dung vấn đề nếu NG): tiếng Việt ở trên, bản dịch (mặc định tiếng Hàn) ở dưới; dạng "Khu vực: nội dung"; nhiều lỗi thì đánh số 1, 2, 3…;
  - cột I (Hình ảnh vấn đề): ảnh 4:3 có khoanh vùng; số trên ảnh trùng số trong cột H; nhiều ảnh xếp lưới 2 hoặc 3 cột.
- Dòng NG tô vàng ô F, G, H như file ví dụ. Chiều cao dòng NG tự tăng cho vừa chữ và ảnh (tối đa 409 pt là giới hạn của Excel); chữ tự thu nhỏ 18 → 14 → 11 pt khi nội dung dài.
- Giá trị lưu sẵn của ô tổng điểm (F33) và ô xếp hạng (I2) được ghi đúng để xem trước trên điện thoại vẫn thấy đúng điểm; công thức giữ nguyên.
- Nền vàng ở cột D, E của file ví dụ là đánh dấu của lần kiểm tra cũ nên mẫu trống đã bỏ.

### A5. PDF báo cáo nhanh

Khổ 16:9 như PDF trình chiếu của Audit RBA, song ngữ theo cài đặt:

1. **Bìa**: công ty, ngày, người kiểm tra, phân loại, **điểm và hạng**, số hạng mục NG, số lỗi, số ảnh, số lỗi EHS khác.
2. **Bảng điểm 25 hạng mục**: điểm chuẩn, điểm đạt, OK/NG.
3. **Nội dung NG theo hạng mục** (tự chia trang).
4. **Mỗi ảnh một trang**: ảnh có khoanh vùng, từng lỗi gắn nhãn "Hạng mục n" (đỏ) hoặc "EHS khác" (tím).

### A6. Điều kiện xuất

Chỉ xuất khi: đã nhập tên công ty; AI soát xong; mọi lỗi đã xác nhận hoặc xóa; **đã chấm đủ 25 hạng mục**. Thiếu tên người kiểm tra hoặc còn ảnh chưa soát chỉ là cảnh báo. Không có lỗi nào vẫn xuất được (100 điểm).

### A7. Giữ nguyên từ Audit RBA

AI chỉ đề xuất; chỉ nêu điều nhìn thấy; mỗi vi phạm ghi một lần; gộp lỗi trùng; gom lỗi lặp lại ở nhiều ảnh; ngưỡng chắc chắn 60%; sửa tại chỗ ở màn Xác nhận lỗi; sổ kinh nghiệm; thư viện lỗi tự thêm khi xuất; tài liệu tham chiếu; Xuất/Nhập gói; key Gemini riêng từng người; ảnh báo cáo và file nén ảnh.

Đã ẩn vì gắn với RBA: nạp file Guider, file đối chiếu 41 mã, báo cáo Word, nạp file Findings cũ.

---

## B. Kỹ thuật

### B1. Cách dựng

`build.py` chạy lần lượt: `pccc/nap_danh_muc.py` (nạp danh mục và mẫu vào dòng `const RBA=`) → `patch_pwa.py` → `pwa_assets.py` → `patch_cloud.py` → `patch_ai.py` → `pccc/patch_pccc.py` → kiểm tra cú pháp JS → ghi `docs/`.

### B2. Ánh xạ dữ liệu (dùng lại khung của Audit RBA)

| Trong mã | Ý nghĩa ở bản PCCC |
|---|---|
| `RBA.codes` | 25 hạng mục `HM001`…`HM025` và `EH000`; mỗi mục có `no`, `row` (dòng trong Excel), `pts`, `vi`, `ko`, `g` (phân loại), `doc` (chủ yếu hồ sơ) |
| `RBA.order` | Thứ tự 25 mã hạng mục |
| `RBA.rules` | Lỗi mẫu; `c` là mã hạng mục, `kw` là nhóm từ khóa |
| `RBA.tpl.b64` | File mẫu checklist |
| `f.code` của một lỗi | Hạng mục của lỗi; `f.req` là nhãn hiển thị "HM n" |

### B3. Lớp PCCC (`pccc/pccc.js`)

| Phần | Hàm |
|---|---|
| Trạng thái chấm tay | `PC` (lưu `localStorage` khóa `soat-pccc-ck`; đồng bộ lên máy chủ qua trường `extra` của audit) |
| Tính điểm | `pcState`, `pcGroups` |
| Màn chấm điểm, thẻ điểm ở Tổng quan | `pcRender`, bọc `renderHub`, `renderDash` |
| Điều kiện xuất | `exportReady`, `gateExport` |
| Gom lỗi theo hạng mục, đánh số | `pcCollect`, `pcItemText` |
| Xuất Excel | `pcExportXlsx` (thay `exportFindings`), `pcStyle`, `pcImgLayout`, `pcSetCell` |
| PDF | `pcCover`, `pcBoard`, `pcNgBlocks`, `pcNgCanvas`, `pcSlide`, `exportPdf` |

### B4. Máy chủ

Giống Audit RBA, thêm cột `audits.extra` (JSON, tối đa 60 KB) chứa bảng chấm tay. `POST /api/audits` và `PATCH /api/audits/:id` nhận `extra`; mọi lệnh trả audit đều kèm `extra`. Khóa audit hoặc đổi người tạo không làm mất `extra`.

### B5. Lưu trữ

Tiền tố `soat-pccc` cho IndexedDB và localStorage, nên chạy chung trình duyệt với Audit RBA không đè dữ liệu nhau. Gói hiện trường (`manifest.json`, `app: soat-anh-pccc`) có thêm `ck` là bảng chấm tay.

---

## C. Giới hạn đã biết

- **Chưa thử với Gemini thật.** Mọi kiểm thử dùng AI giả lập. Lần dùng thật đầu tiên nên đọc kỹ vài ảnh đầu: AI gán hạng mục có đúng không, câu tiếng Hàn có đúng văn phong không; chỉnh `BASE`, `AIX_RULES`, `TRP` nếu cần.
- **Căn cứ pháp lý** lấy lại từ dữ liệu của Audit RBA, chỉ để tra cứu trong app, không in ra file. Cần đối chiếu văn bản gốc trước khi trích dẫn.
- **Hạng mục hồ sơ** (1, 2, 8, 24, 25): AI chỉ kết luận được khi ảnh chụp chính tài liệu và đọc được chữ; còn lại người đánh giá chấm tay.
- **Một dòng Excel cao tối đa 409 pt.** Hạng mục có rất nhiều lỗi (trên khoảng 8–10 lỗi dài) có thể bị tràn chữ; khi đó xem đủ nội dung trong PDF.
- **Hai người cùng chấm tay một audit online:** lần lưu sau ghi đè lần trước ở cấp cả bảng chấm (không gộp từng hạng mục).
- **Font chữ Hàn, Trung** trên PDF và ảnh lấy font có sẵn của máy.
- Các giới hạn chung của Audit RBA vẫn đúng: ảnh HEIC trên Chrome máy tính, chọn thư mục trên iPhone, mở link trong Zalo/Messenger.

---

## D. Lịch sử phiên bản

| Bản | Nội dung |
|---|---|
| **v1.1.3** | PDF giữ nguyên ảnh gốc không cắt, kèm khoanh vùng lỗi |
| **v1.1.2** | Excel: ảnh 4 lề đều 10 px, tối đa 3 ảnh một hàng, hàng có ảnh cao 165 pt |
| **v1.1.1** | Ảnh báo cáo giữ toàn cảnh; gộp lỗi trùng trong một ảnh; Excel mỗi ô một ảnh 16:9, ảnh thêm sang ô liền kề; bỏ dòng tiêu đề lặp; cột J rộng hơn |
| **v1.1.0** | PDF chỉ còn bìa (không điểm, không hạng) + trang ảnh, cắt ảnh tập trung vào lỗi; thêm 29 lỗi mẫu tủ điện và lối thoát nạn, quy tắc trọng tâm; tối ưu giao diện thao tác |
| **v1.0.10** | PDF bỏ mức độ và biện pháp khắc phục, chỉ còn ảnh và lỗi vi phạm |
| **v1.0.9** | PDF/Excel xuất đủ mọi lỗi (bỏ gộp lỗi lặp lại kiểu RBA); danh sách lỗi chi tiết có mức độ, khắc phục, lỗi EHS; chia trang không cắt dòng |
| **v1.0.8** | Dùng mẫu checklist chuẩn của công ty (có dòng tiêu đề lặp mỗi trang); bố cục đọc tự động từ mẫu; ảnh cùng kích thước, căn giữa ô có lề; giữ hàng/cột/ngắt trang của mẫu, chỉ giảm tỷ lệ in khi cần |
| **v1.0.7** | Sửa nhãn "Đạt" xanh sai trên trang lỗi trong PDF; Excel: hàng cố định không tự co giãn, cột nội dung và hình ảnh rộng hơn, cùng chiều cao hàng, in vừa trang ngang |
| **v1.0.6** | Nút Chèn ảnh (ảnh xác nhận đạt hoặc ảnh lỗi) ở màn chấm điểm, xóa nhanh ảnh chèn nhầm; ảnh báo cáo phủ kín khung, cùng một kích thước; 25 hàng Excel cùng chiều cao, chỉ hàng quá nhiều chữ/ảnh mới cao hơn |
| **v1.0.5** | Chọn một hoặc nhiều hạng mục cho ảnh/lỗi liên quan nhiều hạng mục; mọi danh sách xếp theo hạng mục 1 → 25; nút xóa nhanh; chèn ảnh bổ sung ở màn chấm điểm; tự học lỗi hay gặp, chặn lỗi mơ hồ; PDF xếp ảnh theo hạng mục, không gộp |
| **v1.0.4** | Nút chọn hạng mục ngay trên từng dòng lỗi (bảng và thẻ điện thoại); AI phán định theo yêu cầu của 25 hạng mục checklist (trường "item" bắt buộc), bỏ nhóm danh mục RBA |
| **v1.0.3** | Ảnh trong file Excel cùng khung, cùng kích thước |
| **v1.0.2** | Chọn tay hạng mục vi phạm ở khung Sửa và Sửa nhóm; một ảnh chỉ tính một hạng mục trọng tâm, lỗi hạng mục thứ hai phải được người đánh giá quyết định |
| **v1.0.0** | Bản đầu, tách từ Audit RBA v1.7.0: danh mục 25 hạng mục và 90 lỗi mẫu PCCC, lời nhắc AI theo checklist, màn chấm điểm OK/NG, xuất checklist .xlsx đúng mẫu, PDF báo cáo nhanh có điểm và hạng, lỗi EHS khác ghi riêng, đồng bộ bảng chấm lên máy chủ |
