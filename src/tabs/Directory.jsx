import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { PLAN_TIERS, tenureLabel, logActivity } from "../shared";
import Modal from "../Modal";

export default function Directory({ session }) {
  const [clients, setClients] = useState([]);
  const [travelerCounts, setTravelerCounts] = useState({});
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);

  async function load() {
    const { data: c } = await supabase.from("clients").select("*").order("company_name");
    setClients(c || []);
    const { data: t } = await supabase.from("travelers").select("client_id");
    const counts = {};
    (t || []).forEach((row) => { counts[row.client_id] = (counts[row.client_id] || 0) + 1; });
    setTravelerCounts(counts);
  }

  useEffect(() => { load(); }, []);

  function openEdit(c) {
    setEditing(c);
    setEditForm({ ...c });
  }

  async function saveEdit() {
    const { error } = await supabase.from("clients").update({
      plan_tier: editForm.plan_tier,
      monthly_threshold: parseFloat(editForm.monthly_threshold) || 0,
      contact_phone: editForm.contact_phone,
      authorized_person: editForm.authorized_person,
    }).eq("id", editing.id);

    if (!error) {
      await logActivity(session, `updated account details for ${editing.company_name}.`);
      setEditing(null);
      load();
    }
  }

  const filtered = clients.filter((c) =>
    !search || (c.company_name + " " + (c.client_number || "")).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="panel">
      <h2>Client directory</h2>
      <input className="search-input" placeholder="Search company or client #..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 14 }} />

      <div className="tbl-wrap">
        <table className="k">
          <thead>
            <tr>
              <th>Client #</th><th>Company</th><th>Plan</th><th>Authorized contact</th>
              <th>Phone</th><th>Client tenure</th><th>Travelers</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="empty">No clients found.</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td className="cnum">{c.client_number || "—"}</td>
                  <td style={{ fontWeight: 600, color: "var(--navy)" }}>{c.company_name}</td>
                  <td><span className="plan-tag">{c.plan_tier}</span></td>
                  <td>{c.authorized_person || "—"}</td>
                  <td className="muted">{c.contact_phone || "—"}</td>
                  <td className="muted">{tenureLabel(c.date_joined)}</td>
                  <td className="muted">{travelerCounts[c.id] || 0}</td>
                  <td><button className="ghost" onClick={() => openEdit(c)}>Edit</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)}>
        {editForm && (
          <>
            <h3>Edit {editing.company_name}</h3>
            <div className="modal-sub">Updates apply immediately across Ehlo and Knox Tracker.</div>
            <label>Plan tier</label>
            <select value={editForm.plan_tier} onChange={(e) => setEditForm({ ...editForm, plan_tier: e.target.value })}>
              {PLAN_TIERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <label>Monthly threshold ($)</label>
            <input type="number" value={editForm.monthly_threshold} onChange={(e) => setEditForm({ ...editForm, monthly_threshold: e.target.value })} />
            <label>Authorized contact</label>
            <input value={editForm.authorized_person || ""} onChange={(e) => setEditForm({ ...editForm, authorized_person: e.target.value })} />
            <label>Contact phone</label>
            <input value={editForm.contact_phone || ""} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} />
            <div className="modal-actions">
              <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button onClick={saveEdit}>Save</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
