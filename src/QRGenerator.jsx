import React from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function QRGenerator() {
  const BASE_URL = window.location.origin; 
  const tables = Array.from({ length: 20 }, (_, i) => i + 1);

  return (
    <div style={{ padding: 40, background: "#fff", color: "#000", minHeight: "100vh", fontFamily: "system-ui" }}>
      <h1 style={{ textAlign: "center", marginBottom: 30 }}>Eat & Park - Table QR Codes</h1>
      <div style={{ border: "4px solid #f97316", padding: 30, textAlign: "center", borderRadius: 20, maxWidth: 300, margin: "0 auto 40px auto", background: "#fff7ed" }}>
        <h2 style={{ margin: "0 0 15px 0", color: "#f97316", fontSize: 28 }}>🛍️ Parcel / Takeaway</h2>
        <QRCodeCanvas value={BASE_URL + "/?view=menu"} size={200} />
        <p style={{ fontSize: 10, color: "#666", marginTop: 10, wordBreak: "break-all" }}>{BASE_URL}/?view=menu</p>
      </div>
      <h2 style={{ textAlign: "center", marginBottom: 20, borderTop: "2px dashed #ccc", paddingTop: 20 }}>Dine-in Tables</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginTop: 40 }}>
        {tables.map((num) => {
          const tableUrl = BASE_URL + "/?view=menu&table=" + num;
          return (
            <div key={num} style={{ border: "2px dashed #ccc", padding: 20, textAlign: "center", borderRadius: 10 }}>
              <h2 style={{ margin: "0 0 15px 0", color: "#f97316" }}>Table {num}</h2>
              <QRCodeCanvas value={tableUrl} size={150} />
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", marginTop: 40 }}>
        <button onClick={() => window.print()} style={{ padding: "12px 24px", background: "#f97316", color: "#fff", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "bold", cursor: "pointer" }}>🖨️ Print All QRs</button>
      </div>
    </div>
  );
}
