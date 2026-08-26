# -*- coding: utf-8 -*-
"""Извлекает все русские строки UI для составления словаря перевода.

Источники: app.js, admin.js (строки и шаблоны, разбитые по ${...}),
ai-platforms.html, admin.html (текст и атрибуты).
Вывод: TSV «строка <TAB> файл:строка» без повторов.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CYR = re.compile(r"[А-Яа-яЁё]")
TAG = re.compile(r"<[^>]+>")

# --- JS: строковые литералы и шаблоны -----------------------------------
STR_RE = re.compile(
    r"(?P<tpl>`(?:[^`\\]|\\.)*`)"          # `шаблон`
    r"|(?P<dq>\"(?:[^\"\\\n]|\\.)*\")"      # "строка"
    r"|(?P<sq>'(?:[^'\\\n]|\\.)*')"         # 'строка'
)

def js_fragments(src):
    out = []
    for m in STR_RE.finditer(src):
        kind = m.lastgroup
        raw = m.group()[1:-1]
        if kind == "tpl":
            # разбиваем по подстановкам, внутри частей гасим экранирования
            parts = re.split(r"\$\{[^}]*\}", raw)
            pieces = [p.replace("\\`", "`").replace("\\$", "$") for p in parts]
        else:
            q = '"' if kind == "dq" else "'"
            pieces = [raw.replace("\\" + q, q).replace("\\\\", "\\").replace("\\n", " ").replace("\\t", " ")]
        for p in pieces:
            # внутри куска могут быть HTML-теги — текст между ними тоже отдельные узлы
            for t in TAG.split(p):
                t = t.strip()
                if t and CYR.search(t):
                    out.append(t)
    return out

# --- HTML: текст и атрибуты ---------------------------------------------
ATTR_RE = re.compile(r"""(?:placeholder|title|aria-label|alt|content)\s*=\s*["']([^"']*[А-Яа-яЁё][^"']*)["']""")

def html_fragments(src):
    out = []
    for m in ATTR_RE.finditer(src):
        out.append(m.group(1).strip())
    body = re.sub(r"<script[\s\S]*?</script>", " ", src)
    for t in TAG.split(body):
        t = html_unescape(t.strip())
        if t and CYR.search(t):
            out.append(t)
    return out

def html_unescape(s):
    return (s.replace("&nbsp;", " ").replace("&laquo;", "«").replace("&raquo;", "»")
             .replace("&mdash;", "—").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">"))

def main():
    seen = {}
    for rel, is_js in [("assets/app.js", True), ("assets/admin.js", True),
                       ("ai-platforms.html", False), ("admin.html", False)]:
        path = ROOT / rel
        lines = path.read_text(encoding="utf-8").splitlines()
        for lineno, line in enumerate(lines, 1):
            frags = js_fragments(line) if is_js else html_fragments(line)
            for f in frags:
                f = re.sub(r"\s+", " ", f).strip()
                if f and len(f) > 0:
                    seen.setdefault(f, f"{rel}:{lineno}")
    for text, where in sorted(seen.items(), key=lambda x: (x[1], x[0])):
        print(f"{text}\t{where}")
    print(f"\n# всего уникальных фрагментов: {len(seen)}", file=sys.stderr)

if __name__ == "__main__":
    main()
