const fs = require("fs");
const FILE = "src/DeliveryApp.jsx";
let t = fs.readFileSync(FILE, "utf8");

// 1. Add Audio Object before the component
const audioCode = `
const alertAudio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
alertAudio.volume = 1.0;

export default function DeliveryApp() {`;

t = t.replace("export default function DeliveryApp() {", audioCode);

// 2. Add refs for tracking new orders inside the component
const stateCode = `
  const [selectedOrder, setSelectedOrder] = useState(null);
  const prevOrdersRef = useRef([]);
  const isFirstLoad = useRef(true);`;
t = t.replace("const [selectedOrder, setSelectedOrder] = useState(null);", stateCode);

// 3. Add Audio Unlock logic
const unlockCode = `
  // Unlock audio on first user interaction
  useEffect(() => {
    const unlock = () => {
      alertAudio.play().then(() => {
        alertAudio.pause();
        alertAudio.currentTime = 0;
      }).catch(() => {});
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);
`;
t = t.replace("// Auth Check", unlockCode + "\n  // Auth Check");

// 4. Modify the onSnapshot to trigger sound on new order
const oldSnapshot = `const active = validOrders
        .filter(o => o.status !== "served")
        .sort((a, b) => b.createdAt - a.createdAt);
      setActiveOrders(active);`;

const newSnapshot = `const active = validOrders
        .filter(o => o.status !== "served")
        .sort((a, b) => b.createdAt - a.createdAt);
      
      // 🔔 Notification Alert Logic
      if (!isFirstLoad.current) {
        const newOrders = active.filter(o => !prevOrdersRef.current.includes(o.id));
        if (newOrders.length > 0) {
          try {
            alertAudio.currentTime = 0;
            alertAudio.play().catch(e => console.log("Audio blocked", e));
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
          } catch (e) {}
        }
      }
      
      prevOrdersRef.current = active.map(o => o.id);
      isFirstLoad.current = false;
      
      setActiveOrders(active);`;

if (t.includes(oldSnapshot)) {
  t = t.replace(oldSnapshot, newSnapshot);
} else {
  console.log("⚠️ Snapshot block match nahi hua. Shayad pehle se change hai.");
}

// 5. Add useRef to imports if not present
if (!t.includes("useRef")) {
  t = t.replace('import React, { useState, useEffect, useMemo } from "react";', 'import React, { useState, useEffect, useMemo, useRef } from "react";');
  console.log("✅ useRef import add kiya.");
}

fs.copyFileSync(FILE, FILE + ".bak-sound");
fs.writeFileSync(FILE, t, "utf8");
console.log("✅ Delivery App me Ringtone aur Vibration Alert add ho gaya!");