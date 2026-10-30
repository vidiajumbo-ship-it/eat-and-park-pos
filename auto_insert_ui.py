import sys, os, re, shutil, datetime

def backup(path):
    bak = path + ".bak_ui." + datetime.datetime.now().strftime("%H%M%S")
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

    print("🔧 Inserting UI Blocks into StaffApp.jsx...\n")

    # --- 1. CALLS BANNER ---
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

    # --- 2. BOOKINGS TAB CONTENT ---
    bookings_content = """
{activeTab === "bookings" && (
  <div>
    <h2 style={{ margin: "0 0 16px", fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.ink }}>Bookings ({bookings?.length || 0})</h2>
    {(!bookings || bookings.length === 0) && <div style={{ textAlign: "center", padding: 40, color: C.gray }}><div style={{ fontSize: 40, marginBottom: 8 }}>📅</div><div style={{ fontSize: 13, fontWeight: 700 }}>Koi booking nahi</div></div>}
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(bookings || []).sort((a,b) => b.createdAt - a.createdAt).map(b => (
        <div key={b.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>{b.type === "party" ? "🎉 Party" : "🍽️ Table"}</div>
            <span style={{ background: C.amberLight, color: C.amber, padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 800 }}>{(b.status || "pending").toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 12, color: C.ink, fontWeight: 700 }}>{b.name} · {b.phone}</div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{b.date} at {b.time} · {b.guests} guests</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <a href={`https://wa.me/91${b.phone}`} target="_blank" rel="noopener noreferrer" style={{ background: "#25D366", color: "#fff", padding: "7px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 12 }}>✅ Confirm</a>
            <button onClick={async () => { if (window.confirm("Delete booking?")) { try { await deleteDoc(doc(db, "bookings", b.id)); toast("Deleted", "success"); } catch (e) { toast(e.message, "error"); } } }} style={{ background: "transparent", color: C.red, border: `1.5px solid ${C.red}`, padding: "7px 14px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
"""

    # Insert Calls Banner
    # Logic: Find where the main content area begins. Usually right after the Tabs map or just before activeTab checks.
    banner_anchor = '{activeTab === "expenses" && ('
    if banner_anchor in src:
        src = src.replace(banner_anchor, calls_banner + "\n" + banner_anchor, 1)
        print("✅ 1. Calls Banner inserted successfully.")
    else:
        # Fallback to menu tab
        banner_anchor_2 = '{activeTab === "menu" && ('
        if banner_anchor_2 in src:
            src = src.replace(banner_anchor_2, calls_banner + "\n" + banner_anchor_2, 1)
            print("✅ 1. Calls Banner inserted (fallback at menu tab).")
        else:
            print("⚠️ 1. SKIP: Could not find a suitable place for Calls Banner. Need manual check.")

    # Insert Bookings Tab Content
    # Logic: Find the end of the expenses or menu tab and insert bookings right after it.
    # We will look for 'activeTab === "orders"' or 'activeTab === "expenses"' and inject before it.
    bookings_anchor = '{activeTab === "menu" && ('
    if bookings_anchor in src:
        src = src.replace(bookings_anchor, bookings_content + "\n" + bookings_anchor, 1)
        print("✅ 2. Bookings Tab Content inserted successfully.")
    else:
        bookings_anchor_2 = '{activeTab === "orders" && ('
        if bookings_anchor_2 in src:
            src = src.replace(bookings_anchor_2, bookings_content + "\n" + bookings_anchor_2, 1)
            print("✅ 2. Bookings Tab Content inserted (fallback).")
        else:
            print("⚠️ 2. SKIP: Could not find a suitable place for Bookings Tab Content. Need manual check.")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(src)
    print("\n💾 File updated and saved!")
    print("🚀 Ab aap 'npm run build' chala kar check kar sakte hain.")

if __name__ == "__main__":
    main()
