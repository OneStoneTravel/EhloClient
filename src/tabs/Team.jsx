import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { localDateStr, logActivity } from "../shared";

function emptyForm() {
  return {
    full_name: "", login_email: "", personal_email: "", phone: "", address: "",
    date_of_birth: "", hourly_rate: "", hire_date: localDateStr(),
  };
}

export default function Team({ session }) {
  const [staff, setStaff] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [showTerminated, setShowTerminated] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);

  async function load() {
    const { data: s } = await supabase.from("staff").select("*").order("full_name");
    setStaff(s || []);
    const { data: p } = await supabase.from("profiles").select("*");
    setProfiles(p || []);
  }
  useEffect(() => { load(); }, []);

  async function addStaff(e) {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    await supabase.from("staff").insert({
      full_name: form.full_name.trim(),
      login_email: form.login_email || null,
      personal_email: form.personal_email || null,
      phone: form.phone || null,
      address: form.address || null,
      date_of_birth: form.date_of_birth || null,
      hourly_rate: parseFloat(form.hourly_rate) || 0,
      hire_date: form.hire_date,
      created_by: session.user.email,
    });
    await logActivity(session, `added ${form.full_name} as a new staff member.`);
    setForm(emptyForm());
    load();
  }

  function openEdit(s) {
    setEditing(s);
    setEditForm({ ...s });
  }

  async function saveEdit() {
    await supabase.from("staff").update({
      full_name: editForm.full_name,
      login_email: editForm.login_email,
      personal_email: editForm.personal_email,
      phone: editForm.phone,
      address: editForm.address,
      date_of_birth: editForm.date_of_birth || null,
      hourly_rate: parseFloat(editForm.hourly_rate) || 0,
    }).eq("id", editing.id);
    await logActivity(session, `updated staff details for ${editForm.full_name}.`);
    setEditing(null);
    load();
  }

  async function terminate(s) {
    if (!confirm(`Terminate ${s.full_name}? Their name will stop appearing on future weeks in Time, but past records stay intact.`)) return;
    await supabase.from("staff").update({ status: "terminated", termination_date: localDateStr() }).eq("id", s.id);
    await logActivity(session, `terminated ${s.full_name}.`);
    load();
  }

  async function reactivate(s) {
    await supabase.from("staff").update({ status: "active", termination_date: null }).eq("id", s.id);
    await logActivity(session, `reactivated ${s.full_name}.`);
    load();
  }

  async function toggleEhloRole(profile) {
    const newRole = profile.role === "owner" ? "staff" : "owner";
    if (profile.email === session.user.email && newRole === "staff") {
      if (!confirm("This will remove your own owner access to Ehlo. Are you sure?")) return;
    }
    await supabase.from("profiles").update({ role: newRole }).eq("id", profile.id);
    await logActivity(session, `changed ${profile.email}'s Ehlo access from ${profile.role} to ${newRole}.`);
    load();
  }

  const visibleStaff = staff.filter((s) => showTerminated || s.status === "active");

  return (
    <div className="panel">
      <h2>Staff</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 18 }}>
        This is the source of truth for payroll and the Time tab's weekly roster. Actual login credentials for Knox Tracker or Ehlo
        still have to be created or removed directly in Supabase (Authentication → Users) — that step can't happen from here safely.
      </p>

      <div className="section-label">Add a new hire</div>
      <form className="form-grid" onSubmit={addStaff}>
        <div><label>Full name</label><input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jamie Alvarez" /></div>
        <div><label>Login email (if they'll use Knox/Ehlo)</label><input type="email" value={form.login_email} onChange={(e) => setForm({ ...form, login_email: e.target.value })} placeholder="jamie@onestone.com" /></div>
        <div><label>Personal email</label><input type="email" value={form.personal_email} onChange={(e) => setForm({ ...form, personal_email: e.target.value })} /></div>
        <div><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(602) 555-0100" /></div>
        <div><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><label>Date of birth</label><input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
        <div><label>Hourly rate ($)</label><input type="number" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} /></div>
        <div><label>Hire date</label><input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
        <div className="form-full"><button type="submit">Add staff member</button></div>
      </form>

      <div className="sec-head" style={{ margin: "26px 0 12px" }}>
        <h2 style={{ margin: 0, textTransform: "none", fontSize: 19 }}>Staff directory</h2>
        <button className="ghost" onClick={() => setShowTerminated(!showTerminated)}>
          {showTerminated ? "Hide terminated" : "Show terminated"}
        </button>
      </div>

      <div className="tbl-wrap">
        <table className="k">
          <thead><tr><th>Name</th><th>Phone</th><th>Hourly rate</th><th>Hired</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {visibleStaff.length === 0 ? (
              <tr><td colSpan={6} className="empty">No staff yet.</td></tr>
            ) : (
              visibleStaff.map((s) => (
                <tr key={s.id}>
                  <td className="cnum">{s.full_name}</td>
                  <td className="muted">{s.phone || "—"}</td>
                  <td>${Number(s.hourly_rate).toFixed(2)}/hr</td>
                  <td className="muted">{s.hire_date}</td>
                  <td>
                    {s.status === "active"
                      ? <span className="check-pill paid">Active</span>
                      : <span className="check-pill unpaid">Terminated {s.termination_date}</span>}
                  </td>
                  <td style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button className="ghost" onClick={() => openEdit(s)}>Edit</button>
                    {s.status === "active"
                      ? <button className="ghost" onClick={() => terminate(s)}>Terminate</button>
                      : <button className="ghost" onClick={() => reactivate(s)}>Reactivate</button>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="section-label">Ehlo access (owner vs. staff)</div>
      <p className="muted" style={{ marginTop: -4 }}>
        Only owners can see or use Ehlo at all — this doesn't affect Knox Tracker access, every staff login already works there.
      </p>
      <div className="tbl-wrap">
        <table className="k">
          <thead><tr><th>Login email</th><th>Ehlo role</th><th></th></tr></thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.email}</td>
                <td><span className="plan-tag">{p.role}</span></td>
                <td><button className="ghost" onClick={() => toggleEhloRole(p)}>Make {p.role === "owner" ? "staff" : "owner"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay show" onClick={(ev) => { if (ev.target === ev.currentTarget) setEditing(null); }}>
          <div className="modal-box">
            <h3>Edit {editing.full_name}</h3>
            <label>Full name</label>
            <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            <label>Login email</label>
            <input value={editForm.login_email || ""} onChange={(e) => setEditForm({ ...editForm, login_email: e.target.value })} />
            <label>Personal email</label>
            <input value={editForm.personal_email || ""} onChange={(e) => setEditForm({ ...editForm, personal_email: e.target.value })} />
            <label>Phone</label>
            <input value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            <label>Address</label>
            <input value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            <label>Date of birth</label>
            <input type="date" value={editForm.date_of_birth || ""} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} />
            <label>Hourly rate ($)</label>
            <input type="number" value={editForm.hourly_rate} onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })} />
            <div className="modal-actions">
              <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
