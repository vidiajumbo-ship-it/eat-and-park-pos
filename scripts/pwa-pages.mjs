import fs from 'fs';

const apps = {
  staff:    { manifest: '/staff-manifest.json',    title: 'Eat & Park Staff',    icon: '/icons/staff-180.png' },
  delivery: { manifest: '/delivery-manifest.json', title: 'Eat & Park Delivery', icon: '/icons/delivery-180.png' },
};

const base = fs.readFileSync('dist/index.html', 'utf8');
if (!base.includes('href="/manifest.json"')) console.warn('WARN: index.html me manifest link nahi mila');
if (!base.includes('href="/icons/customer-180.png"')) console.warn('WARN: index.html me apple-touch-icon nahi mila');

for (const [name, a] of Object.entries(apps)) {
  const html = base
    .replace('href="/manifest.json"', `href="${a.manifest}"`)
    .replace('href="/icons/customer-180.png"', `href="${a.icon}"`)
    .replace(/<title>.*?<\/title>/, `<title>${a.title}</title>`)
    .replace('content="Eat & Park"', `content="${a.title}"`);
  fs.mkdirSync(`dist/${name}`, { recursive: true });
  fs.writeFileSync(`dist/${name}/index.html`, html);
}

