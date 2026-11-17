"""So file checklist xuất ra với mẫu: mọi ô của mẫu phải còn, cột B-E và công thức không đổi."""
import sys, re, zipfile, html
tpl, out = sys.argv[1], sys.argv[2]
def cells(p):
    z = zipfile.ZipFile(p); s = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    sst = [html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', x, flags=re.S))) for x in re.findall(r'<si>(.*?)</si>', z.read('xl/sharedStrings.xml').decode('utf-8'), flags=re.S)]
    d = {}
    for m in re.finditer(r'<c r="([A-Z]+\d+)"([^>/]*)(?:/>|>(.*?)</c>)', s, flags=re.S):
        ref, at, body = m.group(1), m.group(2), m.group(3) or ''
        f = re.search(r'<f>(.*?)</f>', body, flags=re.S); v = re.search(r'<v>(.*?)</v>', body, flags=re.S); t = re.search(r'<is>(.*?)</is>', body, flags=re.S)
        val = sst[int(v.group(1))] if (v and 't="s"' in at) else (html.unescape(re.sub('<[^>]+>', '', t.group(1))) if t else (v.group(1) if v else ''))
        d[ref] = (re.search(r's="(\d+)"', at).group(1) if 's="' in at else '', f.group(1) if f else '', val)
    return d, s, z
a, sa, za = cells(tpl); b, sb, zb = cells(out)
bad = []
miss = sorted(set(a) - set(b)); extra = sorted(set(b) - set(a))
if miss: bad.append(f'thiếu ô: {miss}')
if extra: bad.append(f'thừa ô: {extra}')
for ref in a:
    if ref not in b: continue
    col = re.match(r'[A-Z]+', ref).group(0); row = int(ref[len(col):])
    fixed = col in 'BCEK' or (col == 'D' and row >= 7) or row in (7,) or (col in 'EFGH' and row <= 5) or (row == 33 and col != 'F')
    if fixed and a[ref] != b[ref]: bad.append(f'{ref} đổi: {a[ref]} -> {b[ref]}')
    if a[ref][1] != b[ref][1]: bad.append(f'{ref} đổi công thức')
# v1.0.7: chỉ cho phép đổi độ rộng cột H, I (nội dung, hình ảnh) và cách in vừa trang; các cột khác giữ nguyên
colsA = re.findall(r'<col [^>]*/>', sa); colsB = re.findall(r'<col [^>]*/>', sb)
strip = lambda c: re.sub(r'width="[\d.]+"', '', c) if re.search(r'min="(8|9)"', c) else c
if [strip(c) for c in colsA] != [strip(c) for c in colsB]: bad.append('cột đổi ngoài H, I')
ps = re.search(r'<pageSetup[^>]*>', sb)
if not ps or 'landscape' not in ps.group(0) or 'paperSize="9"' not in ps.group(0): bad.append('khổ in đổi')
for r in range(8, 33):
    m = re.search(rf'<row r="{r}"[^>]*>', sb).group(0)
    if 'customHeight="1"' not in m: bad.append(f'dòng {r}: thiếu customHeight="1"')
for k in ('<mergeCells', '<dataValidations', '<rowBreaks'):
    x = lambda s: re.search(re.escape(k) + r'.*?(?:/>|</' + k[1:].split(' ')[0].rstrip('>') + '>)', s, flags=re.S)
    if x(sa) and x(sa).group(0) != (x(sb).group(0) if x(sb) else None): bad.append(f'{k} đổi')
if za.read('xl/styles.xml') != zb.read('xl/styles.xml'): bad.append('styles.xml đổi')
tot = sum(float(b[f'F{r}'][2]) for r in range(8, 33)); 
if float(b['F33'][2]) != tot: bad.append(f'F33 lưu {b["F33"][2]} khác tổng {tot}')
g = 'D' if tot < 70 else 'C' if tot < 80 else 'B' if tot < 90 else 'A'
if b['I2'][2] != g: bad.append(f'I2 lưu {b["I2"][2]} khác hạng {g}')
for r in range(8, 33):
    e, f, gg, h = float(b[f'E{r}'][2]), float(b[f'F{r}'][2]), b[f'G{r}'][2], b[f'H{r}'][2]
    if gg == 'NG' and (f != 0 or not h): bad.append(f'dòng {r}: NG nhưng điểm {f} hoặc thiếu nội dung')
    if gg == 'OK' and (f != e or h): bad.append(f'dòng {r}: OK nhưng điểm {f}/{e} hoặc có nội dung')
    if gg not in ('OK', 'NG'): bad.append(f'dòng {r}: kết quả {gg!r}')
nimg = len([n for n in zb.namelist() if n.startswith('xl/media/')]); nrel = zb.read('xl/drawings/_rels/drawing1.xml.rels').decode().count('<Relationship '); nanc = zb.read('xl/drawings/drawing1.xml').decode().count('<xdr:oneCellAnchor>')
if not (nimg == nrel == nanc): bad.append(f'ảnh {nimg}, quan hệ {nrel}, neo {nanc}')
print(f'điểm {tot:g} hạng {g}; NG {sum(1 for r in range(8,33) if b[f"G{r}"][2]=="NG")}; ảnh {nimg}; đầu trang: {[b[f"D{r}"][2] for r in (2,3,4,5)]}')
print('ĐẠT' if not bad else 'LỖI:\n' + '\n'.join(bad)); sys.exit(1 if bad else 0)
