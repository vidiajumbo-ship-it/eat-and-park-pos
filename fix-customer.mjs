import fs from 'fs';

const appPath = 'src/App.jsx';
let appCode = fs.readFileSync(appPath, 'utf8');

// Wapas original Elegant Customer Theme
const originalAppColors = `
const COLORS = {
  ink: "#1A1A1A", paper: "#FAFAF8", paper2: "#F0EFEB",
  copper: "#E25938", copperDark: "#C1442D", copperLight: "#F5E8E3",
  rust: "#C0392B", sage: "#4A7C59", sageDark: "#2F5C3F", sageLight: "#E8F0EB",
  gold: "#D4A574", line: "#E8E6DC", text: "#3C3C3C", textLight: "#8A8375",
  success: "#10B981", error: "#EF4444", warning: "#FF9800", info: "#3B82F6",
  google: "#4285F4", razorpay: "#0B4F6C", phonepe: "#5F259F"
};
`;

// Replace the dark COLORS with original light COLORS
appCode = appCode.replace(/const COLORS = \{[\s\S]*?\};/m, originalAppColors.trim());

fs.writeFileSync(appPath, appCode);
console.log('✅ Customer Panel (App.jsx) wapas apne original elegant theme mein aa gaya hai!');