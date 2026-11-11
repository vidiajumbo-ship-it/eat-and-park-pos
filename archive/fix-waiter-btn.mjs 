// fix-waiter-btn.mjs
import fs from 'fs';
const path = 'src/App.jsx';
let src = fs.readFileSync(path, 'utf8');

// 1. Add State
if (!src.includes('showKitchenOnly')) {
  const match = src.match(/function\s+StaffView\s*\(\s*\{[^}]*\}\s*\)\s*\{/);
  if (match) {
    src = src.replace(match[0], match[0] + '\n  const [showKitchenOnly, setShowKitchenOnly] = useState(false);\n');
    console.log('✅ State added');
  }
}

// 2. Add Button & Wrap Table View
if (!src.includes('Open Kitchen View')) {
  const boardBlockRegex = /\{\/\*\s*🍽️ Table Status Board\s*\*\/\}\s*<div[^>]*>\s*<TableStatusBoard[\s\S]*?<\/div>\s*<\/div>/;
  const match = src.match(boardBlockRegex);
  if (match) {
    const btn = `      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowKitchenOnly(prev => !prev)} style={{ padding: '12px 24px', borderRadius: 12, background: showKitchenOnly ? COLORS.ink : COLORS.copper, color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 15, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {showKitchenOnly ? "🪑 Back to Tables" : "🍳 Open Kitchen View"}
        </button>
      </div>

      {!showKitchenOnly && (
`;
    src = src.replace(match[0], btn + match[0] + '\n      )}');
    console.log('✅ Button added & Table Board wrapped');
  }
}

// 3. Wrap Kitchen Kanban
if (!src.includes('{showKitchenOnly && (<>')) {
  const startIndex = src.indexOf('{viewMode !== "desktop" && (');
  const endIndex = src.indexOf('{/* 🧾 NEW: ONE-SCREEN ORDER + BILL */}');
  
  if (startIndex !== -1 && endIndex !== -1) {
    const part1 = src.slice(0, startIndex);
    const part2 = src.slice(startIndex, endIndex);
    const part3 = src.slice(endIndex);
    src = part1 + `{showKitchenOnly && (<>\n` + part2 + `</>)}\n\n` + part3;
    console.log('✅ Kitchen Kanban wrapped');
  }
}

fs.writeFileSync(path, src);
console.log('Done. Now restart Vite.');