import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { planByKey, statusColor, currentMonthKey, monthLabel } from "../shared";

export default function Home({ session, onNavigate }) {
  const [clients, setClients] = useState([]);
  const [retainers, setRetainers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [activity, setActivity] = useState([]);

  const month = currentMonthKey();

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from("clients").select("*");
      setClients(c || []);

      const { data: r } = await supabase.from("retainer_payments").select("*").eq("month", month);
      setRetainers(r || []);

      const { data: e } = await supabase.from("client_expenses").select("*").gte("entry_date", month);
      setExpenses((e || []).filter((row) => row.entry_date.slice(0, 7) === month.slice(0, 7)));

      const { data: a } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(8);
      setActivity(a || []);
    }
    load();
  }, []);

  const retainerForClient = (c) => planByKey(c.plan_tier).retainer;
  const retainerPaid = clients.reduce((s, c) => {
    const row = retainers.find((r) => r.client_id === c.id);
    return row?.paid ? s + retainerForClient(c) : s;
  }, 0);
  const feesThisMonth = expenses.reduce((s, e) => s + Number(e.fee), 0);
  const travelSpend = expenses.filter((e) => e.category !== "Booking Fee").reduce((s, e) => s + Number(e.amount), 0);
  const unpaidClients = clients.filter((c) => !retainers.find((r) => r.client_id === c.id)?.paid);

  const clientAlerts = clients.map((c) => {
    const spend = expenses.filter((e) => e.client_id === c.id && e.category !== "Booking Fee").reduce((s, e) => s + Number(e.amount), 0);
    const pct = Math.round((spend / (c.monthly_threshold || 1)) * 100);
    return { ...c, pct };
  }).filter((c) => c.pct >= 75).sort((a, b) => b.pct - a.pct);

  return (
    <div>
      <div className="panel">
        <h2>Overview — {monthLabel(month)}</h2>
        <div className="rev-cards">
          <div className="rev-card"><div className="l">Total clients</div><div className="v">{clients.length}</div></div>
          <div className="rev-card"><div className="l">Retainer collected</div><div className="v">${retainerPaid.toLocaleString()}</div></div>
          <div className="rev-card"><div className="l">Booking fees</div><div className="v">${feesThisMonth.toLocaleString()}</div></div>
          <div className="rev-card accent"><div className="l">Total revenue this month</div><div className="v">${(retainerPaid + feesThisMonth).toLocaleString()}</div></div>
        </div>
      </div>

      <div className="panel">
        <h2>Needs attention</h2>

        <div className="section-label">Clients near or over threshold</div>
        {clientAlerts.length === 0 ? (
          <div className="empty">No clients are close to their monthly threshold right now.</div>
        ) : (
          <div className="tbl-wrap" style={{ marginBottom: 20 }}>
            <table className="k">
              <thead><tr><th>Client</th><th>Plan</th><th>% of threshold</th></tr></thead>
              <tbody>
                {clientAlerts.map((c) => {
                  const st = statusColor(c.pct);
                  return (
                    <tr key={c.id}>
                      <td className="cnum">{c.company_name}</td>
                      <td><span className="plan-tag">{c.plan_tier}</span></td>
                      <td style={{ color: st.c, fontWeight: 700 }}>{c.pct}% &middot; {st.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="section-label">Outstanding retainers this month</div>
        {unpaidClients.length === 0 ? (
          <div className="empty">Everyone's paid up for {monthLabel(month)}.</div>
        ) : (
          <div className="tbl-wrap">
            <table className="k">
              <thead><tr><th>Client</th><th>Amount owed</th></tr></thead>
              <tbody>
                {unpaidClients.map((c) => (
                  <tr key={c.id}><td className="cnum">{c.company_name}</td><td>${retainerForClient(c).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Recent activity</h2>
        {activity.length === 0 ? (
          <div className="empty">Nothing logged yet.</div>
        ) : (
          activity.map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 12.5 }}>
              <span className="muted" style={{ whiteSpace: "nowrap" }}>
                {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} &middot;{" "}
                {new Date(e.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
              <span><b style={{ color: "var(--navy)" }}>{e.actor_email?.split("@")[0]}</b> {e.action}</span>
            </div>
          ))
        )}
        <button className="ghost" style={{ marginTop: 14 }} onClick={() => onNavigate("history")}>View full history &rarr;</button>
      </div>
    </div>
  );
}
