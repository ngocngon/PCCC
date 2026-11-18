#!/usr/bin/env python3
"""Chuẩn bị file checklist PCCC MẪU CỦA CÔNG TY để nhúng vào app, và đọc bố cục của nó.

    python3 chuan_bi_mau.py <file-mau-cong-ty.xlsx>
    (mặc định: 5-mau-checklist-pccc/goc/mau-cong-ty.xlsx)

Kết quả:
- 5-mau-checklist-pccc/mau-checklist-pccc.xlsx : mẫu trống app dùng để điền khi xuất;
- 5-mau-checklist-pccc/bo-cuc-mau.json          : bố cục đọc tự động từ mẫu (dòng của 25 hạng mục,
  cột điểm/kết quả/nội dung/hình ảnh, ô thông tin đầu trang, ô tổng điểm, ô xếp hạng, chiều cao hàng,
  độ rộng cột, kiểu ô dùng cho dòng NG).

KHÔNG đổi: hạng mục, phân loại, điểm tiêu chuẩn, công thức, ô gộp, độ rộng cột, chiều cao hàng, ngắt trang, khổ in.
Chỉ làm:
- xóa dữ liệu lần kiểm tra cũ (thông tin đầu trang, điểm đánh giá, kết quả, nội dung, ảnh);
- sửa thuộc tính customHeight cho hợp lệ (="1") để Excel không tự co giãn hàng;
- bỏ bộ nhớ đệm công thức (calcChain) và bật tính lại khi mở file;
- thêm phần khai báo ảnh (drawing) và vài kiểu ô nền vàng cho dòng NG (chữ 18/14/11, căn giữa/căn trái)."""
import html, json, pathlib, re, sys, zipfile

SRC = pathlib.Path(__file__).resolve().parents[2]
DIR = SRC / '5-mau-checklist-pccc'
IN = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DIR / 'goc' / 'mau-cong-ty.xlsx'
OUT, LAY = DIR / 'mau-checklist-pccc.xlsx', DIR / 'bo-cuc-mau.json'

zin = zipfile.ZipFile(IN)
files = {n: zin.read(n) for n in zin.namelist() if not n.endswith('/')}
sheet = files['xl/worksheets/sheet1.xml'].decode('utf-8')
sst = files['xl/sharedStrings.xml'].decode('utf-8')
styles = files['xl/styles.xml'].decode('utf-8')
strings = [html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', s, flags=re.S))) for s in re.findall(r'<si>(.*?)</si>', sst, flags=re.S)]
norm = lambda t: re.sub(r'\s+', ' ', t or '').strip().lower()

def col2n(c): n = 0; [n := n * 26 + ord(ch) - 64 for ch in c]; return n
def n2col(n): s = '';
def n2col(n):
    s = ''
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s

def cells():
    out = {}
    for m in re.finditer(r'<c r="([A-Z]+)(\d+)"([^>]*?)(?:/>|>(.*?)</c>)', sheet, flags=re.S):
        c, r, attrs, inner = m.group(1), int(m.group(2)), m.group(3), m.group(4) or ''
        v = re.search(r'<v>(.*?)</v>', inner, flags=re.S); f = re.search(r'<f[^>]*>(.*?)</f>', inner, flags=re.S)
        val = v.group(1) if v else ''
        if 't="s"' in attrs and v: val = strings[int(val)]
        st = re.search(r's="(\d+)"', attrs)
        out[(c, r)] = {'v': val, 'f': html.unescape(f.group(1)) if f else '', 's': int(st.group(1)) if st else 0}
    return out
C = cells()
get = lambda c, r: C.get((c, r), {}).get('v', '')

# --- dòng tiêu đề bảng và các cột ---
hdr_rows = sorted({r for (c, r), x in C.items() if norm(x['v']) == 'no'})
assert hdr_rows, 'Không thấy dòng tiêu đề (ô "No")'
H = hdr_rows[0]
no_col = next(c for (c, r), x in C.items() if r == H and norm(x['v']) == 'no')
def find_col(*keys):
    for (c, r), x in sorted(C.items(), key=lambda k: col2n(k[0][0])):
        if r == H and any(k in norm(x['v']) for k in keys): return c
    raise SystemExit(f'Không thấy cột: {keys}')
col = {'no': no_col, 'grp': find_col('phân loại'), 'desc': find_col('hạng mục kiểm tra'), 'std': find_col('điểm tiêu chuẩn'),
       'score': find_col('điểm đánh giá'), 'res': find_col('kết quả'), 'text': find_col('nội dung'), 'img': find_col('hình ảnh')}

# --- dòng của 25 hạng mục, dòng tổng ---
rows = {}
for (c, r), x in C.items():
    if c == no_col and re.fullmatch(r'\d+(\.0)?', x['v'] or '') and r > H: rows[int(float(x['v']))] = r
assert sorted(rows) == list(range(1, 26)), f'Phải có đủ 25 hạng mục, đang có {sorted(rows)}'
tot_row = next(r for (c, r), x in C.items() if c == no_col and norm(x['v']) == 'sum')

# --- ô thông tin đầu trang: ô ngay bên phải nhãn (tính cả ô gộp) ---
merges = [m for m in re.findall(r'<mergeCell ref="([A-Z]+\d+:[A-Z]+\d+)"', sheet)]
def right_of(c, r):
    end = c
    for m in merges:
        a, b = m.split(':'); ca, ra = re.match(r'([A-Z]+)(\d+)', a).groups(); cb, rb = re.match(r'([A-Z]+)(\d+)', b).groups()
        if ca == c and int(ra) == r: end = cb
    return n2col(col2n(end) + 1) + str(r)
info = {}
for (c, r), x in C.items():
    t = norm(x['v'])
    if r >= H: continue
    for k, key in (('unit', 'tên công ty'), ('who', 'người kiểm tra'), ('date', 'ngày kiểm tra'), ('sub', 'phân loại')):
        if key in t: info[k] = right_of(c, r)
assert len(info) == 4, f'Thiếu ô thông tin đầu trang: {info}'
grade = next(f'{c}{r}' for (c, r), x in C.items() if x['f'] and '"A"' in x['f'] and 'IF' in x['f'].upper())

# --- chiều cao hàng, độ rộng cột ---
ht = {}
for m in re.finditer(r'<row r="(\d+)"([^>]*)>', sheet):
    h = re.search(r'ht="([\d.]+)"', m.group(2))
    if h: ht[int(m.group(1))] = float(h.group(1))
widths = {}
for m in re.finditer(r'<col min="(\d+)" max="(\d+)" width="([\d.]+)"', sheet):
    for i in range(int(m.group(1)), int(m.group(2)) + 1): widths[i] = float(m.group(3))
px = lambda c: round(widths.get(col2n(c), 8.43) * 7)

# --- làm sạch ---
item_rows = set(rows.values())
std = {r: get(col['std'], r) for r in item_rows}
def setv(body, ref, v):
    """Đặt giá trị số (hoặc xóa nếu v is None), giữ nguyên kiểu ô."""
    rx = re.compile(rf'<c r="{ref}"([^>]*?)(?:/>|>.*?</c>)', re.S)
    def f(m):
        a = re.sub(r'\s*t="\w+"', '', m.group(1))
        return f'<c r="{ref}"{a}/>' if v is None else f'<c r="{ref}"{a}><v>{v}</v></c>'
    return rx.sub(f, body)
def fix_row(m):
    r, attrs, body = int(m.group(1)), m.group(2), m.group(3)
    attrs = re.sub(r'customHeight="[^"]*"', 'customHeight="1"', attrs)
    for k, ref in info.items():
        if int(re.sub(r'\D', '', ref)) == r: body = setv(body, ref, None)
    if r in item_rows:
        body = setv(body, f"{col['score']}{r}", std[r])
        for k in ('res', 'text', 'img'): body = setv(body, f"{col[k]}{r}", None)
    return f'<row r="{r}"{attrs}>{body}</row>'
sheet = re.sub(r'<row r="(\d+)"([^>]*)>(.*?)</row>', fix_row, sheet, flags=re.S)
sheet = re.sub(rf'(<c r="{col["score"]}{tot_row}"[^>]*>.*?<v>)[^<]*(</v>)', r'\g<1>100\g<2>', sheet, flags=re.S)
sheet = re.sub(rf'(<c r="{grade}"[^>]*>.*?<v>)[^<]*(</v>)', r'\g<1>A\g<2>', sheet, flags=re.S)
sheet = re.sub(r'<selection [^>]*/>', f'<selection activeCell="{info["unit"]}" sqref="{info["unit"]}"/>', sheet)

# --- khai báo ảnh (drawing) ---
rels = files['xl/worksheets/_rels/sheet1.xml.rels'].decode('utf-8') if 'xl/worksheets/_rels/sheet1.xml.rels' in files else '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
if 'relationships/drawing' not in rels:
    ids = [int(x) for x in re.findall(r'Id="rId(\d+)"', rels)]; rid = f'rId{max(ids + [0]) + 1}'
    rels = rels.replace('</Relationships>', f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>')
    tail = re.search(r'(<legacyDrawing|<legacyDrawingHF|<picture|<oleObjects|<controls|<webPublishItems|<tableParts|<extLst|</worksheet>)', sheet)
    sheet = sheet[:tail.start()] + f'<drawing r:id="{rid}"/>' + sheet[tail.start():]
files['xl/worksheets/_rels/sheet1.xml.rels'] = rels.encode()
ct = files['[Content_Types].xml'].decode('utf-8')
if 'Extension="jpeg"' not in ct: ct = ct.replace('<Default ', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ', 1)
if '/xl/drawings/drawing1.xml' not in ct: ct = ct.replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>')
ct = ct.replace('<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/>', '')
files['[Content_Types].xml'] = ct.encode()
files['xl/drawings/drawing1.xml'] = b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"></xdr:wsDr>'
files['xl/drawings/_rels/drawing1.xml.rels'] = b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
files.pop('xl/calcChain.xml', None)
wr = files['xl/_rels/workbook.xml.rels'].decode('utf-8')
files['xl/_rels/workbook.xml.rels'] = re.sub(r'<Relationship [^>]*calcChain[^>]*/>', '', wr).encode()
wb = files['xl/workbook.xml'].decode('utf-8')
wb = re.sub(r'<calcPr([^>]*?)/>', lambda m: '<calcPr' + re.sub(r'\s*fullCalcOnLoad="\w+"', '', m.group(1)) + ' fullCalcOnLoad="1"/>', wb) if '<calcPr' in wb else wb.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>')
files['xl/workbook.xml'] = wb.encode()

# --- kiểu ô nền vàng cho dòng NG ---
base = C[(col['score'], rows[1])]['s']            # kiểu ô điểm của dòng hạng mục 1
xfs = re.search(r'<cellXfs count="(\d+)">(.*?)</cellXfs>', styles, flags=re.S)
xl = re.findall(r'<xf [^>]*?(?:/>|>.*?</xf>)', xfs.group(2), flags=re.S)
bx = xl[base]; border = re.search(r'borderId="(\d+)"', bx).group(1); font0 = re.search(r'fontId="(\d+)"', bx).group(1)
nf = int(re.search(r'<fonts count="(\d+)"', styles).group(1)); nfi = int(re.search(r'<fills count="(\d+)"', styles).group(1))
styles = styles.replace(f'<fonts count="{nf}"', f'<fonts count="{nf + 3}"', 1).replace('</fonts>', '<font><sz val="18"/><color rgb="FF000000"/><name val="Arial"/><family val="2"/></font><font><sz val="14"/><color rgb="FF000000"/><name val="Arial"/><family val="2"/></font><font><sz val="11"/><color rgb="FF000000"/><name val="Arial"/><family val="2"/></font></fonts>', 1)
styles = styles.replace(f'<fills count="{nfi}"', f'<fills count="{nfi + 1}"', 1).replace('</fills>', '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill></fills>', 1)
F18, F14, F11, Y = nf, nf + 1, nf + 2, nfi
def xf(font, h): return f'<xf numFmtId="0" fontId="{font}" fillId="{Y}" borderId="{border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="{h}" vertical="center" wrapText="1"/></xf>'
add = [('ng', F18, 'center'), ('c18', F18, 'center'), ('l18', F18, 'left'), ('c14', F14, 'center'), ('l14', F14, 'left'), ('c11', F11, 'center'), ('l11', F11, 'left')]
n0 = int(xfs.group(1))
styles = styles.replace(xfs.group(0), f'<cellXfs count="{n0 + len(add)}">' + xfs.group(2) + ''.join(xf(f, h) for _, f, h in add) + '</cellXfs>', 1)
st = {k: n0 + i for i, (k, _, _) in enumerate(add)}
files['xl/styles.xml'] = styles.encode()
files['xl/worksheets/sheet1.xml'] = sheet.encode()

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for n in ['[Content_Types].xml'] + [k for k in files if k != '[Content_Types].xml']: z.writestr(n, files[n])

lay = {'hdr': hdr_rows, 'col': col, 'rows': {str(k): v for k, v in sorted(rows.items())}, 'total': {'row': tot_row, 'score': f"{col['score']}{tot_row}", 'std': f"{col['std']}{tot_row}"},
       'grade': grade, 'info': info, 'ht': {str(r): ht.get(r, 15) for r in sorted(item_rows)}, 'px': {'text': px(col['text']), 'img': px(col['img'])},
       'imgCol0': col2n(col['img']) - 1, 'st': st}
LAY.write_text(json.dumps(lay, ensure_ascii=False, indent=1), encoding='utf-8')
print('OK mẫu:', OUT.name, '| cột', col, '| dòng hạng mục', min(rows.values()), '…', max(rows.values()), '| tiêu đề lặp', hdr_rows, '| tổng', lay['total'], '| hạng', grade, '| thông tin', info, '| px', lay['px'])
