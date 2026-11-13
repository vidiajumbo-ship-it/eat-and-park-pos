import { useState } from "react";
import { createPortal } from "react-dom";
import PartyBooking from "./PartyBooking";

export default function PartyBookingFAB() {
  const [open, setOpen] = useState(false);
  
  // Button jo screen ke ekdum bahar (body me) render hoga
  const buttonElement = (
    <button 
      onClick={() => setOpen(true)} 
      title="Party Booking"
      style={{ 
        position: "fixed", 
        right: "24px", 
        bottom: "24px", 
        zIndex: 99999, 
        width: "60px", 
        height: "60px", 
        borderRadius: "50%", 
        background: "#f97316", 
        color: "#fff", 
        border: "none", 
        fontSize: "28px", 
        cursor: "pointer", 
        boxShadow: "0 4px 20px rgba(249, 115, 22, 0.4)", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        transition: "transform 0.2s"
      }}
      onMouseEnter={(e) => e.target.style.transform = "scale(1.05)"}
      onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
    >
      🎉
    </button>
  );

  // Modal jo open hone par body me render hoga
  const modalElement = open ? (
    <div 
      onClick={() => setOpen(false)} 
      style={{ 
        position: "fixed", 
        inset: 0, 
        zIndex: 99999, 
        background: "rgba(0,0,0,0.8)", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        padding: "20px" 
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          background: "#0f172a", 
          borderRadius: "12px", 
          maxWidth: "900px", 
          width: "100%", 
          height: "95vh", 
          overflow: "hidden", 
          position: "relative", 
          border: "1px solid #334155", 
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)", 
          display: "flex", 
          flexDirection: "column" 
        }}
      >
        <PartyBooking onClose={() => setOpen(false)} />
      </div>
    </div>
  ) : null;

  return (
    <>
      {createPortal(buttonElement, document.body)}
      {createPortal(modalElement, document.body)}
    </>
  );
}
