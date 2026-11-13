import React, { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function QRGenerator() {
  const [tableCount, setTableCount] = useState(20);
  const BASE_URL = window.location.origin;

  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ padding: 30, background: "#FAFAF8", minHeight: "100vh", fontFamily: "system-ui" }}>
      
      {/* Screen-only controls */}
      <div className="no-print" style={{ textAlign: "center", marginBottom: 30 }}>
        <h1 style={{ margin: 0, color: "#FF5A1F", fontSize: 28, fontWeight: 900 }}>
          🍽️ Table QR Codes
        </h1>
        <p style={{ color: "#666", marginTop: 8, fontSize: 14 }}>
          Print karein (1 page = 1 QR, A4 size)
        </p>
      </div>

      <div className="no-print" style={{ 
        background: "#fff", padding: 20, borderRadius: 12, 
        maxWidth: 500, margin: "0 auto 30px", 
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex", gap: 12, alignItems: "center", justifyContent: "center", flexWrap: "wrap"
      }}>
        <label style={{ fontWeight: 700, fontSize: 14 }}>Total Tables:</label>
        <input
          type="number" min="1" max="100"
          value={tableCount}
          onChange={(e) => setTableCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 16, fontWeight: 700, width: 80, textAlign: "center" }}
        />
        <button onClick={handlePrint} style={{ padding: "10px 24px", background: "#FF5A1F", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          🖨️ Print All QR Codes
        </button>
      </div>

      {/* Print Container */}
      <div className="qr-container">
        {tables.map((num) => {
          const tableUrl = `${BASE_URL}/?table=${num}`;
          return (
            <div key={num} className="qr-card">
              <div className="brand-name">🍽️ Eat & Park Restaurant</div>
              <div className="table-badge">Table {num}</div>
              <div className="qr-code-wrapper">
                <QRCodeCanvas 
                  value={tableUrl} 
                  size={600} 
                  level="H" 
                  includeMargin={true}
                  style={{ width: "100%", height: "auto", maxWidth: "450px" }}
                />
              </div>
              <div className="scan-text">📱 SCAN TO ORDER</div>
              <div className="tagline">Table par baith kar apna khana order karein</div>
            </div>
          );
        })}
      </div>

      <style>{`
        .qr-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .qr-card {
          background: #fff;
          padding: 30px;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border: 2px solid #FF5A1F;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .brand-name {
          font-size: 24px;
          font-weight: 900;
          color: #FF5A1F;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }

        .table-badge {
          font-size: 18px;
          font-weight: 800;
          color: #333;
          margin-bottom: 20px;
          padding: 6px 20px;
          background: #FFF5EF;
          border-radius: 20px;
          display: inline-block;
        }

        .qr-code-wrapper {
          margin: 10px 0 20px;
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .qr-code-wrapper canvas {
          width: 100% !important;
          max-width: 450px !important;
          height: auto !important;
        }

        .scan-text {
          font-size: 18px;
          font-weight: 900;
          color: #FF5A1F;
          letter-spacing: 1px;
          margin-bottom: 6px;
        }

        .tagline {
          font-size: 12px;
          color: #666;
          font-weight: 500;
        }

        /* Print styles — A4, 1 QR per page, BIG */
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .no-print {
            display: none !important;
          }

          .qr-container {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .qr-card {
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            width: 100%;
            height: 100vh;
            margin: 0 !important;
            padding: 20mm !important;
            border: 3px dashed #000 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #fff !important;
          }

          .qr-card:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .brand-name {
            font-size: 32pt !important;
            color: #000 !important;
            margin-bottom: 10pt !important;
            font-weight: 900 !important;
          }

          .table-badge {
            font-size: 24pt !important;
            background: #fff !important;
            border: 2pt solid #000 !important;
            color: #000 !important;
            padding: 6pt 24pt !important;
            margin-bottom: 20pt !important;
            border-radius: 30pt !important;
            font-weight: 900 !important;
          }

          .qr-code-wrapper {
            width: 100% !important;
            display: flex !important;
            justify-content: center !important;
            margin: 10pt 0 20pt !important;
          }

          .qr-code-wrapper canvas {
            width: 140mm !important;
            height: 140mm !important;
            max-width: 140mm !important;
            max-height: 140mm !important;
          }

          .scan-text {
            font-size: 24pt !important;
            color: #000 !important;
            margin-top: 10pt !important;
            font-weight: 900 !important;
            letter-spacing: 2pt !important;
          }

          .tagline {
            font-size: 12pt !important;
            color: #333 !important;
            margin-top: 5pt !important;
          }
        }
      `}</style>
    </div>
  );
}
