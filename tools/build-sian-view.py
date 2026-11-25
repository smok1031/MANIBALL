# 시안 캔버스(모바일, PC)를 로그인 없이 보는 정적 페이지로 만든다 -> maniball/design/sian-view
import json, os, shutil, re, sys
OUT = '/home/claude/maniball/design/sian-view'
SRC = {'m': ('/home/claude/mob/project', '휴대폰'), 'p': ('/home/claude/pc/merged/project', 'PC')}
SKIP_ROWS = ('결정 기록', '보류', '지난 안', '보관')
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
data = {}
for key, (src, label) in SRC.items():
    os.makedirs(f'{OUT}/{key}')
    for f in os.listdir(src):
        if f.endswith('.dc.html'): shutil.copy(f'{src}/{f}', f'{OUT}/{key}/{f}')
    c = json.load(open(f'{src}/canvas.json'))
    rows = sorted([(v['y'], v['text'].strip()) for k, v in c['notes'].items()
                   if k != 'title' and v.get('x', 0) == 0 and '\n' not in v.get('text', '') and v.get('text')], key=lambda r: r[0])
    groups = []
    for y, t in rows:
        groups.append({'title': t, 'y': y, 'skip': t.startswith(SKIP_ROWS), 'boards': []})
    for name, b in c['boards'].items():
        title = b.get('title', name)
        g = None
        for gr in groups:
            if gr['y'] < b['y']: g = gr
        if g is None or g['skip'] or title.startswith('부품'): continue
        g['boards'].append({'f': name[:-8], 't': title, 'w': b['w'], 'h': b['h'], 'x': b['x'], 'y': b['y']})
    out = []
    for g in groups:
        if g['skip'] or not g['boards']: continue
        g['boards'].sort(key=lambda b: (b['y'], b['x']))
        out.append({'title': g['title'], 'boards': [{k: v for k, v in b.items() if k in ('f', 't', 'w', 'h')} for b in g['boards']]})
    data[key] = {'label': label, 'groups': out}
    print(key, sum(len(g['boards']) for g in out), 'boards in', len(out), 'groups')
open(f'{OUT}/boards.js', 'w').write('window.SIAN = ' + json.dumps(data, ensure_ascii=False) + ';\n')
for f in ('index.html', 'view.html'): shutil.copy(f'/home/claude/sianview/{f}', f'{OUT}/{f}')
