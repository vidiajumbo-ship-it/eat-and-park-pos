import fs from "fs";
const p = "src/App.jsx";
const raw = fs.readFileSync(p, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
const fail = (m) => { console.log("FAIL: " + m + " -> kuch nahi likha"); process.exit(1); };

if (s.includes("ENP-CUSTOMER-UI")) { console.log("Pehle se laga hai, skip"); process.exit(0); }

// ---- Region A: waiter buttons + hero + combos + flash + categories + menu + footer ----
const aStart = s.indexOf("<button onClick={() => { requestWaiter(table);");
const aEnd = s.indexOf("{aiSuggestion && !cartOpen && !activeModal && (");
if (aStart < 0 || aEnd < 0 || aEnd < aStart) fail("Region A nahi mila");

// ---- Region B: hamburger + cart bar ----
const hb = s.indexOf("onClick={() => setShowSidebar(true)} style={{ position: \"fixed\", top: 16, left: 16");
if (hb < 0) fail("hamburger nahi mila");
const bStart = s.lastIndexOf("{!cartOpen && !activeModal && (", hb);
const bEnd = s.indexOf("{showSidebar && (", hb);
if (bStart < 0 || bEnd < 0) fail("Region B nahi mila");

const WRAP_OLD = 'background: "var(--bg-color, #fff)", minHeight: "100vh", position: "relative" }}>';
if (!s.includes(WRAP_OLD)) fail("wrapper nahi mila");

const REGION_A = String.raw`{/* ENP-CUSTOMER-UI */}
      <style>{"body{background:#0B111A}.enp-hs::-webkit-scrollbar{display:none}.enp-hs{scrollbar-width:none}"}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 60, background: "rgba(11,17,26,0.94)", backdropFilter: "blur(10px)", borderBottom: "1px solid #273449", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setShowSidebar(true)} aria-label="Menu" style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid #273449", background: "#161F2F", color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>☰</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 17, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Eat & Park</div>
          <div style={{ fontSize: 11, color: "#8B9BB4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{RESTAURANT.tagline}</div>
        </div>
        <select value={table} onChange={(e) => setTable(Number(e.target.value))} style={{ background: "#161F2F", color: "#fff", border: "1px solid #273449", borderRadius: 10, padding: "9px 8px", fontWeight: 800, fontSize: 13, outline: "none" }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (<option key={n} value={n} style={{ color: "#000" }}>Table {n}</option>))}
        </select>
        <button onClick={() => { requestWaiter(table); showToast("🔔 Waiter notified!", 'success'); }} title="Waiter Call" style={{ width: 40, height: 40, borderRadius: 12, border: "none", background: "#EF4444", color: "#fff", fontSize: 17, cursor: "pointer", flexShrink: 0 }}>🔔</button>
        <button onClick={() => { if (waiterUnlocked) setShowWaiterMode(true); else setShowWaiterPinModal(true); }} title="Waiter Mode" style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid #273449", background: waiterUnlocked ? "#3B82F6" : "#161F2F", color: "#fff", fontSize: 17, cursor: "pointer", flexShrink: 0 }}>{waiterUnlocked ? "🧑‍🍳" : "🔒"}</button>
      </div>

      <div style={{ margin: "14px 14px 0", position: "relative", height: 150, borderRadius: 20, overflow: "hidden", border: "1px solid #273449" }}>
        <div className="keep-color" style={{ position: "absolute", inset: 0, backgroundImage: "url('" + (settings?.heroImage || "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80") + "')", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(11,17,26,0.96) 0%, rgba(11,17,26,0.4) 65%, rgba(11,17,26,0.15) 100%)" }} />
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{RESTAURANT.name}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={"tel:" + RESTAURANT.phones[0]} style={{ background: "rgba(255,255,255,0.14)", color: "#fff", padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>📞 Call</a>
            <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer" style={{ background: "rgba(255,255,255,0.14)", color: "#fff", padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>⭐ Rate us</a>
          </div>
        </div>
      </div>

      {myActiveOrders.length > 0 && (
        <div style={{ padding: "12px 14px 0", display: "flex", gap: 8 }}>
          <button onClick={() => setActiveModal('track')} style={{ flex: 1, background: "#0A2A20", border: "1.5px solid #10B981", color: "#10B981", borderRadius: 14, padding: 12, fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: 14 }}>
            <span>📦 {myActiveOrders.length} Active Order{myActiveOrders.length > 1 ? 's' : ''}</span><span>Track ➔</span>
          </button>
          <button onClick={() => setRunningOrderId(myActiveOrders[0].id)} style={{ background: "#3B82F6", color: "#fff", border: "none", borderRadius: 14, padding: "0 16px", fontWeight: 800, cursor: "pointer", fontSize: 18 }}>➕</button>
        </div>
      )}

      {!searchQuery.trim() && comboOffers && comboOffers.filter((c) => c.active).length > 0 && (
        <div style={{ paddingTop: 18 }}>
          <div style={{ padding: "0 14px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 800, color: "#fff" }}>🎯 Combo Offers</div>
          <div className="enp-hs" style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 14px 4px" }}>
            {comboOffers.filter((c) => c.active).map((combo) => (
              <div key={combo.id} style={{ minWidth: 260, maxWidth: 260, flexShrink: 0, background: "linear-gradient(135deg, #1E293B 0%, #161F2F 100%)", border: "1px solid rgba(255,90,31,0.4)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 30 }}>{combo.image}</span>
                  <div style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 15, color: "#fff" }}>{combo.name}</div>
                  <span style={{ background: "#FF5A1F", color: "#fff", padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{combo.discount}% OFF</span>
                </div>
                <div style={{ fontSize: 12, color: "#8B9BB4", lineHeight: 1.5 }}>{(combo.items || []).map((i) => i.quantity + "× " + i.name).join(" · ")}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                  <div><span style={{ fontSize: 18, fontWeight: 800, color: "#FF8C5A" }}>₹{combo.finalPrice}</span> <span style={{ fontSize: 12, color: "#8B9BB4", textDecoration: "line-through" }}>₹{combo.totalPrice}</span></div>
                  <button onClick={() => addComboToCart(combo)} style={{ background: "#FF5A1F", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Add</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!searchQuery.trim() && flashSaleItems && flashSaleItems.filter((f) => f.active && (f.stock == null || f.stock > 0)).length > 0 && (
        <div style={{ paddingTop: 18 }}>
          <div style={{ padding: "0 14px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 800, color: "#EF4444" }}>⚡ Flash Sale</div>
          <div className="enp-hs" style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 14px 4px" }}>
            {flashSaleItems.filter((f) => f.active && (f.stock == null || f.stock > 0)).map((item) => (
              <div key={item.id} style={{ minWidth: 170, flexShrink: 0, background: "#161F2F", border: "1px solid rgba(239,68,68,0.5)", borderRadius: 16, padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#fff", marginBottom: 6 }}>🔥 {item.name}</div>
                <div style={{ marginBottom: 6 }}><span style={{ fontSize: 18, fontWeight: 800, color: "#EF4444" }}>₹{item.discountPrice}</span> <span style={{ fontSize: 12, color: "#8B9BB4", textDecoration: "line-through" }}>₹{item.price}</span></div>
                {item.stock != null && item.stock <= 5 && <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700, marginBottom: 6 }}>Sirf {item.stock} bache!</div>}
                <button onClick={() => addFlashSaleToCart(item)} style={{ width: "100%", background: "#EF4444", color: "#fff", border: "none", borderRadius: 10, padding: 8, fontWeight: 800, cursor: "pointer" }}>Add</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: "18px 14px 12px", display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Dish search karo..." className="keep-color" style={{ width: "100%", boxSizing: "border-box", padding: "13px 40px 13px 42px", background: "#161F2F", border: "1px solid #273449", borderRadius: 14, color: "#fff", fontSize: 15, outline: "none" }} />
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>🔍</span>
          {searchQuery && <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#8B9BB4", fontSize: 16, cursor: "pointer", padding: 6 }}>✕</button>}
        </div>
        <button onClick={() => setVegOnly(!vegOnly)} style={{ padding: "0 14px", borderRadius: 14, border: "1px solid " + (vegOnly ? "#10B981" : "#273449"), background: vegOnly ? "#0A2A20" : "#161F2F", color: vegOnly ? "#10B981" : "#8B9BB4", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
          <VegDot veg={true} />{vegOnly ? "Veg" : "All"}
        </button>
      </div>

      {!searchQuery.trim() && (
        <div className="enp-hs" style={{ position: "sticky", top: 60, zIndex: 50, display: "flex", gap: 8, overflowX: "auto", padding: "10px 14px", background: "#0B111A", borderBottom: "1px solid #273449" }}>
          {visibleCategories.map((c) => {
            const on = category === c;
            return (
              <button key={c} onClick={() => setCategory(c)} style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "8px 16px", borderRadius: 999, border: "1px solid " + (on ? "#FF5A1F" : "#273449"), background: on ? "#FF5A1F" : "#161F2F", color: on ? "#fff" : "#8B9BB4", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: on ? "0 6px 16px rgba(255,90,31,0.3)" : "none" }}>{c}</button>
            );
          })}
        </div>
      )}

      <div style={{ padding: "14px 14px 0" }}>
        {!searchQuery.trim() && filteredItems.length > 0 && (
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 21, fontWeight: 800, color: "#fff" }}>{category}</div>
            <div style={{ fontSize: 12, color: "#8B9BB4", fontWeight: 700 }}>{filteredItems.length} items</div>
          </div>
        )}
        {filteredItems.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "#8B9BB4" }}>
            <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.6 }}>{EMPTY_STATES[emptyReason].icon}</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#fff", marginBottom: 6 }}>{EMPTY_STATES[emptyReason].title}</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>{EMPTY_STATES[emptyReason].subtitle}</div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: viewMode === "desktop" ? "repeat(auto-fill, minmax(340px, 1fr))" : "1fr", gap: 12 }}>
          {filteredItems.map((item) => {
            const qty = getCartQty(cart[item.id]);
            const fav = favorites.includes(item.id);
            return (
              <div key={item.id} style={{ display: "flex", gap: 12, padding: 14, background: "#161F2F", border: "1px solid " + (qty > 0 ? "#FF5A1F" : "#273449"), borderRadius: 16, opacity: item.available ? 1 : 0.5, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <VegDot veg={item.veg} />
                    {item.isBestseller && <span style={{ fontSize: 10, color: "#FF8C5A", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>★ Bestseller</span>}
                    {searchQuery.trim() && <span style={{ fontSize: 10, color: "#8B9BB4", fontWeight: 700 }}>{item.category}</span>}
                  </div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.3, marginBottom: 3 }}>{item.name}</div>
                  {item.portion && <div style={{ fontSize: 11, color: "#8B9BB4", fontWeight: 600, marginBottom: 4 }}>{item.portion}</div>}
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 800, color: "#FF8C5A", marginBottom: 6 }}>{inr(item.price)}</div>
                  {item.desc && <div style={{ fontSize: 12, color: "#8B9BB4", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.desc}</div>}
                </div>
                <div style={{ width: 104, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ position: "relative", width: 104, height: 104 }}>
                    <img src={item.image} alt={item.name} loading="lazy" className="keep-color" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, filter: item.available ? "none" : "grayscale(1)" }} onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"; }} />
                    <button onClick={() => toggleFavorite(item.id)} aria-label="Favorite" style={{ position: "absolute", top: 5, right: 5, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(11,17,26,0.7)", color: fav ? "#FFB800" : "#fff", fontSize: 15, cursor: "pointer" }}>{fav ? "★" : "☆"}</button>
                  </div>
                  <div style={{ marginTop: -17, position: "relative", zIndex: 1 }}>
                    {!item.available ? (
                      <div style={{ background: "#451A1A", color: "#EF4444", borderRadius: 10, fontWeight: 800, fontSize: 11, padding: "9px 12px", whiteSpace: "nowrap" }}>Out of stock</div>
                    ) : qty === 0 ? (
                      <button onClick={() => handleSetQty(item.id, 1)} style={{ width: 88, height: 36, background: "#0B111A", border: "1.5px solid #FF5A1F", borderRadius: 10, color: "#FF5A1F", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 14px rgba(0,0,0,0.35)" }}>ADD</button>
                    ) : (
                      <div style={{ width: 88, height: 36, background: "#FF5A1F", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 6px 14px rgba(255,90,31,0.35)" }}>
                        <button onClick={() => handleSetQty(item.id, qty - 1)} style={{ width: 30, height: 36, border: "none", background: "transparent", color: "#fff", fontSize: 20, fontWeight: 800, cursor: "pointer" }}>−</button>
                        <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{qty}</span>
                        <button onClick={() => handleSetQty(item.id, qty + 1)} style={{ width: 30, height: 36, border: "none", background: "transparent", color: "#fff", fontSize: 20, fontWeight: 800, cursor: "pointer" }}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "30px 20px 70px", fontSize: 12, color: "#8B9BB4", lineHeight: 1.7 }}>
        📍 {RESTAURANT.address}<br />📞 {RESTAURANT.phones.join(" · ")}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14 }}>
          <button onClick={() => requestPinPrompt("staff")} style={{ background: "none", border: "1px solid #273449", color: "#8B9BB4", borderRadius: 10, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>🔒 Staff Login</button>
          <button onClick={() => requestPinPrompt("admin")} style={{ background: "none", border: "1px solid #273449", color: "#8B9BB4", borderRadius: 10, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>⚙️ Admin Login</button>
        </div>
      </div>

      `;

const REGION_B = String.raw`{cartCount > 0 && !cartOpen && !activeModal && (
        <button onClick={() => setCartOpen(true)} style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 28px)", maxWidth: 440, background: "linear-gradient(135deg, #FF5A1F 0%, #E04814 100%)", color: "#fff", border: "none", borderRadius: 16, padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, fontSize: 16, cursor: "pointer", zIndex: 55, boxShadow: "0 12px 30px rgba(255,90,31,0.45)" }}>
          <span>🛒 {cartCount} item{cartCount > 1 ? "s" : ""}</span><span>{inr(finalTotal)} ➔</span>
        </button>
      )}

      `;

// Pehle B (peeche wala) replace, phir A, taaki index na bigde
s = s.slice(0, bStart) + REGION_B + s.slice(bEnd);
s = s.slice(0, aStart) + REGION_A + s.slice(aEnd);
s = s.replace(WRAP_OLD, 'background: "#0B111A", color: "#fff", minHeight: "100vh", position: "relative" }}>');

fs.writeFileSync(p + ".bak3", raw);
fs.writeFileSync(p, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("OK: customer redesign lag gaya (backup: src/App.jsx.bak3)");