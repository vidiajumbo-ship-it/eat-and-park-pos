#!/usr/bin/env python3
# Usage: python3 patch_staff3.py src/StaffApp.jsx
# Golden professional theme: warm ivory / warm black palette, gold buttons, header, tabs, chips,
# gold focus ring, serif headings. Danger/status colours (red/green/amber) jaise ke waise rahte hain.

import sys, re, shutil, datetime

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    src = f.read()

applied = 0
skipped = 0

def exact(name, old, new, expect_one=True):
    """exact string replace (sab jagah)"""
    global src, applied, skipped
    n = src.count(old)
    if n == 0:
        if new in src:
            print("PEHLE SE", name)
        else:
            skipped += 1
            print("SKIP  ", name, "(mila nahi)")
        return
    if expect_one and n != 1:
        skipped += 1
        print("SKIP  ", name, "(%d jagah mila)" % n)
        return
    src = src.replace(old, new)
    applied += 1
    print("OK    ", name, "(%d)" % n)

def rx(name, pattern, repl):
    global src, applied, skipped
    src, n = re.subn(pattern, repl, src)
    if n:
        applied += 1
        print("OK    ", name, "(%d)" % n)
    else:
        skipped += 1
        print("SKIP  ", name, "(mila nahi)")

# ---------- 1. PALETTE ----------
exact("Light palette (warm ivory)",
r'''bg: "#F9FAFB", card: "#fff", cardAlt: "#F3F4F6", ink: "#111827",''',
r'''bg: "#FAF7EF", card: "#FFFFFF", cardAlt: "#F4EEDD", ink: "#1C1608",''')
exact("Light gray/line",
r'''gray: "#6B7280", light: "#F9FAFB", line: "#E5E7EB",''',
r'''gray: "#7A7058", light: "#FAF7EF", line: "#E9E0C9",''')
exact("Light gold colours",
r'''blue: "#2563EB", blueLight: "#EFF6FF",''',
r'''blue: "#2563EB", blueLight: "#EFF6FF",
  gold: "#B8860B", goldDark: "#7A5806", goldLight: "#FBF3D9", goldText: "#8A6200",''')
exact("Dark palette (warm black)",
r'''bg: "#0F172A", card: "#1E293B", cardAlt: "#334155", ink: "#F1F5F9",''',
r'''bg: "#14110A", card: "#1F1A10", cardAlt: "#2C2516", ink: "#F7F0DA",''')
exact("Dark gray/line",
r'''gray: "#94A3B8", light: "#1E293B", line: "#334155",''',
r'''gray: "#B0A585", light: "#1F1A10", line: "#3D3319",''')
exact("Dark gold colours",
r'''blue: "#3B82F6", blueLight: "#1E3A8A",''',
r'''blue: "#3B82F6", blueLight: "#1E3A8A",
  gold: "#D4A017", goldDark: "#8F6A0A", goldLight: "#3A2C08", goldText: "#F0C85A",''')

# ---------- 2. GRADIENTS (header, buttons, totals, login, splash, chart bars) ----------
exact("Gradient 135deg", r'''linear-gradient(135deg, ${C.red} 0%, #B91C1C 100%)''',
      r'''linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)''', expect_one=False)
exact("Gradient 180deg (chart)", r'''linear-gradient(180deg, ${C.red} 0%, #B91C1C 100%)''',
      r'''linear-gradient(180deg, ${C.gold} 0%, ${C.goldDark} 100%)''', expect_one=False)
exact("Gradient (Saman save button)", r'''"linear-gradient(135deg, " + C.red + " 0%, #B91C1C 100%)"''',
      r'''"linear-gradient(135deg, " + C.gold + " 0%, " + C.goldDark + " 100%)"''', expect_one=False)
exact("Sidebar user card", r'''linear-gradient(135deg, ${C.red}10 0%, ${C.red}05 100%)''',
      r'''linear-gradient(135deg, ${C.gold}22 0%, ${C.gold}08 100%)''')

# ---------- 3. SHADOWS / FOCUS ----------
exact("Button shadows 40", r'''${C.red}40''', r'''${C.gold}40''', expect_one=False)
exact("Button shadows 55", r'''${C.red}55''', r'''${C.gold}55''', expect_one=False)
exact("Header shadow", r'''rgba(220,38,38,0.25)''', r'''rgba(184,134,11,0.30)''')
exact("Input focus ring",
r'''input:focus, textarea:focus { border-color: #DC2626 !important; box-shadow: 0 0 0 3px rgba(220,38,38,0.12); }''',
r'''input:focus, textarea:focus { border-color: #B8860B !important; box-shadow: 0 0 0 3px rgba(184,134,11,0.18); }''')

# ---------- 4. TABS / CHIPS / SIDEBAR ACTIVE ----------
exact("Active tab underline", r'''`3px solid ${C.red}`''', r'''`3px solid ${C.gold}`''')
rx("Active tabs / chips / selected -> gold",
   r'(=== [\w.]+ \? )C\.red( : C\.(?:line|gray|card|ink)\b)', r'\1C.gold\2')
rx("Show-all chips -> gold",
   r'(?<![\w.])(!?showAll \? )C\.red( : C\.(?:line|gray|card)\b)', r'\1C.gold\2')
rx("Sidebar active background",
   r'(activeTab === tab\.id \? )C\.redLight', r'\1C.goldLight')

# ---------- 5. AMOUNTS (money text) ----------
rx("Money text -> dark gold", r'color: C\.red, fontFamily: "monospace"', r'color: C.goldText, fontFamily: "monospace"')

# ---------- 6. SERIF HEADINGS ----------
exact("Premium serif heading font",
r'''const GLOBAL_CSS = `''',
r'''const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap');
h2 { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; letter-spacing: 0.2px; }''')

if applied:
    bak = path + ".bak3-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copyfile(path, bak)
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print("\nBackup:", bak)

print("\nLaga: %d  |  Skip: %d" % (applied, skipped))
print("Ab chalao: npm run build   (ya npm run dev se pehle dekh lo)")
