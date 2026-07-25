import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { logActivity } from "../shared";

export default function Team({ session }) {
  const [profiles, setProfiles] = useState([]);

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

  return (
    <div className="panel">
      <h2>Team / Users</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        To add a brand-new staff login, that still happens in Supabase (Authentication → Users → Add user) —
        this tab just manages who's an owner (full Ehlo access) versus regular staff (Knox Tracker only).
      </p>

      <div className="tbl-wrap">
        <table className="k">
          <thead><tr><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.email}</td>
                <td><span className="plan-tag">{p.role}</span></td>
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
