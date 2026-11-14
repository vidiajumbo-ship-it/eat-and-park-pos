import React, { useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function QRGenerator() {
  const [tableCount, setTableCount] = useState(20);
  const [paper, setPaper] = useState("thermal"); // "thermal" (80mm) | "a4"
  const [printOnly, setPrintOnly] = useState(null); // table number or null = all
  const BASE_URL = "https://eatndpark.vercel.app";

  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);

  // After the print dialog closes, go back to "print all" mode
  useEffect(() => {
    const reset = () => setPrintOnly(null);
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  const printAll = () => {
    setPrintOnly(null);
    setTimeout(() => window.print(), 50);
  };

  const printOne = (num) => {
    setPrintOnly(num);
    setTimeout(() => window.print(), 50); // wait for React to hide other cards
  };

  return (
    <div style={{ padding: 20, background: "#FAFAF8", minHeight: "100vh", fontFamily: "system-ui" }}>
      {/* Page size depends on selected paper */}
      <style>{
        paper === "thermal"
          ? `@media print { @page { size: 80mm 100mm; margin: 0; } }`
          : `@media print { @page { size: A4 portrait; margin: 10mm; } }`
      }</style>

      {/* Screen-only controls */}
      <div className="no-print" style={{ textAlign: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: "#FF5A1F", fontSize: 22, fontWeight: 900 }}>🍽️ Table QR Codes</h1>
        <p style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
          {paper === "thermal"
            ? "Thermal 80mm (TVS RP3160 Gold): 1 table = 1 slip"
            : "A4: 1 page = 1 QR"}
        </p>
      </div>

      <div
        className="no-print"
        style={{
          background: "#fff", padding: 14, borderRadius: 12, maxWidth: 560,
          margin: "0 auto 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          display: "flex", gap: 10, alignItems: "center", justifyContent: "center", flexWrap: "wrap",
        }}
      >
        <label style={{ fontWeight: 700, fontSize: 13 }}>Total Tables:</label>
        <input
          type="number" min="1" max="100" value={tableCount}
          onChange={(e) => setTableCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 15, fontWeight: 700, width: 64, textAlign: "center" }}
        />
        <select
          value={paper}
          onChange={(e) => setPaper(e.target.value)}
          style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, fontWeight: 700 }}
        >
          <option value="thermal">Thermal 80mm</option>
          <option value="a4">A4</option>
        </select>
        <button
          onClick={printAll}
          style={{ padding: "9px 18px", background: "#FF5A1F", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          🖨️ Print All
        </button>
      </div>

      {/* Print Container */}
      <div className={`qr-container paper-${paper}`}>
        {tables.map((num) => {
          const tableUrl = `${BASE_URL}/?table=${num}`;
          const hidden = printOnly !== null && printOnly !== num;
          return (
            <div key={num} className={`qr-card${hidden ? " skip-print" : ""}`}>
              <div className="brand-name"><span className="emoji">🍽️ </span>Eat &amp; Park</div>
              <div className="table-badge">Table {num}</div>
              <div className="qr-code-wrapper">
                <QRCodeCanvas value={tableUrl} size={600} level="H" includeMargin={true} />
              </div>
              <div className="scan-text"><span className="emoji">📱 </span>SCAN TO ORDER</div>
              <div className="tagline">Table par baith kar apna khana order karein</div>
              <button className="no-print one-btn" onClick={() => printOne(num)}>
                🖨️ Print this table
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        /* ---------- Screen (compact) ---------- */
        .qr-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 12px;
          max-width: 1100px;
          margin: 0 auto;
        }
        .qr-card {
          background: #fff;
          padding: 14px 12px;
          border-radius: 12px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border: 2px solid #FF5A1F;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .brand-name { font-size: 16px; font-weight: 900; color: #FF5A1F; margin-bottom: 4px; }
        .table-badge {
          font-size: 14px; font-weight: 800; color: #333; margin-bottom: 6px;
          padding: 3px 14px; background: #FFF5EF; border-radius: 20px; display: inline-block;
        }
        .qr-code-wrapper { margin: 2px 0 6px; width: 100%; display: flex; justify-content: center; }
        .qr-code-wrapper canvas { width: 100% !important; max-width: 170px !important; height: auto !important; }
        .scan-text { font-size: 14px; font-weight: 900; color: #FF5A1F; letter-spacing: 0.5px; margin-bottom: 2px; }
        .tagline { font-size: 11px; color: #666; font-weight: 500; }
        .one-btn {
          margin-top: 8px; padding: 5px 12px; font-size: 11px; font-weight: 700;
          background: #FFF5EF; color: #FF5A1F; border: 1px solid #FF5A1F; border-radius: 6px; cursor: pointer;
        }

        /* ---------- Print ---------- */
        @media print {
          html, body {
            margin: 0 !important; padding: 0 !important; background: #fff !important;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .no-print, .skip-print { display: none !important; }
          .qr-container { display: block !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
          .qr-card:last-child { break-after: auto; page-break-after: auto; }

          /* ===== Thermal 80mm (printable width ~72mm) ===== */
          .paper-thermal .qr-card {
            width: 72mm;
            height: 98mm;
            margin: 0 auto !important;
            padding: 3mm 2mm !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #fff !important;
            box-sizing: border-box;
            justify-content: center;
            break-after: page; page-break-after: always;
            break-inside: avoid; page-break-inside: avoid;
          }
          .paper-thermal .emoji { display: none !important; } /* emojis print badly on thermal */
          .paper-thermal .brand-name { font-size: 16pt !important; color: #000 !important; margin: 0 0 1.5mm !important; }
          .paper-thermal .table-badge {
            font-size: 14pt !important; color: #000 !important; background: #fff !important;
            border: 1.5pt solid #000 !important; padding: 0.5mm 5mm !important; margin: 0 0 1mm !important;
          }
          .paper-thermal .qr-code-wrapper { margin: 1mm 0 !important; }
          .paper-thermal .qr-code-wrapper canvas {
            width: 58mm !important; height: 58mm !important;
            max-width: 58mm !important; max-height: 58mm !important;
            image-rendering: pixelated;
          }
          .paper-thermal .scan-text { font-size: 13pt !important; color: #000 !important; margin: 1mm 0 0 !important; letter-spacing: 1pt !important; }
          .paper-thermal .tagline { font-size: 8pt !important; color: #000 !important; margin-top: 0.5mm !important; }

          /* ===== A4 (original big layout) ===== */
          .paper-a4 .qr-card {
            width: 100%; height: 100vh; margin: 0 !important; padding: 20mm !important;
            border: 3px dashed #000 !important; box-shadow: none !important; border-radius: 0 !important;
            box-sizing: border-box; justify-content: center; background: #fff !important;
            break-after: page; page-break-after: always; break-inside: avoid; page-break-inside: avoid;
          }
          .paper-a4 .brand-name { font-size: 32pt !important; color: #000 !important; margin-bottom: 10pt !important; }
          .paper-a4 .table-badge {
            font-size: 24pt !important; background: #fff !important; border: 2pt solid #000 !important;
            color: #000 !important; padding: 6pt 24pt !important; margin-bottom: 20pt !important; border-radius: 30pt !important;
          }
          .paper-a4 .qr-code-wrapper { margin: 10pt 0 20pt !important; }
          .paper-a4 .qr-code-wrapper canvas {
            width: 140mm !important; height: 140mm !important; max-width: 140mm !important; max-height: 140mm !important;
          }
          .paper-a4 .scan-text { font-size: 24pt !important; color: #000 !important; margin-top: 10pt !important; letter-spacing: 2pt !important; }
          .paper-a4 .tagline { font-size: 12pt !important; color: #333 !important; margin-top: 5pt !important; }
        }
      `}</style>
    </div>
  );
}
