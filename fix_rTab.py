#!/usr/bin/env python3
# Fix for ReportsView close PnL fragment

import sys, re

path = "src/StaffApp.jsx"
with open(path, encoding="utf-8") as f:
    src = f.read()

# ReportsView ke andar, {!loading && ( <> ... </> )} ke baad
# {rTab === "pnl" && (<> ... </>)} close karna hai

# Step 1: Check karo patch 5 laga hai (state for tab)
if 'const [rTab, setRTab] = useState("pnl");' not in src:
    print("ERROR: Patch 5 nahi laga. Pehle patch_staff5.py chalao.")
    sys.exit(1)

# Step 2: Agar already fixed hai
if '      </>)}\n    </div>\n  );\n}' in src:
    print("PEHLE SE: ReportsView closing fixed hai")
    sys.exit(0)

# Step 3: ReportsView dhoondo aur uska end fix karo
# Strategy: ReportsView function ke andar, {!loading && ( <> ... </> )} ke baad
# {rTab === "pnl" && (<> ... </>)} ka close add karo

# Find ReportsView start
m = re.search(r'function ReportsView\([^)]+\)\s*\{', src)
if not m:
    print("ERROR: ReportsView nahi mila")
    sys.exit(1)

start = m.start()
# Find next function (ReportsView ka end)
next_fn = re.search(r'\nfunction [A-Z]', src[start+10:])
if not next_fn:
    print("ERROR: ReportsView ka end nahi mila")
    sys.exit(1)

end = start + 10 + next_fn.start()
reports_body = src[start:end]

# Ab is body ke end mein, last ')}' + '</div>' + ');' + '}' dhoondo
# Pattern: '      )}\n    </div>\n  );\n}' (ReportsView ka end)
old_pattern = '      )}\n    </div>\n  );\n}'
new_pattern = '      )}\n      </>)}\n    </div>\n  );\n}'

# Sirf ReportsView ke andar replace karo
if old_pattern not in reports_body:
    print("ERROR: ReportsView ke end mein expected pattern nahi mila.")
    print("Body ka last 200 chars:")
    print(repr(reports_body[-200:]))
    sys.exit(1)

new_body = reports_body.replace(old_pattern, new_pattern, 1)
src = src[:start] + new_body + src[end:]

# Backup
import shutil, datetime
bak = path + ".bak_fix-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
shutil.copyfile(path, bak)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)

print("OK: ReportsView closing fix ho gaya")
print("Backup:", bak)
