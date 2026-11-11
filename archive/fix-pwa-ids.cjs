const fs = require("fs");

// Unique IDs for each app
const customerManifest = {
  id: "/customer-app",
  name: "Eat & Park",
  short_name: "Eat&Park",
  start_url: "/",
  display: "standalone",
  background_color: "#0B111A",
  theme_color: "#E25938",
  icons: [{ src: "https://cdn-icons-png.flaticon.com/512/3075/3075977.png", sizes: "512x512", type: "image/png" }]
};

const staffManifest = {
  id: "/staff-app",
  name: "Eat & Park Staff",
  short_name: "Staff POS",
  start_url: "/staff",
  display: "standalone",
  background_color: "#161F2F",
  theme_color: "#FF5A1F",
  icons: [{ src: "https://cdn-icons-png.flaticon.com/512/3081/3081843.png", sizes: "512x512", type: "image/png" }]
};

const deliveryManifest = {
  id: "/delivery-app",
  name: "Eat & Park Delivery",
  short_name: "Delivery",
  start_url: "/delivery",
  display: "standalone",
  background_color: "#0B111A",
  theme_color: "#F59E0B",
  icons: [{ src: "https://cdn-icons-png.flaticon.com/512/2830/2830305.png", sizes: "512x512", type: "image/png" }]
};

// Save manifest files in public folder
if (!fs.existsSync("public")) fs.mkdirSync("public");
fs.writeFileSync("public/manifest.json", JSON.stringify(customerManifest, null, 2));
fs.writeFileSync("public/staff-manifest.json", JSON.stringify(staffManifest, null, 2));
fs.writeFileSync("public/delivery-manifest.json", JSON.stringify(deliveryManifest, null, 2));

console.log("✅ Unique IDs ke saath manifest files update ho gayi hain!");

// Update index.html to load manifest dynamically based on URL (if not already done)
const HTML_FILE = "index.html";
if (fs.existsSync(HTML_FILE)) {
  let html = fs.readFileSync(HTML_FILE, "utf8");

  // Remove existing manifest link if any
  html = html.replace(/<link[^>]*rel="manifest"[^>]*>/g, "");

  const script = `
    <!-- PWA Dynamic Manifest Setup -->
    <link id="app-manifest" rel="manifest" href="/manifest.json">
    <script>
      (function() {
        var path = window.location.pathname;
        var manifestUrl = "/manifest.json";
        
        if (path.startsWith("/staff")) {
          manifestUrl = "/staff-manifest.json";
          document.title = "Eat & Park Staff";
        } else if (path.startsWith("/delivery")) {
          manifestUrl = "/delivery-manifest.json";
          document.title = "Eat & Park Delivery";
        } else {
          document.title = "Eat & Park";
        }
        
        document.getElementById("app-manifest").setAttribute("href", manifestUrl);
      })();
    </script>
  `;

  html = html.replace("</head>", script + "\n</head>");
  fs.writeFileSync(HTML_FILE, html);
  console.log("✅ index.html me dynamic PWA setup check ho gaya!");
}