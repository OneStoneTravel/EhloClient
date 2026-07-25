import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { startOfWeekStr, addDaysStr, weekLabel, hoursWorked, logActivity } from "../shared";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Timesheets({ session, onNavigate }) {
  const [weekStart, setWeekStart] = useState(startOfWeekStr());
  const [staffList, setStaffList] = useState([]);
  const [entries, setEntries] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ clock_in: "", lunch_out: "", lunch_in: "", clock_out: "", hourly_rate: "" });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i));
  const weekEnd = addDaysStr(weekStart, 7);

  async function load() {
    const { data: s } = await supabase.from("staff").select("*").order("full_name");
    setStaffList(s || []);
    const { data: e } = await supabase.from("timesheets").select("*").gte("work_date", weekStart).lt("work_date", weekEnd);
    setEntries(e || []);
  }
  useEffect(() => { load(); }, [weekStart]);

  // Roster = staff active during this week, plus anyone with real entries that week
  // (covers someone terminated mid-week, or looking back at a past week's history).
  const roster = Array.from(new Set([
    ...staffList.filter((s) => s.status === "active" || (s.termination_date && s.termination_date >= weekStart)).map((s) => s.full_name),
    ...entries.map((e) => e.staff_name),
  ]));

  function entryFor(staffName, date) {
    return entries.find((e) => e.staff_name === staffName && e.work_date === date);
  }
  function defaultRateFor(staffName) {
    const s = staffList.find((st) => st.full_name === staffName);
    return s ? Number(s.hourly_rate) || 0 : 0;
  }

  function openCell(staffName, date) {
    const existing = entryFor(staffName, date);
    setEditing({ staffName, date });
    setEditForm({
      clock_in: existing?.clock_in?.slice(0, 5) || "",
      lunch_out: existing?.lunch_out?.slice(0, 5) || "",
      lunch_in: existing?.lunch_in?.slice(0, 5) || "",
      clock_out: existing?.clock_out?.slice(0, 5) || "",
      hourly_rate: existing?.hourly_rate ?? defaultRateFor(staffName),
    });
  }

  async function saveCell() {
    const { staffName, date } = editing;
    await supabase.from("timesheets").upsert({
      staff_name: staffName,
      work_date: date,
      clock_in: editForm.clock_in || null,
      lunch_out: editForm.lunch_out || null,
      lunch_in: editForm.lunch_in || null,
      clock_out: editForm.clock_out || null,
      hourly_rate: parseFloat(editForm.hourly_rate) || 0,
      created_by: session.user.email,
    }, { onConflict: "staff_name,work_date" });
    await logActivity(session, `logged time for ${staffName} on ${date}.`);
    setEditing(null);
    load();
  }

  async function clearCell() {
    const { staffName, date } = editing;
    await supabase.from("timesheets").delete().eq("staff_name", staffName).eq("work_date", date);
    setEditing(null);
    load();
  }

  function rowTotals(staffName) {
    const rows = entries.filter((e) => e.staff_name === staffName);
    const hours = rows.reduce((s, e) => s + hoursWorked(e), 0);
    const pay = rows.reduce((s, e) => s + hoursWorked(e) * Number(e.hourly_rate || 0), 0);
    return { hours, pay };
  }

  const grandHours = roster.reduce((s, name) => s + rowTotals(name).hours, 0);
  const grandPay = roster.reduce((s, name) => s + rowTotals(name).pay, 0);

  function printWeeklyReport() {
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Weekly Timesheet — ${weekLabel(weekStart)}</title>
      <style>
        body{font-family:Georgia,serif;padding:40px;color:#23262B;max-width:640px;margin:0 auto;}
        h1{font-size:20px;margin-bottom:2px;}
        .meta{color:#5B6270;font-size:13px;margin-bottom:24px;}
        table{width:100%;border-collapse:collapse;font-size:13px;}
        td,th{padding:7px 0;border-bottom:1px solid #E2E6EB;text-align:left;}
        td:last-child,th:last-child{text-align:right;}
      </style></head><body>
      <h1>OneStone Travel — Weekly Timesheet</h1>
      <div class="meta">${weekLabel(weekStart)}</div>
      <table>
        <tr><th>Staff</th><th>Hours</th><th>Pay</th></tr>
        ${roster.map((name) => {
          const t = rowTotals(name);
          return `<tr><td>${name}</td><td>${t.hours.toFixed(2)}</td><td>$${t.pay.toFixed(2)}</td></tr>`;
        }).join("")}
        <tr><td><b>Total</b></td><td><b>${grandHours.toFixed(2)}</b></td><td><b>$${grandPay.toFixed(2)}</b></td></tr>
      </table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  return (
    <div className="panel">
      <div className="sec-head" style={{ margin: "0 0 16px" }}>
        <h2 style={{ margin: 0 }}>Time — Weekly Timecards</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="ghost" onClick={() => setWeekStart(addDaysStr(weekStart, -7))}>&larr;</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{weekLabel(weekStart)}</span>
          <button className="ghost" onClick={() => setWeekStart(addDaysStr(weekStart, 7))}>&rarr;</button>
          {weekStart !== startOfWeekStr() && <button className="ghost" onClick={() => setWeekStart(startOfWeekStr())}>This week</button>}
        </div>
      </div>

      <div className="tbl-wrap" style={{ overflowX: "auto", marginBottom: 16 }}>
        <table className="k">
          <thead>
            <tr>
              <th>Staff</th>
              {weekDays.map((d, i) => <th key={d}>{DAY_NAMES[i]}<br /><span style={{ fontWeight: 400 }}>{d.slice(5)}</span></th>)}
              <th>Hours</th><th>Pay</th>
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 ? (
              <tr><td colSpan={10} className="empty">No active staff yet — add someone in the Staff tab.</td></tr>
            ) : (
              roster.map((name) => {
                const t = rowTotals(name);
                return (
                  <tr key={name}>
                    <td className="cnum">{name}</td>
                    {weekDays.map((d) => {
                      const e = entryFor(name, d);
                      const h = hoursWorked(e);
                      return (
                        <td key={d} style={{ cursor: "pointer" }} onClick={() => openCell(name, d)}>
                          {h > 0 ? h.toFixed(1) : <span className="muted">—</span>}
                        </td>
                      );
                    })}
                    <td style={{ fontWeight: 600 }}>{t.hours.toFixed(1)}</td>
                    <td style={{ fontWeight: 600 }}>${t.pay.toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: -8 }}>
        Adding, removing, or terminating staff happens in the{" "}
        <button className="ghost" style={{ padding: "1px 8px" }} onClick={() => onNavigate && onNavigate("team")}>Staff tab</button>{" "}
        — that keeps this roster accurate even after switching tabs.
      </p>

      <div className="section-label">Weekly report</div>
      <button className="navy" onClick={printWeeklyReport}>Print weekly report</button>

      {editing && (
        <div className="modal-overlay show" onClick={(ev) => { if (ev.target === ev.currentTarget) setEditing(null); }}>
          <div className="modal-box time-modal">
            <h3>{editing.staffName}</h3>
            <div className="modal-sub">{editing.date}</div>

            <div className="time-punch-grid">
              <div className="time-punch-field">
                <label>Clock in</label>
                <input type="time" value={editForm.clock_in} onChange={(e) => setEditForm({ ...editForm, clock_in: e.target.value })} />
              </div>
              <div className="time-punch-field">
                <label>Lunch out</label>
                <input type="time" value={editForm.lunch_out} onChange={(e) => setEditForm({ ...editForm, lunch_out: e.target.value })} />
              </div>
              <div className="time-punch-field">
                <label>Lunch in <span className="muted" style={{ fontWeight: 400 }}>(back from lunch)</span></label>
                <input type="time" value={editForm.lunch_in} onChange={(e) => setEditForm({ ...editForm, lunch_in: e.target.value })} />
              </div>
              <div className="time-punch-field">
                <label>Clock out</label>
                <input type="time" value={editForm.clock_out} onChange={(e) => setEditForm({ ...editForm, clock_out: e.target.value })} />
              </div>
            </div>

            <div className="time-punch-field" style={{ marginTop: 14 }}>
              <label>Hourly rate ($)</label>
              <input type="number" value={editForm.hourly_rate} onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })} />
            </div>

            <div className="modal-actions">
              <button className="ghost" onClick={clearCell}>Clear day</button>
              <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button onClick={saveCell}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
