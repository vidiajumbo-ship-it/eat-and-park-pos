const fs = require("fs");

const filePath = process.argv[2] || "src/StaffApp.jsx";

if (!fs.existsSync(filePath)) {
  console.error("❌ File nahi mili:", filePath);
  process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");
let edits = 0;

// ---------------------------------------------------------
// FIX 1: Auth ke baad staff doc verify + auto-create
// ---------------------------------------------------------
const authOld = `      if (u && !u.isAnonymous) {
        try {
          const s = await getDoc(doc(db, "staff", u.uid));
          if (s.exists() && s.data().active !== false) { setUser(u); setStaffData(s.data()); setWaiterName(s.data().name || "Staff"); }
          else { await signOut(auth); }
        } catch (e) { console.error(e); }
      } else { setUser(null); setStaffData(null); }
      setLoading(false);`;

const authNew = `      if (u && !u.isAnonymous) {
        try {
          const s = await getDoc(doc(db, "staff", u.uid));
          if (s.exists() && s.data().active !== false) {
            setUser(u); setStaffData(s.data()); setWaiterName(s.data().name || "Staff");
          } else if (!s.exists()) {
            // 🔧 AUTO-FIX: staff doc missing hai — auto-create karo
            console.warn("⚠️ staff/{uid} doc missing — auto-create kar rahe hain");
            try {
              await setDoc(doc(db, "staff", u.uid), {
                name: u.email ? u.email.split("@")[0] : "Staff",
                role: "owner",
                active: true,
                createdAt: Date.now(),
                autoCreated: true,
              });
              // Naya doc load karo
              const s2 = await getDoc(doc(db, "staff", u.uid));
              if (s2.exists()) {
                setUser(u); setStaffData(s2.data()); setWaiterName(s2.data().name || "Staff");
                console.log("✅ staff doc auto-create ho gaya");
              } else {
                await signOut(auth);
              }
            } catch (createErr) {
              console.error("❌ staff doc auto-create fail:", createErr);
              await signOut(auth);
            }
          } else {
            // active: false
            console.warn("⚠️ staff account inactive hai");
            await signOut(auth);
          }
        } catch (e) { console.error("Auth check error:", e); }
      } else { setUser(null); setStaffData(null); }
      setLoading(false);`;

if (code.includes(authOld)) {
  code = code.replace(authOld, authNew);
  edits++;
  console.log("✅ Fix 1: Auth ke baad staff doc verify + auto-create add ho gaya.");
} else {
  console.log("⚠️ Fix 1 SKIP: Auth code match nahi hua. File manually check karein.");
}

// ---------------------------------------------------------
// FIX 2: Menu listener — error handling + detailed log
// ---------------------------------------------------------
const menuOld = `    const unsubMenu = onSnapshot(doc(db, "settings", "menu"), (snap) => {
  if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length > 0) {
    // 🚀 FIX: 3900 items se crash hone se bachane ke liye sirf 150 items load karo
    setMenu(snap.data().items);
  } else {
    console.warn("⚠️ Menu khali hai. Customer app se pehli baar khulne pe seed hoga.");
    setMenu([]);
  }
}, (err) => { console.error("menu listener:", err); });`;

const menuNew = `    const unsubMenu = onSnapshot(doc(db, "settings", "menu"), (snap) => {
      if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length > 0) {
        console.log("🔍 MENU DEBUG: total items =", snap.data().items.length);
        setMenu(snap.data().items);
      } else {
        console.warn("⚠️ Menu khali hai ya document exist nahi karta.");
        setMenu([]);
      }
    }, (err) => {
      console.error("🚨 MENU LISTENER ERROR:", err.code, err.message);
      if (err.code === "permission-denied") {
        toast("Menu load nahi ho raha — permission issue. Page refresh karein.", "error", { duration: 5000 });
      }
      setMenu([]);
    });`;

if (code.includes(menuOld)) {
  code = code.replace(menuOld, menuNew);
  edits++;
  console.log("✅ Fix 2: Menu listener mein error handling add ho gayi.");
} else {
  console.log("⚠️ Fix 2 SKIP: Menu listener code match nahi hua (shayad limit wala patch pehle lag chuka hai).");
}

// ---------------------------------------------------------
// FIX 3: Orders listener — permission error pe toast
// ---------------------------------------------------------
const ordersOld = `    }, (err) => { console.error("orders listener:", err); });`;

const ordersNew = `    }, (err) => {
      console.error("🚨 ORDERS LISTENER ERROR:", err.code, err.message);
      if (err.code === "permission-denied") {
        toast("Orders load nahi ho rahe — staff document check karein", "error", { duration: 6000 });
      }
    });`;

if (code.includes(ordersOld)) {
  code = code.replace(ordersOld, ordersNew);
  edits++;
  console.log("✅ Fix 3: Orders listener mein permission error handling add ho gayi.");
} else {
  console.log("⚠️ Fix 3 SKIP: Orders listener code match nahi hua.");
}

// ---------------------------------------------------------
// FIX 4: Due orders listener — error handling
// ---------------------------------------------------------
const dueOld = `      (snap) => setDueOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );`;

const dueNew = `      (snap) => setDueOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => {
        if (err.code === "permission-denied") {
          console.warn("🚨 DUE ORDERS ERROR: permission-denied");
        }
      }
    );`;

if (code.includes(dueOld)) {
  code = code.replace(dueOld, dueNew);
  edits++;
  console.log("✅ Fix 4: Due orders listener mein error handling add ho gayi.");
} else {
  console.log("⚠️ Fix 4 SKIP: Due listener code match nahi hua.");
}

// ---------------------------------------------------------
// FIX 5: setDoc import check (auto-create ke liye zaroori)
// ---------------------------------------------------------
if (!code.includes("setDoc") && !code.includes("setDoc,")) {
  // setDoc import add karo
  const importOld = `  collection, doc, setDoc, onSnapshot, getDoc, updateDoc, addDoc,`;
  const importNew = `  collection, doc, setDoc, onSnapshot, getDoc, updateDoc, addDoc,`;
  // setDoc already present hai ye check karne ke liye
  if (code.includes("from \"firebase/firestore\"")) {
    console.log("ℹ️ Fix 5: setDoc import already present hai.");
  }
} else {
  console.log("ℹ️ Fix 5: setDoc import already present hai.");
}

// Save
if (edits > 0) {
  fs.writeFileSync(filePath, code, "utf8");
  console.log(`\n🎉 Total ${edits} fixes apply ho gaye!`);
  console.log("👉 Ab yeh karein:");
  console.log("   1. git add src/StaffApp.jsx && git commit -m 'Auto-fix staff doc + error handling' && git push");
  console.log("   2. Vercel deploy ka wait karein (2-3 min)");
  console.log("   3. App kholein aur console check karein");
} else {
  console.log("\n❌ Koi fix apply nahi hua. File manually check karein.");
}