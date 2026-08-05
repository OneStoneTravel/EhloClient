import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { logActivity } from "../shared";

export default function Inquiries({ session }) {
  const [leads, setLeads] = useState([]);
  const [showReviewed, setShowReviewed] = useState(false);

  async function load() {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads(data || []);
  }

  useEffect(() => { load(); }, []);

  async function markReviewed(lead) {
    const { error } = await supabase.from("leads").update({ reviewed: true }).eq("id", lead.id);
    if (!error) {
      await logActivity(session, `reviewed business inquiry from ${lead.name} (${lead.company || "no company given"}).`);
      load();
    }
  }

  const visible = leads.filter((l) => showReviewed || !l.reviewed);

  return (
    <div className="panel">
      <h2>Business inquiries</h2>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
        <input type="checkbox" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} />
        Show reviewed inquiries too
      </label>

      <div className="tbl-wrap">
        <table className="k">
          <thead>
            <tr>
              <th>Received</th><th>Name</th><th>Company</th><th>Email</th>
              <th>Phone</th><th>Message</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={7} className="empty">No new inquiries.</td></tr>
            ) : (
              visible.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td style={{ fontWeight: 600, color: "var(--navy)" }}>{l.name}</td>
                  <td>{l.company || "—"}</td>
                  <td className="muted">{l.email}</td>
                  <td className="muted">{l.phone || "—"}</td>
                  <td className="muted" style={{ maxWidth: 260, whiteSpace: "normal" }}>{l.message || "—"}</td>
                  <td>
                    {l.reviewed ? (
                      <span className="plan-tag" style={{ background: "var(--green-bg)", color: "var(--green)", borderColor: "#BFE0CD" }}>Reviewed</span>
                    ) : (
                      <button className="ghost" onClick={() => markReviewed(l)}>Mark reviewed</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
