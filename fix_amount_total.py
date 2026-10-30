import os, re, shutil, datetime

def backup(path):
    bak = path + ".bak_amount." + datetime.datetime.now().strftime("%H%M%S")
    shutil.copy2(path, bak)
    print(f"💾 Backup created: {bak}")

def main():
    path = "src/StaffApp.jsx"
    if not os.path.exists(path):
        print("❌ File nahi mili.")
        return

    backup(path)
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()

    print("🔧 Fixing amount calculation in BillingView...")

    # Fix 1: Subtotal calculation for existing items
    # Pehle code me `cartSubtotal` sirf naye items ka jod raha tha, existing ka nahi
    old_cart_sub = "const cartSubtotal = cartItems.reduce((s, [id, q]) => { const m = resolveItem(id); return s + (rates[id] ?? m?.price ?? 0) * q; }, 0);"
    new_cart_sub = """const cartSubtotal = cartItems.reduce((s, [id, q]) => { 
    const m = resolveItem(id); 
    const ex = existingItems.find(e => e.itemId === id);
    // Agar item pehle se order me hai (addMoreMode), toh purani qty + nayi qty ka price le
    const effectiveQty = addMoreMode && ex ? (ex.qty + q) : q; 
    return s + (rates[id] ?? m?.price ?? 0) * effectiveQty; 
  }, 0);"""
    
    if old_cart_sub in src:
        src = src.replace(old_cart_sub, new_cart_sub)
        print("✅ 1. Subtotal calculation fixed for AddMore mode.")
    else:
        print("⚠️ 1. Subtotal logic nahi mila. Exact line check karni padegi.")

    # Fix 2: `grossSub` me double count ko hatao
    # Pehle `addMoreMode` me existingSubtotal alag se jod raha tha, jo ab cartSubtotal me hi aa gaya hai
    old_gross = "const grossSub = addMoreMode ? existingSubtotal + cartSubtotal : cartSubtotal;"
    new_gross = "const grossSub = cartSubtotal; // Ab yeh khud hi sahi calculate ho raha hai"
    
    if old_gross in src:
        src = src.replace(old_gross, new_gross)
        print("✅ 2. Gross Subtotal double calculation fixed.")
    else:
        print("⚠️ 2. GrossSub logic nahi mila.")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    print("\n💾 File saved successfully!")
    print("🚀 Ab aap 'npm run build' chala kar deploy kar sakte hain.")

if __name__ == "__main__":
    main()
