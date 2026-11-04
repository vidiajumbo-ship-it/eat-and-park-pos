// fix-waiter-btn.mjs
import fs from 'fs';
const path = 'src/App.jsx';
let src = fs.readFileSync(path, 'utf8');

// 1. Add state
if (!src.includes('showKitchenOnly')) {
  const sig = 'function StaffView({ menu = [], orders, advanceStatus, requestPinPrompt, calls, resolveCall, cancelOrderByStaff, placeOrder, categories = [], setMenuState }) {';
  if (src.includes(sig)) {
    src = src.replace(sig, sig + '\n  const [showKitchenOnly, setShowKitchenOnly] = useState(false);\n');
    console.log('✅ State added');
  }
}

// 2. Wrap Table Board
if (!src.includes('Open Kitchen View')) {
  const lines = src.split('\n');
  let boardStart = -1;
  let boardEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<TableStatusBoard')) {
      boardStart = i;
      while (boardStart > 0 && !lines[boardStart].includes('Table Status Board') && !lines[boardStart].includes('<div')) {
        boardStart--;
      }
      boardEnd = i;
      while (boardEnd < lines.length && !lines[boardEnd].includes('</div>')) {
        boardEnd++;
      }
      if (boardStart > 0 && lines[boardStart - 1].includes('Table Status Board')) {
        boardStart--;
      }
      break;
    }
  }

  if (boardStart !== -1 && boardEnd !== -1) {
    const prefix = lines.slice(0, boardStart);
    const block = lines.slice(boardStart, boardEnd + 1);
    const suffix = lines.slice(boardEnd + 1);

    const btn = [
      `      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>`,
      `        <button onClick={() => setShowKitchenOnly(prev => !prev)} style={{ padding: '12px 24px', borderRadius: 12, background: showKitchenOnly ? COLORS.ink : COLORS.copper, color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 15, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>`,
      `          {showKitchenOnly ? "🪑 Back to Tables" : "🍳 Open Kitchen View"}`,
      `        </button>`,
      `      </div>`,
      `      {!showKitchenOnly && (`
    ];

    const newLines = [...prefix, ...btn, ...block, `      )}`, ...suffix];
    src = newLines.join('\n');
    console.log('✅ Table Board wrapped');
  }
}

// 3. Wrap Kitchen Kanban
if (!src.includes('{showKitchenOnly && (<>')) {
  const startStr = '{viewMode !== "desktop" && (';
  const endStr = '{/* 🧾 NEW: ONE-SCREEN ORDER + BILL */}';
  
  if (src.includes(startStr) && src.includes(endStr)) {
    const startIndex = src.indexOf(startStr);
    const endIndex = src.indexOf(endStr);
    if (startIndex !== -1 && endIndex !== -1) {
      src = src.slice(0, startIndex) + `{showKitchenOnly && (<>\n` + src.slice(startIndex, endIndex) + `</>)}\n\n` + src.slice(endIndex);
      console.log('✅ Kitchen wrapped');
    }
  }
}

fs.writeFileSync(path, src);
console.log('Done. Now restart Vite.');