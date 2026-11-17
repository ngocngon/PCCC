#!/usr/bin/env python3
"""Làm sạch một file checklist PCCC đã điền thành MẪU TRỐNG để nhúng vào app.

    python3 lam_sach_mau.py <checklist-da-dien.xlsx> <mau-checklist-pccc.xlsx>

Giữ nguyên: 25 hạng mục, phân loại, điểm tiêu chuẩn, thang xếp hạng, công thức, bề rộng cột,
ô gộp, danh sách chọn OK/NG, khổ in. Chỉ xóa dữ liệu của lần kiểm tra cũ:
- thông tin đầu trang (tên công ty, người kiểm tra, ngày, phân loại);
- điểm đánh giá (đặt lại bằng điểm tiêu chuẩn), kết quả, nội dung vấn đề, ảnh;
- màu vàng đánh dấu dòng NG của lần kiểm tra cũ; tên người tạo file.
Thêm vài kiểu ô (chữ nhỏ hơn, căn trái) để app dùng khi một hạng mục có nhiều lỗi."""
import re, sys, zipfile

src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
files = {n: zin.read(n) for n in zin.namelist() if not n.endswith('/')}
sheet = files['xl/worksheets/sheet1.xml'].decode('utf-8')
sst = files['xl/sharedStrings.xml'].decode('utf-8')
styles = files['xl/styles.xml'].decode('utf-8')

FIRST, LAST = 8, 32          # dòng hạng mục 1..25
BASE_HT = {r: ('160.5' if r <= 13 else '127.5' if r <= 22 else '114') for r in range(FIRST, LAST + 1)}

def cell(ref, style, inner=''):
    return f'<c r="{ref}" s="{style}"{inner}' if inner.startswith(' ') else (f'<c r="{ref}" s="{style}"/>' if not inner else f'<c r="{ref}" s="{style}">{inner}</c>')

def fix_row(m):
    r = int(m.group(1)); attrs = m.group(2); body = m.group(3)
    if r in (2, 3, 4, 5):                      # thông tin đầu trang: xóa giá trị cột D
        body = re.sub(rf'<c r="D{r}" s="(\d+)"[^>]*>.*?</c>', lambda k: f'<c r="D{r}" s="{k.group(1)}"/>', body, flags=re.S)
        if r == 2:
            body = re.sub(r'(<c r="I2"[^>]*>.*?<v>)[^<]*(</v>)', r'\g<1>A\g<2>', body, flags=re.S)
    if FIRST <= r <= LAST:
        attrs = re.sub(r'ht="[\d.]+"', f'ht="{BASE_HT[r]}"', attrs)
        e = re.search(rf'<c r="E{r}" s="\d+"[^>]*><v>([\d.]+)</v></c>', body).group(1)
        body = re.sub(rf'<c r="E{r}" s="\d+"', f'<c r="E{r}" s="8"', body)
        body = re.sub(rf'<c r="F{r}"[^>]*>.*?</c>', f'<c r="F{r}" s="8"><v>{e}</v></c>', body, flags=re.S)
        body = re.sub(rf'<c r="G{r}"[^>]*?(/>|>.*?</c>)', f'<c r="G{r}" s="8"/>', body, flags=re.S)
        body = re.sub(rf'<c r="H{r}"[^>]*?(/>|>.*?</c>)', f'<c r="H{r}" s="8"/>', body, flags=re.S)
        body = re.sub(rf'<c r="D{r}" s="14"', f'<c r="D{r}" s="10"', body)   # bỏ nền vàng của lần cũ
        body = re.sub(rf'<c r="D{r}" s="17"', f'<c r="D{r}" s="16"', body)
    if r == 33:
        body = re.sub(r'(<c r="F33"[^>]*>.*?<v>)[^<]*(</v>)', r'\g<1>100\g<2>', body, flags=re.S)
    return f'<row r="{r}"{attrs}>{body}</row>'

sheet = re.sub(r'<row r="(\d+)"([^>]*)>(.*?)</row>', fix_row, sheet, flags=re.S)
sheet = re.sub(r'<selection [^>]*/>', '<selection activeCell="D2" sqref="D2"/>', sheet)

# chuỗi dùng chung: chỉ giữ chuỗi còn được dùng, đánh số lại
si = re.findall(r'<si>.*?</si>', sst, flags=re.S)
used = sorted({int(x) for x in re.findall(r't="s"><v>(\d+)</v>', sheet)})
remap = {old: new for new, old in enumerate(used)}
sheet = re.sub(r't="s"><v>(\d+)</v>', lambda m: f't="s"><v>{remap[int(m.group(1))]}</v>', sheet)
sst = re.sub(r'<sst [^>]*>.*</sst>', lambda m: f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(used)}" uniqueCount="{len(used)}">' + ''.join(si[i] for i in used) + '</sst>', sst, flags=re.S)

# kiểu ô bổ sung cho ô nội dung NG (nền vàng như file gốc):
#   21 = 18pt căn trái | 22 = 14pt căn giữa | 23 = 14pt căn trái | 24 = 11pt căn giữa | 25 = 11pt căn trái
nf = int(re.search(r'<fonts count="(\d+)"', styles).group(1))
styles = styles.replace(f'<fonts count="{nf}"', f'<fonts count="{nf + 2}"')
styles = styles.replace('</fonts>', '<font><sz val="14"/><color rgb="FF000000"/><name val="Arial"/><charset val="134"/></font><font><sz val="11"/><color rgb="FF000000"/><name val="Arial"/><charset val="134"/></font></fonts>')
nx = int(re.search(r'<cellXfs count="(\d+)"', styles).group(1))
assert nx == 21, nx
xf = lambda font, al: f'<xf numFmtId="0" fontId="{font}" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="{al}" vertical="center" wrapText="1"/></xf>'
styles = styles.replace('<cellXfs count="21"', '<cellXfs count="26"').replace('</cellXfs>', xf(5, 'left') + xf(nf, 'center') + xf(nf, 'left') + xf(nf + 1, 'center') + xf(nf + 1, 'left') + '</cellXfs>')

files['xl/worksheets/sheet1.xml'] = sheet.encode('utf-8')
files['xl/sharedStrings.xml'] = sst.encode('utf-8')
files['xl/styles.xml'] = styles.encode('utf-8')
files['xl/drawings/drawing1.xml'] = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>').encode()
files['xl/drawings/_rels/drawing1.xml.rels'] = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>').encode()
ct = files['[Content_Types].xml'].decode('utf-8')
if 'Extension="jpeg"' not in ct:
    ct = ct.replace('<Default Extension="png"', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png"')
files['[Content_Types].xml'] = ct.encode('utf-8')
core = files['docProps/core.xml'].decode('utf-8')
core = re.sub(r'<dc:creator>.*?</dc:creator>', '<dc:creator>Audit PCCC</dc:creator>', core)
core = re.sub(r'<cp:lastModifiedBy>.*?</cp:lastModifiedBy>', '<cp:lastModifiedBy>Audit PCCC</cp:lastModifiedBy>', core)
files['docProps/core.xml'] = core.encode('utf-8')
wb = files['xl/workbook.xml'].decode('utf-8')
wb = re.sub(r'<calcPr [^>]*/>', '<calcPr calcId="191029" fullCalcOnLoad="1"/>', wb)
files['xl/workbook.xml'] = wb.encode('utf-8')

with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
    order = ['[Content_Types].xml'] + [n for n in files if n != '[Content_Types].xml' and not n.startswith('xl/media/')]
    for n in order:
        z.writestr(n, files[n])
print('OK', dst, f'{len(used)} chuỗi, bỏ {sum(1 for n in files if n.startswith("xl/media/"))} ảnh')
