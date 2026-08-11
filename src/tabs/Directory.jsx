import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { PLAN_TIERS, tenureLabel, daysUntilDue, dueStatus, localDateStr, logActivity } from "../shared";
import Modal from "../Modal";
import DatePicker from "../DatePicker";

export default function Directory({ session }) {
  const [clients, setClients] = useState([]);
  const [travelerCounts, setTravelerCounts] = useState({});
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [ending, setEnding] = useState(null);
  const [endDate, setEndDate] = useState(localDateStr());
  const [managingTravelers, setManagingTravelers] = useState(null);
  const [clientTravelers, setClientTravelers] = useState([]);
  const [travelerEdits, setTravelerEdits] = useState({});
  const [newTravelerName, setNewTravelerName] = useState("");

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

  function closeEdit() {
    setEditing(null);
    setEditForm(null);
  }

  async function saveEdit() {
    const { error } = await supabase.from("clients").update({
      client_number: editForm.client_number,
      plan_tier: editForm.plan_tier,
      monthly_threshold: parseFloat(editForm.monthly_threshold) || 0,
      contact_phone: editForm.contact_phone,
      authorized_person: editForm.authorized_person,
      authorized_email: editForm.authorized_email,
      retainer_due_day: parseInt(editForm.retainer_due_day) || 1,
    }).eq("id", editing.id);

    if (!error) {
      await logActivity(session, `updated account details for ${editing.company_name}.`);
      closeEdit();
      load();
    }
  }

  function openEndService(c) {
    setEnding(c);
    setEndDate(localDateStr());
  }

  async function confirmEndService() {
    await supabase.from("clients").update({ status: "inactive", service_end_date: endDate }).eq("id", ending.id);
    await logActivity(session, `ended service for ${ending.company_name}, final active month through ${endDate}.`);
    setEnding(null);
    load();
  }

  async function reactivateClient(c) {
    await supabase.from("clients").update({ status: "active", service_end_date: null }).eq("id", c.id);
    await logActivity(session, `reactivated ${c.company_name} as an active client.`);
    load();
  }

  async function openTravelers(c) {
    setManagingTravelers(c);
    setTravelerEdits({});
    const { data } = await supabase.from("travelers").select("*").eq("client_id", c.id).order("name");
    setClientTravelers(data || []);
  }

  async function saveTravelerLoyalty(t) {
    const edits = travelerEdits[t.id] || {};
    await supabase.from("travelers").update({
      hotel_loyalty_number: edits.hotel_loyalty_number ?? t.hotel_loyalty_number ?? null,
      car_loyalty_number: edits.car_loyalty_number ?? t.car_loyalty_number ?? null,
      date_of_birth: edits.date_of_birth ?? t.date_of_birth ?? null,
      gender: edits.gender ?? t.gender ?? null,
    }).eq("id", t.id);
    await logActivity(session, `updated details for ${t.name}.`);
    openTravelers(managingTravelers);
  }

  async function addTravelerToClient() {
    const name = newTravelerName.trim();
    if (!name) return;
    await supabase.from("travelers").insert({ client_id: managingTravelers.id, name });
    setNewTravelerName("");
    openTravelers(managingTravelers);
    load();
  }

  const filtered = clients
    .filter((c) => showInactive || c.status !== "inactive")
    .filter((c) => !search || (c.company_name + " " + (c.client_number || "")).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="panel">
      <h2>Client directory</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <input className="search-input" placeholder="Search company or client #..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button className="ghost" onClick={() => setShowInactive(!showInactive)}>{showInactive ? "Hide inactive" : "Show inactive"}</button>
      </div>

      <div className="tbl-wrap">
        <table className="k">
          <thead>
            <tr>
              <th>Client #</th><th>Company</th><th>Status</th><th>Plan</th><th>Authorized contact</th>
              <th>Phone</th><th>Email</th><th>Client tenure</th><th>Retainer due</th><th>Travelers</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={11} className="empty">No clients found.</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td className="cnum">{c.client_number || "—"}</td>
                  <td style={{ fontWeight: 600, color: "var(--navy)" }}>{c.company_name}</td>
                  <td>
                    {c.status === "inactive"
                      ? <span className="check-pill unpaid">Inactive since {c.service_end_date}</span>
                      : <span className="check-pill paid">Active</span>}
                  </td>
                  <td><span className="plan-tag">{c.plan_tier}</span></td>
                  <td>{c.authorized_person || "—"}</td>
                  <td className="muted">{c.contact_phone || "—"}</td>
                  <td className="muted">{c.authorized_email || "—"}</td>
                  <td className="muted">{tenureLabel(c.date_joined)}</td>
                  <td>
                    {(() => {
                      const d = dueStatus(daysUntilDue(c.retainer_due_day));
                      return <span style={{ color: d.color, fontWeight: d.urgent ? 700 : 400, fontSize: 12 }}>{d.label}</span>;
                    })()}
                  </td>
                  <td className="muted">{travelerCounts[c.id] || 0}</td>
                  <td style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button className="ghost" onClick={() => openEdit(c)}>Edit</button>
                    <button className="ghost" onClick={() => openTravelers(c)}>Travelers</button>
                    {c.status === "inactive"
                      ? <button className="ghost" onClick={() => reactivateClient(c)}>Reactivate</button>
                      : <button className="ghost" onClick={() => openEndService(c)}>End service</button>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={closeEdit}>
        {editing && editForm && (
          <>
            <h3>Edit {editing.company_name}</h3>
            <div className="modal-sub">Updates apply immediately across Ehlo and Knox Tracker.</div>
            <label>Client number</label>
            <input value={editForm.client_number || ""} onChange={(e) => setEditForm({ ...editForm, client_number: e.target.value })} />
            <label>Plan tier</label>
            <select value={editForm.plan_tier} onChange={(e) => setEditForm({ ...editForm, plan_tier: e.target.value })}>
              {PLAN_TIERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <label>Monthly threshold ($)</label>
            <input type="number" value={editForm.monthly_threshold} onChange={(e) => setEditForm({ ...editForm, monthly_threshold: e.target.value })} />
            <label>Retainer due day (day of month)</label>
            <input type="number" min="1" max="28" value={editForm.retainer_due_day || 1} onChange={(e) => setEditForm({ ...editForm, retainer_due_day: e.target.value })} />
            <label>Authorized contact</label>
            <input value={editForm.authorized_person || ""} onChange={(e) => setEditForm({ ...editForm, authorized_person: e.target.value })} />
            <label>Authorized contact email</label>
            <input type="email" value={editForm.authorized_email || ""} onChange={(e) => setEditForm({ ...editForm, authorized_email: e.target.value })} />
            <label>Contact phone</label>
            <input value={editForm.contact_phone || ""} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} />
            <div className="modal-actions">
              <button className="ghost" onClick={closeEdit}>Cancel</button>
              <button onClick={saveEdit}>Save</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!ending} onClose={() => setEnding(null)}>
        {ending && (
          <>
            <h3>End service — {ending.company_name}</h3>
            <div className="modal-sub">
              They'll stay fully visible in Billing, Revenue, and reports for every month up through this date — we just stop expecting
              future revenue from them and Knox Tracker's trip form will stop offering them as an option.
            </div>
            <label style={{ display: "block", fontSize: 10.5, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 4 }}>Last active date</label>
            <DatePicker value={endDate} onChange={setEndDate} />
            <div className="modal-actions">
              <button className="ghost" onClick={() => setEnding(null)}>Cancel</button>
              <button onClick={confirmEndService}>Confirm — end service</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!managingTravelers} onClose={() => setManagingTravelers(null)}>
        {managingTravelers && (
          <>
            <h3>Travelers — {managingTravelers.company_name}</h3>
            <div className="modal-sub">Loyalty numbers stored here show up automatically in Knox Tracker when booking a hotel or rental car.</div>

            {clientTravelers.length === 0 ? (
              <div className="empty">No travelers yet.</div>
            ) : (
              clientTravelers.map((t) => (
                <div key={t.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
                  <div style={{ fontWeight: 600, color: "var(--navy)", marginBottom: 6 }}>{t.name}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label>Date of birth</label>
                      <input
                        type="date"
                        value={travelerEdits[t.id]?.date_of_birth ?? t.date_of_birth ?? ""}
                        onChange={(e) => setTravelerEdits({ ...travelerEdits, [t.id]: { ...travelerEdits[t.id], date_of_birth: e.target.value } })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>Gender</label>
                      <select
                        value={travelerEdits[t.id]?.gender ?? t.gender ?? ""}
                        onChange={(e) => setTravelerEdits({ ...travelerEdits, [t.id]: { ...travelerEdits[t.id], gender: e.target.value } })}
                      >
                        <option value="">—</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>
                  <label>Hotel loyalty #</label>
                  <input
                    value={travelerEdits[t.id]?.hotel_loyalty_number ?? t.hotel_loyalty_number ?? ""}
                    onChange={(e) => setTravelerEdits({ ...travelerEdits, [t.id]: { ...travelerEdits[t.id], hotel_loyalty_number: e.target.value } })}
                  />
                  <label>Rental car loyalty #</label>
                  <input
                    value={travelerEdits[t.id]?.car_loyalty_number ?? t.car_loyalty_number ?? ""}
                    onChange={(e) => setTravelerEdits({ ...travelerEdits, [t.id]: { ...travelerEdits[t.id], car_loyalty_number: e.target.value } })}
                  />
                  <button className="ghost" onClick={() => saveTravelerLoyalty(t)}>Save</button>
                </div>
              ))
            )}

            <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <label>Add a traveler</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newTravelerName} onChange={(e) => setNewTravelerName(e.target.value)} placeholder="Full name" style={{ marginBottom: 0 }} />
                <button onClick={addTravelerToClient}>Add</button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="ghost" onClick={() => setManagingTravelers(null)}>Close</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
