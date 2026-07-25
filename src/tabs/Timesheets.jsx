import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { localDateStr, logActivity } from "../shared";

export default function Timesheets({ session }) {
  const [profiles, setProfiles] = useState([]);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ staff_email: "", work_date: localDateStr(), hours: "", note: "" });

  async function load() {
    const { data: p } = await supabase.from("profiles").select("*").order("email");
    setProfiles(p || []);
    const { data: e } = await supabase.from("timesheets").select("*").order("work_date", { ascending: false });
    setEntries(e || []);
  }

  useEffect(() => { load(); }, []);

  async function submit(ev) {
    ev.preventDefault();
    const hours = parseFloat(form.hours) || 0;
    if (!form.staff_email || hours <= 0) return;
    await supabase.from("timesheets").insert({
      staff_email: form.staff_email, work_date: form.work_date, hours, note: form.note || null,
    });
    await logActivity(session, `logged ${hours} hours for ${form.staff_email} on ${form.work_date}.`);
    setForm({ staff_email: "", work_date: localDateStr(), hours: "", note: "" });
    load();
  }

  async function remove(id) {
    if (!confirm("Remove this timesheet entry?")) return;
    await supabase.from("timesheets").delete().eq("id", id);
    load();
  }

  const month = localDateStr().slice(0, 7);
  const totalsByStaff = {};
  entries.filter((e) => e.work_date.slice(0, 7) === month).forEach((e) => {
    totalsByStaff[e.staff_email] = (totalsByStaff[e.staff_email] || 0) + Number(e.hours);
  });

  return (
    <div className="panel">
      <h2>Timesheets</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Since only owners have Ehlo access, hours are logged here on staff's behalf rather than staff self-logging.
      </p>

      <div className="section-label">This month's hours by staff</div>
      <div className="tbl-wrap" style={{ marginBottom: 20 }}>
        <table className="k">
          <thead><tr><th>Staff</th><th>Hours this month</th></tr></thead>
          <tbody>
            {Object.keys(totalsByStaff).length === 0 ? (
              <tr><td colSpan={2} className="empty">No hours logged yet this month.</td></tr>
            ) : (
              Object.entries(totalsByStaff).map(([email, hours]) => (
                <tr key={email}><td className="cnum">{email}</td><td>{hours}</td></tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="section-label">Log hours</div>
      <form className="entry-form" onSubmit={submit}>
        <div>
          <label>Staff</label>
          <select value={form.staff_email} onChange={(e) => setForm({ ...form, staff_email: e.target.value })}>
            <option value="">Select…</option>
            {profiles.map((p) => <option key={p.id} value={p.email}>{p.email}</option>)}
          </select>
        </div>
        <div><label>Date</label><input type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} /></div>
        <div><label>Hours</label><input type="number" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
        <div><label>Note</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" /></div>
        <div><button type="submit">Add</button></div>
      </form>

      <div className="section-label">All entries</div>
      {entries.length === 0 ? <div className="empty">No timesheet entries yet.</div> : entries.map((e) => (
        <div className="log-row" key={e.id} style={{ gridTemplateColumns: "90px 1fr 60px 1fr auto" }}>
          <span className="muted">{e.work_date}</span>
          <span>{e.staff_email}</span>
          <span>{e.hours}h</span>
          <span className="muted">{e.note || ""}</span>
          <button className="icon-btn" onClick={() => remove(e.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
