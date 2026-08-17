from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "ai-platforms.html"
CSS = ROOT / "assets" / "app.css"
JS = ROOT / "assets" / "app.js"

html = HTML.read_text(encoding="utf-8")

style_match = re.search(r"<style>\n?(.*?)\n?</style>", html, flags=re.S)
script_match = re.search(r"<script>\n?(.*?)\n?</script>", html, flags=re.S)

if not style_match and not script_match:
    print("No inline assets found; nothing to do.")
    raise SystemExit(0)

CSS.parent.mkdir(parents=True, exist_ok=True)

if style_match:
    CSS.write_text(style_match.group(1).rstrip() + "\n", encoding="utf-8")
    html = html[:style_match.start()] + '<link rel="stylesheet" href="assets/app.css">' + html[style_match.end():]

# Re-find script after HTML was modified, because offsets changed.
script_match = re.search(r"<script>\n?(.*?)\n?</script>", html, flags=re.S)
if script_match:
    JS.write_text(script_match.group(1).rstrip() + "\n", encoding="utf-8")
    html = html[:script_match.start()] + '<script src="assets/app.js"></script>' + html[script_match.end():]

HTML.write_text(html, encoding="utf-8")

# Structural assertions: behavior-bearing code must no longer live inline.
result = HTML.read_text(encoding="utf-8")
assert "<style>" not in result
assert "<script>" not in result
assert 'href="assets/app.css"' in result
assert 'src="assets/app.js"' in result
assert CSS.exists() and CSS.stat().st_size > 1000
assert JS.exists() and JS.stat().st_size > 1000

print(f"Extracted CSS: {CSS.stat().st_size} bytes")
print(f"Extracted JS: {JS.stat().st_size} bytes")
print(f"Rewritten HTML: {HTML.stat().st_size} bytes")
