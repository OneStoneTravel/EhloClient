import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { logActivity } from "../shared";

const STATUS_FLOW = { New: "Reviewed", Reviewed: "Booked" };
const STATUS_STYLE = {
  New: { bg: "var(--amber-bg)", c: "var(--amber)" },
  Reviewed: { bg: "var(--orange-bg)", c: "var(--orange)" },
  Booked: { bg: "var(--green-bg)", c: "var(--green)" },
  Cancelled: { bg: "var(--red-bg)", c: "var(--red)" },
};

export default function Requests({ session }) {
  const [requests, setRequests] = useState([]);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("requests")
      .select("*, clients(company_name, client_number)")
      .order("created_at", { ascending: false });
    setRequests(data || []);
  }

  useEffect(() => { load(); }, []);

  async function advance(r) {
    const next = STATUS_FLOW[r.status];
    if (!next) return;
    const { error } = await supabase.from("requests").update({ status: next }).eq("id", r.id);
    if (!error) {
      const company = r.clients?.company_name || "unknown client";
      await logActivity(session, `moved ${company}'s request (${r.destination}) to ${next}.` +
        (next === "Booked" ? " Remember to add the real flight into Knox Tracker." : ""));
      load();
    }
  }

  async function cancel(r) {
    const { error } = await supabase.from("requests").update({ status: "Cancelled" }).eq("id", r.id);
    if (!error) {
      await logActivity(session, `cancelled ${r.clients?.company_name || "a client"}'s request (${r.destination}).`);
      load();
    }
  }

  const visible = requests.filter((r) => showAll || (r.status !== "Booked" && r.status !== "Cancelled"));

  return (
    <div className="panel">
      <h2>Travel requests</h2>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Show booked and cancelled too
      </label>

      <div className="tbl-wrap">
        <table className="k">
          <thead>
            <tr>
              <th>Client #</th><th>Company</th><th>Contact</th><th>Destination</th>
              <th>Dates</th><th>Travelers</th><th>Priority</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={9} className="empty">No requests to review.</td></tr>
            ) : (
              visible.map((r) => {
                const style = STATUS_STYLE[r.status] || STATUS_STYLE.New;
                return (
                  <tr key={r.id}>
                    <td className="cnum">{r.clients?.client_number || "—"}</td>
                    <td style={{ fontWeight: 600, color: "var(--navy)" }}>{r.clients?.company_name || "—"}</td>
                    <td className="muted">{r.contact_name}<br /><span style={{ fontSize: 11 }}>{r.email}</span></td>
                    <td>{r.destination}</td>
                    <td className="muted">
                      {new Date(r.departure_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {r.return_date ? " – " + new Date(r.return_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                    </td>
                    <td className="muted" style={{ whiteSpace: "pre-line", maxWidth: 180 }}>{r.traveler_names}</td>
                    <td>{r.priority === "urgent" ? <span className="plan-tag" style={{ background: "var(--red-bg)", color: "var(--red)", borderColor: "#F0C7BE" }}>Urgent</span> : "Standard"}</td>
                    <td><span className="plan-tag" style={{ background: style.bg, color: style.c, borderColor: "transparent" }}>{r.status}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {STATUS_FLOW[r.status] && (
                        <button className="ghost" onClick={() => advance(r)} style={{ marginRight: 6 }}>
                          Mark {STATUS_FLOW[r.status]}
                        </button>
                      )}
                      {(r.status === "New" || r.status === "Reviewed") && (
                        <button className="ghost" onClick={() => cancel(r)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 14, marginBottom: 0 }}>
        Marking a request "Booked" doesn't create a Knox Tracker entry automatically — add the real flight into Knox the same way you do today once it's priced and confirmed.
      </p>
    </div>
  );
}
