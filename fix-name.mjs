import fs from 'fs';

const staffPath = 'src/StaffApp.jsx';
let staffCode = fs.readFileSync(staffPath, 'utf8');

// 1. Sidebar Branding Fix
staffCode = staffCode.replace(
  /<div style=\{\{ fontWeight: 800, fontSize: 16 \}\}>Velox POS<\/div>/g,
  '<div style={{ fontWeight: 800, fontSize: 15 }}>Eat & Park Restaurant</div>'
);
staffCode = staffCode.replace(
  /<div style=\{\{ fontSize: 11, color: C\.gray \}\}>Restaurant Command<\/div>/g,
  '<div style={{ fontSize: 11, color: C.gray }}>Staff Panel</div>'
);

// 2. Login Screen Branding Fix
staffCode = staffCode.replace(
  /<div style=\{\{ fontSize: 24, fontWeight: 800, color: C\.ink \}\}>Velox POS<\/div>/g,
  '<div style={{ fontSize: 24, fontWeight: 800, color: C.ink }}>Eat & Park</div>'
);
staffCode = staffCode.replace(
  /<div style=\{\{ fontSize: 13, color: C\.gray, marginTop: 4 \}\}>Restaurant Command<\/div>/g,
  '<div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>Restaurant Command</div>'
);

// 3. Top Orange Bar Text Fix (Jo mobile pe dikhta hai)
staffCode = staffCode.replace(
  />Eat & Park<\/div>/g,
  '>Eat & Park Restaurant</div>'
);

fs.writeFileSync(staffPath, staffCode);
console.log('✅ Naam badal diya gaya hai! Ab "Eat & Park Restaurant" dikhega.');