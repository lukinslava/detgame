#!/usr/bin/env python3
"""Забирает картинки из img/inbox/<дело>/, сжимает их и кладёт в img/<дело>/<id>.jpg,
а потом включает их в js/images.js. Запуск: python3 tools/import_images.py

Файл должен называться по номеру карты (c01.png) или cover.*. Остальные файлы
скрипт оставляет во входящих и перечисляет: их нужно переименовать.
"""
import json, re, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / 'img' / 'inbox'
MANIFEST = ROOT / 'js' / 'images.js'
WIDTH = 1200          # ширина картинки карты
QUALITY = 78          # качество JPEG: ~100–200 КБ на картинку
EXT = {'.png', '.jpg', '.jpeg', '.webp'}

def load_manifest():
    text = MANIFEST.read_text()
    data = {}
    for cid, body in re.findall(r"'([\w-]+)':\s*\[([^\]]*)\]", text):
        data[cid] = re.findall(r"'([\w-]+)'", body)
    return text, data

def save_manifest(text, data):
    def repl(m):
        cid = m.group(1)
        ids = sorted(set(data.get(cid, [])), key=lambda x: (x != 'cover', x))
        return f"'{cid}': [" + ', '.join(f"'{i}'" for i in ids) + "]"
    MANIFEST.write_text(re.sub(r"'([\w-]+)':\s*\[[^\]]*\]", repl, text))

def main():
    text, data = load_manifest()
    done, skipped = [], []
    for case_dir in sorted(p for p in INBOX.iterdir() if p.is_dir()):
        cid = case_dir.name
        if cid not in data:
            continue
        for f in sorted(case_dir.iterdir()):
            if f.suffix.lower() not in EXT:
                continue
            m = re.match(r'^(cover|[a-z]\d{2})\b', f.stem.lower())
            if not m:
                skipped.append(str(f.relative_to(ROOT)))
                continue
            card = m.group(1)
            out = ROOT / 'img' / cid / f'{card}.jpg'
            out.parent.mkdir(parents=True, exist_ok=True)
            im = Image.open(f).convert('RGB')
            if im.width > WIDTH:
                im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
            im.save(out, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
            f.unlink()
            data[cid].append(card)
            done.append(f'{cid}/{card} ({out.stat().st_size // 1024} КБ)')
    save_manifest(text, data)
    print(f'Готово: {len(done)}')
    for d in done:
        print('  +', d)
    if skipped:
        print('Не понял, к какой карте относятся (переименуйте по номеру карты):')
        for s in skipped:
            print('  ?', s)

if __name__ == '__main__':
    sys.exit(main())
