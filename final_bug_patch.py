import os, re, shutil, datetime

def backup(path):
    bak = path + ".bak_final." + datetime.datetime.now().strftime("%H%M%S")
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

    print("🔧 Fixing transaction errors and duplicate items...")

    # 1. Fix "Order kisi aur ne badal diya" error (Transaction error handling)
    # Hum 'kisi aur ne badal diya' wale error ko catch karke warning show karenge
    error_text = "Order kisi aur ne badal diya"
    if error_text in src:
        # Agar exact error text milta hai, toh us throw statement ko replace karo
        src = src.replace('throw new Error("' + error_text + ' - screen band karke dobara kholo");', 'throw new Error("REFRESH_NEEDED");')
        src = src.replace('throw new Error("' + error_text + '");', 'throw new Error("REFRESH_NEEDED");')
        print("✅ 1. Conflict error text handled.")
    
    # Catch block me REFRESH_NEEDED handle karo (taaki crash na ho)
    # Hum try-catch block me jaakar ek chota sa fix daalenge
    old_catch = "catch (e) { toast(e.message, \"error\"); } finally { lockRef.current = false; setPlacing(false); }"
    new_catch = """catch (e) {
        if (e.message === "REFRESH_NEEDED" || e.message.includes("badal diya")) {
          toast("Order update ho gaya tha, please wapas table par click karein.", "warning");
          onBack();
        } else {
          toast(e.message, "error");
        }
      } finally { lockRef.current = false; setPlacing(false); }"""
    
    count_catch = src.count(old_catch)
    if count_catch > 0:
        src = src.replace(old_catch, new_catch)
        print(f"✅ 2. Catch block handled ({count_catch} places).")

    # 2. Fix duplicate item merge in running orders
    # Search for the array append logic in transaction
    old_items_append = "items: [...(live.items || []), ...newItems],"
    new_items_merge = """items: (() => {
              const merged = [...(live.items || [])];
              newItems.forEach(newItem => {
                const existing = merged.find(i => i.itemId === newItem.itemId);
                if (existing) existing.qty += newItem.qty;
                else merged.push(newItem);
              });
              return merged;
            })(),"""
    
    count_merge = src.count(old_items_append)
    if count_merge > 0:
        src = src.replace(old_items_append, new_items_merge)
        print(f"✅ 3. Duplicate item merge fixed ({count_merge} places).")
    else:
        print("⚠️ Duplicate item merge logic not found (shayad pehle se fix hai).")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    print("\n💾 File saved successfully!")
    print("🚀 Ab aap 'npm run build' chala kar deploy kar sakte hain.")

if __name__ == "__main__":
    main()
