from pathlib import Path

root=Path(__file__).resolve().parents[1]
index=root/'index.html'
dash=root/'ai-platforms.html'
css=root/'assets/app.css'

t=index.read_text(encoding='utf-8')
repls={
'<a class="btn" href="ai-platforms.html" data-copy="navSignIn">':'<a class="btn" href="auth.html?mode=signin" data-copy="navSignIn">',
'<a class="btn primary" href="ai-platforms.html" data-copy="navStart">':'<a class="btn primary" href="auth.html?mode=signup" data-copy="navStart">',
'<a class="btn primary" href="ai-platforms.html" data-copy="heroStart">':'<a class="btn primary" href="auth.html?mode=signup" data-copy="heroStart">',
'<a class="btn primary" href="ai-platforms.html" data-copy="ctaBtn">':'<a class="btn primary" href="auth.html?mode=signup" data-copy="ctaBtn">',
}
for old,new in repls.items():
    if old not in t: raise SystemExit(f'missing landing marker: {old}')
    t=t.replace(old,new,1)
index.write_text(t,encoding='utf-8')

t=dash.read_text(encoding='utf-8')
old='<script src="assets/app.js"></script>'
new='<script src="assets/supabase-config.js"></script>\n<script type="module" src="assets/dashboard-auth.js"></script>\n<script src="assets/app.js"></script>'
if old not in t: raise SystemExit('missing dashboard script marker')
t=t.replace(old,new,1)
dash.write_text(t,encoding='utf-8')

c=css.read_text(encoding='utf-8')
block='\n/* AI CORE authenticated account chip */\n.auth-account{display:flex;align-items:center;gap:8px;margin-left:auto;max-width:260px}.auth-account span{max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:12px}@media(max-width:900px){.auth-account span{display:none}}\n'
if '.auth-account{' not in c:
    css.write_text(c+block,encoding='utf-8')
