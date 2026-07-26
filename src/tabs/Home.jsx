import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { planByKey, statusColor, daysUntilDue, dueStatus, currentMonthKey, localDateStr, monthLabel, fetchExpenseTotals, clientActiveInMonth } from "../shared";

export default function Home({ session, onNavigate }) {
  const [clients, setClients] = useState([]);
  const [retainers, setRetainers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [activity, setActivity] = useState([]);
  const [tripsToday, setTripsToday] = useState(0);
  const [tripsTomorrow, setTripsTomorrow] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [staffName, setStaffName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const month = currentMonthKey();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoadError((prev) => prev || "This is taking much longer than expected — one of the requests may be stuck. Try refreshing.");
      setLoading(false);
    }, 12000);

    async function load() {
      try {
        const today = localDateStr();
        const tomorrow = localDateStr(new Date(Date.now() + 86400000));

        const [clientsRes, retainersRes, expensesRes, activityRes, expTotals, staffRes, tripsTodayRes, tripsTomorrowRes] = await Promise.all([
          supabase.from("clients").select("*"),
          supabase.from("retainer_payments").select("*").eq("month", month),
          supabase.from("client_expenses").select("*").gte("entry_date", month),
          supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(8),
          fetchExpenseTotals([month]),
          supabase.from("staff").select("full_name").eq("login_email", session.user.email).maybeSingle(),
          supabase.from("trips").select("id", { count: "exact", head: true }).eq("travel_date", today),
          supabase.from("trips").select("id", { count: "exact", head: true }).eq("travel_date", tomorrow),
        ]);

        if (clientsRes.error) throw clientsRes.error;
        if (retainersRes.error) throw retainersRes.error;
        if (expensesRes.error) throw expensesRes.error;
        if (activityRes.error) throw activityRes.error;

        setClients(clientsRes.data || []);
        setRetainers(retainersRes.data || []);
        setExpenses((expensesRes.data || []).filter((row) => row.entry_date.slice(0, 7) === month.slice(0, 7)));
        setActivity(activityRes.data || []);
        setExpenseTotal(expTotals.total);
        setStaffName(staffRes.data?.full_name || null);
        setTripsToday(tripsTodayRes.count || 0);
        setTripsTomorrow(tripsTomorrowRes.count || 0);
      } catch (err) {
        console.error("Home load error:", err);
        setLoadError(err?.message || String(err));
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }
    load();
    return () => clearTimeout(timeout);
  }, []);

  if (loadError) {
    return (
      <div className="panel">
        <div style={{ color: "var(--red)", fontWeight: 600, marginBottom: 6 }}>Something went wrong loading this page.</div>
        <div className="muted">{loadError}</div>
      </div>
    );
  }

  if (loading) {
    return <div className="panel"><div className="empty">Loading overview…</div></div>;
  }

  const retainerForClient = (c) => planByKey(c.plan_tier).retainer;
  const retainerPaid = clients.reduce((s, c) => {
    const row = retainers.find((r) => r.client_id === c.id);
    return row?.paid ? s + retainerForClient(c) : s;
  }, 0);
  const feesThisMonth = expenses.reduce((s, e) => s + Number(e.fee), 0);
  const travelSpend = expenses.filter((e) => e.category !== "Booking Fee").reduce((s, e) => s + Number(e.amount), 0);
  const totalRevenueThisMonth = retainerPaid + feesThisMonth;
  const profit = totalRevenueThisMonth - expenseTotal;
  const unpaidClients = clients
    .filter((c) => clientActiveInMonth(c, month) && !retainers.find((r) => r.client_id === c.id)?.paid)
    .map((c) => ({ ...c, due: dueStatus(daysUntilDue(c.retainer_due_day)) }))
    .sort((a, b) => daysUntilDue(a.retainer_due_day) - daysUntilDue(b.retainer_due_day));

  const clientAlerts = clients.map((c) => {
    const spend = expenses.filter((e) => e.client_id === c.id && e.category !== "Booking Fee").reduce((s, e) => s + Number(e.amount), 0);
    const pct = Math.round((spend / (c.monthly_threshold || 1)) * 100);
    return { ...c, pct };
  }).filter((c) => c.pct >= 75).sort((a, b) => b.pct - a.pct);

  const urgentCount = unpaidClients.filter((c) => c.due.urgent).length;

  function greeting() {
    const hour = new Date().getHours();
    const email = session.user.email.toLowerCase();

    const KNOWN_NAMES = {
      "terrencetedwards@gmail.com": "TERRENCE",
      "roze.mbr@gmail.com": "MARY",
    };

    const name = KNOWN_NAMES[email]
      || (staffName ? staffName.split(" ")[0].toUpperCase() : email.split("@")[0].toUpperCase());

    if (hour >= 5 && hour < 12) return `Good morning, ${name}`;
    if (hour >= 12 && hour < 17) return `Good afternoon, ${name}`;
    if (hour >= 17 && hour < 21) return `Good evening, ${name}`;
    return `Have a good night, ${name}`;
  }

  return (
    <div>
      <div className="panel" style={{ textAlign: "center", padding: "26px 20px" }}>
        <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 22, color: "var(--navy)", fontWeight: 600 }}>{greeting()}</div>
      </div>
      {urgentCount > 0 && (
        <div className="panel" style={{ background: "var(--red-bg)", borderColor: "#E3B3AA" }}>
          <div style={{ color: "var(--red)", fontWeight: 700, fontSize: 14 }}>
            {urgentCount} retainer{urgentCount === 1 ? "" : "s"} due soon or overdue — see below.
          </div>
        </div>
      )}
      <div className="panel">
        <h2>Overview — {monthLabel(month)}</h2>
        <div className="rev-cards">
          <div className="rev-card"><div className="l">Total clients</div><div className="v">{clients.length}</div></div>
          <div className="rev-card"><div className="l">Retainer collected</div><div className="v">${retainerPaid.toLocaleString()}</div></div>
          <div className="rev-card"><div className="l">Booking fees</div><div className="v">${feesThisMonth.toLocaleString()}</div></div>
          <div className="rev-card accent"><div className="l">Total revenue this month</div><div className="v">${totalRevenueThisMonth.toLocaleString()}</div></div>
        </div>
        <div className="rev-cards">
          <div className="rev-card"><div className="l">Operating expenses this month</div><div className="v">${expenseTotal.toLocaleString()}</div></div>
          <div className="rev-card" style={{ background: profit >= 0 ? "var(--green-bg)" : "var(--red-bg)", borderColor: profit >= 0 ? "#B9DAC5" : "#E3B3AA" }}>
            <div className="l">Profit this month</div>
            <div className="v" style={{ color: profit >= 0 ? "var(--green)" : "var(--red)" }}>${profit.toLocaleString()}</div>
          </div>
        </div>

        <div className="section-label">Reservations (Knox Tracker)</div>
        <div className="rev-cards">
          <div className="rev-card"><div className="l">Traveling today</div><div className="v">{tripsToday}</div></div>
          <div className="rev-card"><div className="l">Traveling tomorrow</div><div className="v">{tripsTomorrow}</div></div>
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
              <thead><tr><th>Client</th><th>Amount owed</th><th>Due status</th></tr></thead>
              <tbody>
                {unpaidClients.map((c) => (
                  <tr key={c.id}>
                    <td className="cnum">{c.company_name}</td>
                    <td>${retainerForClient(c).toLocaleString()}</td>
                    <td style={{ color: c.due.color, fontWeight: c.due.urgent ? 700 : 400 }}>{c.due.label}</td>
                  </tr>
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
