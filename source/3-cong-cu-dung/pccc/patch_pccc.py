#!/usr/bin/env python3
"""Gắn lớp Audit PCCC (chấm điểm 25 hạng mục, xuất checklist .xlsx, PDF báo cáo nhanh) vào bản dựng.
Chạy SAU patch_pwa.py, patch_cloud.py và patch_ai.py:  python3 patch_pccc.py <index.html>"""
import pathlib, sys
here = pathlib.Path(__file__).resolve().parent
f = pathlib.Path(sys.argv[1]); s = f.read_text(encoding='utf-8')
def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, f'cần {n} chỗ, thấy {c}: {a[:70]!r}'
    s = s.replace(a, b)
assert 'id="pcBox"' not in s, 'Đã chạy patch_pccc.py trên file này rồi'
js = (here / 'pccc.js').read_text(encoding='utf-8')
css = (here / 'pccc.css').read_text(encoding='utf-8')
# Bảng chấm điểm đặt ngay trên phần Xuất báo cáo
rep('<details class="box" open>\n          <summary><h3>Xuất báo cáo</h3></summary>',
    '<details class="box pcbox" open id="pcBox">\n          <summary><h3>Chấm điểm 25 hạng mục <span id="pcN"></span></h3></summary>\n'
    '          <div id="pcSum"></div>\n          <div id="pcList"></div>\n        </details>\n'
    '        <details class="box" open>\n          <summary><h3>Xuất báo cáo</h3></summary>')
i = s.rindex('</style>')
s = s[:i] + css + '\n' + s[i:]
rep('/* ---------- Khởi động ---------- */', js + '\n/* ---------- Khởi động ---------- */')
f.write_text(s, encoding='utf-8')
print('OK', f)
