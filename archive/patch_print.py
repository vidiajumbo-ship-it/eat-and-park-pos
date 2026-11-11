#!/usr/bin/env python3
# patch_print.py — printKOT & printBill ko CSP-safe version se replace karta hai
import re
import sys
from pathlib import Path

FILE = Path("src/StaffApp.jsx")

if not FILE.exists():
    print(f"❌ File nahi mili: {FILE}")
    sys.exit(1)

src = FILE.read_text(encoding="utf-8")
print(f"📄 File size before: {len(src)} bytes, {src.count(chr(10))} lines")

# ---------- printKOT replacement ----------
NEW_PRINTKOT = '''function printKOT(order) {
  // CSP-SAFE-PRINTKOT
  try {
    const itemsHtml = (order.items || []).map(it => `<tr><td style="text-align:left;font-size:14px">${it.qty} x ${esc(it.name)}${it.portion ? ` (${esc(it.portion)})` : ""}</td></tr>`).join("");
    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const w = iframe.contentWindow;
    const cleanup = () => { setTimeout(() => { try { if (iframe.parentNode) document.body.removeChild(iframe); } catch (e) {} }, 1000); };
    try { w.addEventListener("afterprint", cleanup); } catch (e) {}
    setTimeout(cleanup, 90000);
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'"><title>KOT</title><style>@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:280px;margin:0 auto;padding:10px}h2,h3{text-align:center;margin:4px 0;font-weight:900}h2{font-size:26px}h3{font-size:18px}.c{text-align:center;font-size:12px;font-weight:700}.big{font-size:16px;font-weight:800}</style></head><body><h2>KOT</h2><h3>${order.orderType === "parcel" ? "PARCEL" : "TABLE " + esc(order.table)}</h3><div class="c">${now}</div><div class="c">#${esc(order.id.slice(1,9).toUpperCase())}</div>${order.waiter ? `<div class="c">Waiter: ${esc(order.waiter)}</div>` : ""}<div style="border-top:2px solid #000;margin:10px 0"></div><table style="width:100%"><tbody>${itemsHtml}</tbody></table><div style="border-top:2px solid #000;margin:10px 0"></div><div class="c big">Total Items: ${(order.items || []).reduce((s, it) => s + it.qty, 0)}</div><div class="c" style="margin-top:14px;font-size:11px">- Kitchen Copy -</div></body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { alert("Print error: " + e.message); } }, 300);
  } catch (e) { alert("Print error: " + e.message); }
}
'''

# ---------- printBill replacement ----------
NEW_PRINTBILL = '''function printBill(order) {
  // CSP-SAFE-PRINTBILL
  try {
    const itemsHtml = (order.items || []).map(it => `<tr><td style="text-align:left">${esc(it.name)}${it.portion ? ` (${esc(it.portion)})` : ""}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">Rs ${it.price}</td><td style="text-align:right">Rs ${it.price * it.qty}</td></tr>`).join("");
    const sub = order.subtotal || (order.items || []).reduce((s, it) => s + it.price * it.qty, 0);
    const total = order.finalTotal || sub;
    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const billNo = esc(order.id.slice(1,9).toUpperCase());
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const w = iframe.contentWindow;
    const cleanup = () => { setTimeout(() => { try { if (iframe.parentNode) document.body.removeChild(iframe); } catch (e) {} }, 1000); };
    try { w.addEventListener("afterprint", cleanup); } catch (e) {}
    setTimeout(cleanup, 90000);
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'"><title>Bill ${billNo}</title><style>@page{margin:0}*{color:#000!important}body{font-family:Arial,sans-serif;width:290px;margin:0 auto;padding:10px;font-weight:700}h2{text-align:center;font-size:24px;font-weight:900;margin:4px 0}.c{text-align:center;font-size:10px}.line{border-top:2px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:4px 2px}th{border-bottom:2px solid #000;text-align:left;font-size:12px}.grand td{font-size:18px;font-weight:900;border-top:3px solid #000;padding-top:8px}.badge{display:inline-block;padding:3px 10px;border:2px solid #000;border-radius:10px;font-size:12px;margin:2px}</style></head><body><h2>${RESTAURANT.name}</h2><div class="c">${RESTAURANT.address}</div><div class="c">Ph: ${RESTAURANT.phones.join(" / ")}</div><div class="line"></div><div style="display:flex;justify-content:space-between;font-size:11px"><div>Bill: ${billNo}</div><div>${order.orderType === "parcel" ? "PARCEL" : "T-" + esc(order.table)}</div></div><div class="c" style="margin-top:4px">${now}</div>${order.waiter ? `<div class="c">Waiter: ${esc(order.waiter)}</div>` : ""}<div class="line"></div><table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr></thead><tbody>${itemsHtml}</tbody></table><div class="line"></div><table><tr><td>Subtotal</td><td style="text-align:right">Rs ${sub}</td></tr>${order.gstAmount ? `<tr><td>GST</td><td style="text-align:right">+Rs ${order.gstAmount}</td></tr>` : ""}${order.billDiscount ? `<tr><td>Discount</td><td style="text-align:right">-Rs ${order.billDiscount}</td></tr>` : ""}<tr class="grand"><td>GRAND TOTAL</td><td style="text-align:right">Rs ${total}</td></tr></table><div class="line"></div><div class="c"><span class="badge">${(order.payment || "cash").toUpperCase()}</span><span class="badge">${order.paid ? "PAID" : order.payment === "due" ? "DUE" : "PENDING"}</span></div><div class="c" style="margin-top:10px;font-size:11px">** Thank you, visit again **</div><div class="c" style="font-size:10px">Eat &amp; Park Restaurant</div></body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { alert("Print error: " + e.message); } }, 400);
  } catch (e) { alert("Print error: " + e.message); }
}
'''

# ---------- Replace printKOT ----------
pat_kot = re.compile(r"function printKOT\(order\) \{[\s\S]*?\n\}\n", re.MULTILINE)
if pat_kot.search(src):
    if "CSP-SAFE-PRINTKOT" in src:
        print("✅ printKOT already patched — skip")
    else:
        src_new = pat_kot.sub(NEW_PRINTKOT, src, count=1)
        if src_new != src:
            src = src_new
            print("✅ printKOT replaced")
        else:
            print("⚠️ printKOT regex match but no change?")
else:
    print("❌ printKOT function nahi mila")

# ---------- Replace printBill ----------
pat_bill = re.compile(r"function printBill\(order\) \{[\s\S]*?\n\}\n", re.MULTILINE)
if pat_bill.search(src):
    if "CSP-SAFE-PRINTBILL" in src:
        print("✅ printBill already patched — skip")
    else:
        src_new = pat_bill.sub(NEW_PRINTBILL, src, count=1)
        if src_new != src:
            src = src_new
            print("✅ printBill replaced")
        else:
            print("⚠️ printBill regex match but no change?")
else:
    print("❌ printBill function nahi mila")

# ---------- Save ----------
FILE.write_text(src, encoding="utf-8")
print(f"📄 File size after: {len(src)} bytes, {src.count(chr(10))} lines")

# ---------- Verify ----------
final = FILE.read_text(encoding="utf-8")
ok = True
if "CSP-SAFE-PRINTKOT" in final:
    print("✅ Verify: printKOT patched")
else:
    print("❌ Verify: printKOT NOT patched")
    ok = False
if "CSP-SAFE-PRINTBILL" in final:
    print("✅ Verify: printBill patched")
else:
    print("❌ Verify: printBill NOT patched")
    ok = False

if ok:
    print("\n🎉 DONO FIXES APPLY HO GAYE!")
    sys.exit(0)
else:
    print("\n❌ KUCH FAIL HUA")
    sys.exit(1)
