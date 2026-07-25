import { useState } from "react";

function pad(n) { return String(n).padStart(2, "0"); }
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

export default function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [y, m, d] = value.split("-").map(Number);
  const [viewY, setViewY] = useState(y);
  const [viewM, setViewM] = useState(m);

  function selectDay(day) {
    onChange(`${viewY}-${pad(viewM)}-${pad(day)}`);
    setOpen(false);
  }
  function prevMonth() {
    if (viewM === 1) { setViewY(viewY - 1); setViewM(12); } else setViewM(viewM - 1);
  }
  function nextMonth() {
    if (viewM === 12) { setViewY(viewY + 1); setViewM(1); } else setViewM(viewM + 1);
  }

  const firstDow = new Date(viewY, viewM - 1, 1).getDay();
  const leadBlank = (firstDow + 6) % 7; // Monday-first layout
  const totalDays = daysInMonth(viewY, viewM);
  const monthLabel = new Date(viewY, viewM - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const displayDate = new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setViewY(y); setViewM(m); }}
        style={{
          background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 14px",
          fontSize: 13.5, fontWeight: 600, color: "var(--navy)", cursor: "pointer", fontFamily: "'Inter',sans-serif",
          display: "flex", alignItems: "center", gap: 8, textTransform: "none",
        }}
      >
        <span style={{ color: "var(--wine)" }}>📅</span> {displayDate}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "110%", left: 0, zIndex: 50, background: "#fff",
          border: "1px solid var(--line)", borderRadius: 12, padding: 14,
          boxShadow: "0 14px 34px rgba(22,35,63,0.18)", width: 240,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <button type="button" onClick={prevMonth} style={{ background: "none", border: "1px solid var(--line)", borderRadius: 6, padding: "3px 9px", cursor: "pointer", color: "var(--ink-soft)" }}>&larr;</button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy)", fontFamily: "'Fraunces',Georgia,serif" }}>{monthLabel}</span>
            <button type="button" onClick={nextMonth} style={{ background: "none", border: "1px solid var(--line)", borderRadius: 6, padding: "3px 9px", cursor: "pointer", color: "var(--ink-soft)" }}>&rarr;</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, fontSize: 10, color: "var(--ink-soft)", textAlign: "center", marginBottom: 4, fontWeight: 700 }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => <span key={i}>{label}</span>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {Array.from({ length: leadBlank }).map((_, i) => <span key={"b" + i} />)}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const isSelected = viewY === y && viewM === m && day === d;
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => selectDay(day)}
                  style={{
                    padding: "6px 0", fontSize: 12, border: "none", borderRadius: 6, cursor: "pointer",
                    background: isSelected ? "var(--wine)" : "transparent",
                    color: isSelected ? "#fff" : "var(--ink)",
                    fontWeight: isSelected ? 700 : 400,
                  }}
                  onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--wine-pale)"; }}
                  onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
