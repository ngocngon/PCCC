"""So file checklist xuất ra với mẫu trống của app (bố cục đọc từ bo-cuc-mau.json).

    python3 kiem-tra-file-xuat.py <mau-checklist-pccc.xlsx> <file-xuat.xlsx> [bo-cuc-mau.json]

Đạt khi:
- mọi ô của mẫu còn nguyên; chỉ các ô được phép điền thay đổi (thông tin đầu trang, điểm đánh giá,
  kết quả, nội dung NG của 25 hạng mục; giá trị lưu sẵn của ô tổng điểm và ô xếp hạng);
- công thức, ô gộp, ngắt trang, khổ in, độ rộng cột, kiểu ô (styles.xml) không đổi;
- 25 hàng hạng mục có customHeight="1", không thấp hơn chiều cao của mẫu;
- điểm/kết quả/nội dung khớp quy tắc (NG = 0 điểm + có nội dung; OK = đủ điểm + không nội dung);
- ảnh: cùng một kích thước, nằm trọn trong ô hình ảnh của đúng dòng, khối ảnh căn giữa ô (lệch ≤ 2 px), có lề."""
import sys, re, zipfile, html, json, pathlib
tpl, out = sys.argv[1], sys.argv[2]
LAY = json.loads(pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else pathlib.Path(__file__).resolve().parents[1] / '5-mau-checklist-pccc' / 'bo-cuc-mau.json').read_text(encoding='utf-8'))
C, ROWS = LAY['col'], {int(k): v for k, v in LAY['rows'].items()}
def cells(p):
    z = zipfile.ZipFile(p); s = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    sst = [html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', x, flags=re.S))) for x in re.findall(r'<si>(.*?)</si>', z.read('xl/sharedStrings.xml').decode('utf-8'), flags=re.S)]
    d = {}
    for m in re.finditer(r'<c r="([A-Z]+\d+)"([^>/]*)(?:/>|>(.*?)</c>)', s, flags=re.S):
        ref, at, body = m.group(1), m.group(2), m.group(3) or ''
        f = re.search(r'<f[^>]*>(.*?)</f>', body, flags=re.S); v = re.search(r'<v>(.*?)</v>', body, flags=re.S); t = re.search(r'<is>(.*?)</is>', body, flags=re.S)
        val = sst[int(v.group(1))] if (v and 't="s"' in at) else (html.unescape(re.sub('<[^>]+>', '', t.group(1))) if t else (v.group(1) if v else ''))
        d[ref] = (re.search(r's="(\d+)"', at).group(1) if 's="' in at else '', f.group(1) if f else '', val)
    return d, s, z
a, sa, za = cells(tpl); b, sb, zb = cells(out)
bad = []
miss = sorted(set(a) - set(b)); extra = sorted(set(b) - set(a))
if miss: bad.append(f'thiếu ô: {miss}')
IC = LAY['imgCols']
extra = [x for x in extra if re.sub(r'\d', '', x) not in IC[1:]]   # ô ở các cột ảnh thêm là hợp lệ
if extra: bad.append(f'thừa ô: {extra}')
editable = set(LAY['info'].values()) | {LAY['grade'], LAY['total']['score']}
for r in ROWS.values(): editable |= {f"{C['score']}{r}", f"{C['res']}{r}", f"{C['text']}{r}"}
for ref in a:
    if ref not in b: continue
    if a[ref][1] != b[ref][1]: bad.append(f'{ref} đổi công thức')
    if ref in editable: continue
    if a[ref] != b[ref]: bad.append(f'{ref} đổi: {a[ref]} -> {b[ref]}')
psA = re.search(r'<pageSetup[^>]*>', sa).group(0); psB = re.search(r'<pageSetup[^>]*>', sb).group(0)
scA = int((re.search(r'scale="(\d+)"', psA) or [0, 100])[1]); scB = int((re.search(r'scale="(\d+)"', psB) or [0, 100])[1])
if re.sub(r'\s*scale="\d+"', '', psA) != re.sub(r'\s*scale="\d+"', '', psB) or scB > scA: bad.append(f'khổ in đổi: {psA} -> {psB}')
def cols(sx):
    d = {}
    for m in re.finditer(r'<col min="(\d+)" max="(\d+)" width="([\d.]+)"([^>]*)/>', sx):
        for k in range(int(m.group(1)), min(int(m.group(2)), 60) + 1): d[k] = (float(m.group(3)), 'hidden' in m.group(4))
    return d
def cn(c):
    n = 0
    for ch in c: n = n * 26 + ord(ch) - 64
    return n
ca, cb = cols(sa), cols(sb); xcols = {cn(c) for c in IC[1:]}
for k in ca:
    if k not in xcols and ca[k] != cb.get(k): bad.append(f'cột {k} đổi: {ca[k]} -> {cb.get(k)}')
ma, mb = set(re.findall(r'<mergeCell ref="([^"]+)"', sa)), set(re.findall(r'<mergeCell ref="([^"]+)"', sb))
if ma - mb: bad.append(f'mất ô gộp {ma - mb}')
if any(not x.startswith(f"{IC[0]}{LAY['hdrRow']}:") for x in mb - ma): bad.append(f'thêm ô gộp lạ {mb - ma}')
if re.findall(r'<brk id="(\d+)"', sa) != re.findall(r'<brk id="(\d+)"', sb): bad.append('ngắt trang đổi')
if re.search(r'<pageMargins[^>]*>', sa).group(0) != re.search(r'<pageMargins[^>]*>', sb).group(0): bad.append('lề in đổi')
if za.read('xl/styles.xml') != zb.read('xl/styles.xml'): bad.append('styles.xml đổi')
rowpt = {}
for r in ROWS.values():
    m = re.search(rf'<row r="{r}"[^>]*>', sb).group(0); rowpt[r] = float(re.search(r'ht="([\d.]+)"', m).group(1))
    if 'customHeight="1"' not in m: bad.append(f'dòng {r}: thiếu customHeight="1"')
    if rowpt[r] + .01 < LAY['ht'][str(r)]: bad.append(f'dòng {r}: thấp hơn mẫu ({rowpt[r]} < {LAY["ht"][str(r)]})')
val = lambda ref: b.get(ref, ('', '', ''))[2]
tot = sum(float(val(f"{C['score']}{r}")) for r in ROWS.values())
if float(val(LAY['total']['score'])) != tot: bad.append(f"{LAY['total']['score']} lưu {val(LAY['total']['score'])} khác tổng {tot}")
g = 'D' if tot < 70 else 'C' if tot < 80 else 'B' if tot < 90 else 'A'
if val(LAY['grade']) != g: bad.append(f"{LAY['grade']} lưu {val(LAY['grade'])} khác hạng {g}")
ng = 0
for no, r in ROWS.items():
    e, f, gg, h = float(val(f"{C['std']}{r}")), float(val(f"{C['score']}{r}")), val(f"{C['res']}{r}"), val(f"{C['text']}{r}")
    if gg == 'NG':
        ng += 1
        if f != 0 or not h: bad.append(f'HM {no} (dòng {r}): NG nhưng điểm {f} hoặc thiếu nội dung')
    elif gg == 'OK':
        if f != e or h: bad.append(f'HM {no} (dòng {r}): OK nhưng điểm {f}/{e} hoặc có nội dung')
    else: bad.append(f'HM {no} (dòng {r}): kết quả {gg!r}')
# --- ảnh ---
dr = zb.read('xl/drawings/drawing1.xml').decode()
nimg = len([n for n in zb.namelist() if n.startswith('xl/media/')]); nrel = zb.read('xl/drawings/_rels/drawing1.xml.rels').decode().count('<Relationship ')
anc = re.findall(r'<xdr:oneCellAnchor><xdr:from><xdr:col>(\d+)</xdr:col><xdr:colOff>(\d+)</xdr:colOff><xdr:row>(\d+)</xdr:row><xdr:rowOff>(\d+)</xdr:rowOff></xdr:from><xdr:ext cx="(\d+)" cy="(\d+)"/>', dr)
if not (nimg == nrel == len(anc)): bad.append(f'ảnh {nimg}, quan hệ {nrel}, neo {len(anc)}')
E, colpx = 9525, LAY['px']['img']
if len({(cx, cy) for *_, cx, cy in anc}) > 1: bad.append('ảnh không cùng kích thước')
seen = set()
for c, x, r, y, cx, cy in anc:
    c, x, r, y, w, h = int(c) + 1, int(x) / E, int(r) + 1, int(y) / E, int(cx) / E, int(cy) / E
    if abs(w / h - 16 / 9) > .02: bad.append(f'ảnh dòng {r} không đúng tỷ lệ 16:9 ({w:.0f}x{h:.0f})')
    if c not in [cn(k) for k in IC]: bad.append(f'ảnh ở cột {c} không phải cột ảnh'); continue
    if (c, r) in seen: bad.append(f'ô cột {c} dòng {r} có hơn một ảnh')
    seen.add((c, r))
    if r not in rowpt: bad.append(f'ảnh ở dòng {r} không phải dòng hạng mục'); continue
    cp = colpx if c == cn(IC[0]) else int(cb[c][0] * 7 + 5); rp = rowpt[r] * 4 / 3
    if x < 2 or y < 2 or x + w > cp - 2 or y + h > rp - 2: bad.append(f'ảnh dòng {r} cột {c} chạm/tràn viền ô ({x:.0f},{y:.0f},{w:.0f}x{h:.0f} trong {cp}x{rp:.0f})')
    if abs(x - (cp - x - w)) > 2 or abs(y - (rp - y - h)) > 2: bad.append(f'ảnh dòng {r} cột {c} chưa căn giữa (trái {x:.0f}/phải {cp-x-w:.0f}, trên {y:.0f}/dưới {rp-y-h:.0f})')
# các cột ảnh của một dòng phải dùng liên tục từ cột đầu
for r in {r for _, r in seen}:
    used = sorted(c for c, rr in seen if rr == r)
    if used != [cn(k) for k in IC[:len(used)]]: bad.append(f'dòng {r}: ảnh không xếp liên tục từ cột hình ảnh')
size = f'{anc[0][4] and int(anc[0][4])//E}x{int(anc[0][5])//E}' if anc else '-'
print(f'điểm {tot:g} hạng {g}; NG {ng}; ảnh {nimg} ({size} px); tỷ lệ in {scB}% (mẫu {scA}%); đầu trang: {[val(x) for x in LAY["info"].values()]}')
print('ĐẠT' if not bad else 'LỖI:\n' + '\n'.join(bad)); sys.exit(1 if bad else 0)
