import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { logActivity } from "../shared";

export default function Team({ session }) {
  const [profiles, setProfiles] = useState([]);
  const [rateEdits, setRateEdits] = useState({});

  async function load() {
    const { data } = await supabase.from("profiles").select("*").order("email");
    setProfiles(data || []);
  }
  useEffect(() => { load(); }, []);

  async function toggleRole(p) {
    const newRole = p.role === "owner" ? "staff" : "owner";
    if (p.email === session.user.email && newRole === "staff") {
      if (!confirm("This will remove your own owner access. Are you sure?")) return;
    }
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", p.id);
    if (!error) {
      await logActivity(session, `changed ${p.email}'s role from ${p.role} to ${newRole}.`);
      load();
    }
  }

  async function saveRate(p) {
    const rate = parseFloat(rateEdits[p.id]);
    if (isNaN(rate) || rate < 0) return;
    const { error } = await supabase.from("profiles").update({ hourly_rate: rate }).eq("id", p.id);
    if (!error) {
      await logActivity(session, `set ${p.email}'s hourly rate to $${rate}/hr.`);
      load();
    }
  }

  return (
    <div className="panel">
      <h2>Team / Users</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        To add a brand-new staff login, that still happens in Supabase (Authentication → Users → Add user) —
        this tab just manages who's an owner (full Ehlo access) versus regular staff (Knox Tracker only).
      </p>

      <div className="tbl-wrap">
        <table className="k">
          <thead><tr><th>Email</th><th>Role</th><th>Hourly rate</th><th></th></tr></thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.email}</td>
                <td><span className="plan-tag">{p.role}</span></td>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span>$</span>
                    <input
                      type="number"
                      style={{ width: 70, padding: "4px 6px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12.5 }}
                      value={rateEdits[p.id] ?? p.hourly_rate ?? 0}
                      onChange={(e) => setRateEdits({ ...rateEdits, [p.id]: e.target.value })}
                    />
                    <button className="ghost" onClick={() => saveRate(p)}>Save</button>
                  </div>
                </td>
                <td><button className="ghost" onClick={() => toggleRole(p)}>
                  Make {p.role === "owner" ? "staff" : "owner"}
                </button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
