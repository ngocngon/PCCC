#!/usr/bin/env python3
"""Nạp danh mục PCCC và mẫu checklist vào mã nguồn app (dòng `const RBA=...`).

    python3 nap_danh_muc.py            # dùng đường dẫn mặc định trong gói mã nguồn

Nguồn:
- 5-mau-checklist-pccc/mau-checklist-pccc.xlsx : tên 25 hạng mục, phân loại, điểm tiêu chuẩn (đọc nguyên văn);
  chính file này cũng được nhúng vào app để điền khi xuất.
- 5-mau-checklist-pccc/danh-muc-pccc.json      : lỗi điển hình, dấu hiệu, từ khóa, căn cứ tham khảo.
build.py tự chạy file này trước khi đóng gói."""
import base64, html, json, pathlib, re, sys, zipfile

SRC = pathlib.Path(__file__).resolve().parents[2]
TPL = SRC / '5-mau-checklist-pccc' / 'mau-checklist-pccc.xlsx'
CAT = SRC / '5-mau-checklist-pccc' / 'danh-muc-pccc.json'
APP = SRC / '1-ma-nguon-app' / 'soat-anh-pccc.html'
LAYF = SRC / '5-mau-checklist-pccc' / 'bo-cuc-mau.json'   # do chuan_bi_mau.py tạo
LAY = json.loads(LAYF.read_text(encoding='utf-8'))
ROWS = {int(k): v for k, v in LAY['rows'].items()}
COL = LAY['col']
FIRST, LAST = min(ROWS.values()), max(ROWS.values())

z = zipfile.ZipFile(TPL)
sst = z.read('xl/sharedStrings.xml').decode('utf-8')
sheet = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
strings = [html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', s, flags=re.S))) for s in re.findall(r'<si>(.*?)</si>', sst, flags=re.S)]

def val(ref):
    m = re.search(rf'<c r="{ref}"([^>]*?)(?:/>|>(.*?)</c>)', sheet, flags=re.S)
    if not m or m.group(2) is None: return ''
    v = re.search(r'<v>(.*?)</v>', m.group(2), flags=re.S)
    if not v: return ''
    return strings[int(v.group(1))] if 't="s"' in m.group(1) else v.group(1)

cat = json.loads(CAT.read_text(encoding='utf-8'))
codes, order, grp = {}, [], None
for no in range(1, 26):
    r = ROWS[no]; assert int(float(val(f"{COL['no']}{r}"))) == no, (r, no)
    c = val(f"{COL['grp']}{r}")
    if c:
        ls = [x.strip() for x in c.split('\n') if x.strip()]
        ko = ' '.join(x for x in ls if re.search(r'[가-힣]', x) and not re.search(r'\d+점', x))
        vi = ' '.join(x for x in ls if not re.search(r'[가-힣]', x))
        cand = {'ko': ko, 'vi': re.sub(r'\s+', ' ', vi).strip()}
        if not grp or cand['vi'] != grp['vi']: grp = cand
    d = val(f"{COL['desc']}{r}").strip().split('\n', 1)
    ko, vi = (d[0].strip(), d[1].strip()) if len(d) == 2 else ('', d[0].strip())
    pts = int(float(val(f"{COL['std']}{r}")))
    meta = cat['items'][str(no)]
    code = f'HM{no:03d}'
    codes[code] = {'no': no, 'row': r, 'g': grp['vi'], 'gk': grp['ko'], 't': meta['short'], 'vi': vi, 'ko': ko, 'pts': pts, 'doc': bool(meta.get('doc')),
                   's': {'C': pts, 'Mi': 0, 'Ma': 0, 'P': 0}, 'r': [[f'HM {no}', vi]], 'l': [[f'{no:02d}. {meta["short"].upper()}', meta['law']]]}
    order.append(code)
assert sum(codes[c]['pts'] for c in order) == 100, 'Tổng điểm tiêu chuẩn phải bằng 100'
m0 = cat['items']['0']
codes['EH000'] = {'no': 0, 'row': 0, 'g': 'Ngoài checklist', 'gk': '체크리스트 외', 't': m0['short'], 'vi': 'Lỗi EHS nguy hiểm khác, không thuộc 25 hạng mục phòng cháy chữa cháy (ghi riêng, không trừ điểm)', 'ko': '기타 중대 EHS 위험 (점수 미반영)', 'pts': 0, 'doc': False,
                   's': {'C': 0, 'Mi': 0, 'Ma': 0, 'P': 0}, 'r': [['EHS khác', 'Mối nguy EHS lớn ngoài phạm vi checklist PCCC']], 'l': [['00. EHS NGUY HIỂM KHÁC', m0['law']]]}

rules, seen = [], set()
for r in cat['rules']:
    assert r['id'] not in seen, r['id']; seen.add(r['id'])
    assert r['v'] in ('Priority', 'Major', 'Minor') and r['z'] in ('Facility', 'Administrative') and r['kd'] in ('violation', 'hazard'), r['id']
    code = f"HM{r['hm']:03d}" if r['hm'] else 'EH000'
    info = codes[code]
    for g in r.get('kw', []): re.compile(g.lstrip('!'))
    rules.append({'id': r['id'], 'g': f"{info['g']}" if r['hm'] else 'EHS nguy hiểm khác (không tính điểm)', 't': r['t'], 'k': r['k'], 'c': code, 'q': info['r'][0][0],
                  'l': [[code, f"{info['no']:02d}", info['l'][0][1]]], 'v': r['v'], 'n': r['n'], 'x': r['x'], 'o': 'g', 'z': r['z'], 'kd': r['kd'], 'kw': r.get('kw', [])})
miss = [c for c in order if not any(r['c'] == c for r in rules)]
assert not miss, f'Hạng mục chưa có lỗi mẫu: {miss}'

data = {'codes': codes, 'order': order, 'rules': rules, 'tpl': {'map': {}, 'first': FIRST, 'last': LAST, 'lay': LAY, 'b64': base64.b64encode(TPL.read_bytes()).decode()}}
line = 'const RBA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';'
s = APP.read_text(encoding='utf-8')
n1 = len(re.findall(r'^const RBA=.*$', s, flags=re.M)); assert n1 == 1, n1
s = re.sub(r'^const RBA=.*$', lambda m: line, s, flags=re.M)
s = re.sub(r'^const GUIDER_B64=.*$', 'const GUIDER_B64="";', s, flags=re.M)
APP.write_text(s, encoding='utf-8')
print(f'OK danh mục: {len(order)} hạng mục, {len(rules)} lỗi mẫu, mẫu checklist {TPL.stat().st_size} byte')
