import sys, os, re, shutil, datetime

def backup(path):
    bak = path + ".bak_banner." + datetime.datetime.now().strftime("%H%M%S")
    shutil.copy2(path, bak)
    print(f"💾 Backup created: {bak}")

def main():
    file_path = "src/StaffApp.jsx"
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        sys.exit(1)

    backup(file_path)
    with open(file_path, 'r', encoding='utf-8') as f:
        src = f.read()

    print("🔧 Finding tab patterns to insert Calls Banner...\n")

    calls_banner = """
{calls.length > 0 && (
  <div style={{ background: C.amberLight, borderBottom: `2px solid ${C.amber}`, padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
    <span style={{ fontWeight: 800, fontSize: 13, color: C.amber }}>🔔 Waiter Called ({calls.length}):</span>
    {calls.map(c => (
      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, borderRadius: 20, padding: "4px 6px 4px 12px", border: `1px solid ${C.line}` }}>
        <span style={{ fontWeight: 800, fontSize: 12, color: C.ink }}>Table {c.table}</span>
        <button onClick={() => resolveCall(c.id)} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 14, padding: "4px 10px", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✓ Done</button>
      </div>
    ))}
  </div>
)}
"""

    # Find all `{activeTab === "..." && (` patterns
    pattern = re.compile(r'\{\s*activeTab\s*===\s*"([^"]+)"\s*&&\s*\(')
    matches = list(pattern.finditer(src))

    if not matches:
        print("❌ Koi bhi activeTab pattern nahi mila. File structure alag hai.")
        sys.exit(1)

    print("📍 Milne wale tabs:")
    for m in matches:
        print(f"   - Tab: {m.group(1)} at pos {m.start()}")

    # Insert banner BEFORE the first tab render block
    first_match = matches[0]
    insert_pos = first_match.start()
    src = src[:insert_pos] + calls_banner + "\n" + src[insert_pos:]
    print(f"\n✅ Calls Banner inserted before the first tab: '{first_match.group(1)}'")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(src)
    print("\n💾 File saved!")
    print("🚀 Ab 'npm run build' chalayein.")

if __name__ == "__main__":
    main()
