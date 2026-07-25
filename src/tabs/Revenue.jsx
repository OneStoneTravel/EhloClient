import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { planByKey, monthLabel, prevMonthKey, barChart, logActivity } from "../shared";

export default function Revenue({ session }) {
  const [clients, setClients] = useState([]);
  const [retainers, setRetainers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [months, setMonths] = useState([]);
  const [view, setView] = useState("month"); // "month" | "ytd"

  async function load() {
    const { data: c } = await supabase.from("clients").select("*").order("company_name");
    setClients(c || []);

    const now = new Date();
    const yearStart = `${now.getFullYear()}-01-01`;
    const fetchStart = prevMonthKey(yearStart); // one month earlier, so Jan-vs-last-Dec comparisons work
    const m = [];
    for (let i = 0; i <= now.getMonth(); i++) {
      m.push(`${now.getFullYear()}-${String(i + 1).padStart(2, "0")}-01`);
    }
    setMonths(m);

    const { data: r } = await supabase.from("retainer_payments").select("*").gte("month", fetchStart);
    setRetainers(r || []);
    const { data: e } = await supabase.from("client_expenses").select("*").gte("entry_date", fetchStart);
    setExpenses(e || []);
  }

  useEffect(() => { load(); }, []);

  const currentMonth = months[months.length - 1] || "";
  const retainerForClient = (c) => planByKey(c.plan_tier).retainer;

  function clientMonthStats(client, monthKey) {
    const rows = expenses.filter((e) => e.client_id === client.id && e.entry_date.slice(0, 7) === monthKey.slice(0, 7));
    const flightVol = rows.filter((e) => e.category !== "Booking Fee").reduce((s, e) => s + Number(e.amount), 0);
    const fees = rows.reduce((s, e) => s + Number(e.fee), 0);
    const retRow = retainers.find((r) => r.client_id === client.id && r.month === monthKey);
    return { flightVol, fees, retainerAmt: retainerForClient(client), paid: !!retRow?.paid };
  }

  function aggregateOver(scopeMonths) {
    return clients.reduce((acc, c) => {
      scopeMonths.forEach((m) => {
        const s = clientMonthStats(c, m);
        acc.flightVol += s.flightVol;
        acc.fees += s.fees;
        acc.retainerExpected += s.retainerAmt;
        acc.retainerCollected += s.paid ? s.retainerAmt : 0;
      });
      return acc;
    }, { flightVol: 0, fees: 0, retainerExpected: 0, retainerCollected: 0 });
  }

  const thisMonthAgg = aggregateOver([currentMonth]);
  const ytdAgg = aggregateOver(months);
  const agg = view === "month" ? thisMonthAgg : ytdAgg;
  const totalRevenue = agg.fees + agg.retainerCollected;
  const pctCollected = agg.retainerExpected > 0 ? Math.round((agg.retainerCollected / agg.retainerExpected) * 100) : 0;

  const monthlyRevenue = months.map((m) =>
    clients.reduce((s, c) => {
      const st = clientMonthStats(c, m);
      return s + st.fees + (st.paid ? st.retainerAmt : 0);
    }, 0)
  );

  function clientTotalRevenue(client, scopeMonths) {
    return scopeMonths.reduce((s, m) => {
      const st = clientMonthStats(client, m);
      return s + st.fees + (st.paid ? st.retainerAmt : 0);
    }, 0);
  }
  function highLow(scopeMonths) {
    const list = clients.map((c) => ({ name: c.company_name, total: clientTotalRevenue(c, scopeMonths) })).filter((c) => c.total > 0);
    if (list.length === 0) return { high: null, low: null };
    const sorted = [...list].sort((a, b) => b.total - a.total);
    return { high: sorted[0], low: sorted[sorted.length - 1] };
  }
  const monthHL = highLow([currentMonth]);
  const yearHL = highLow(months);

  const unpaidThisMonth = clients.filter((c) => !clientMonthStats(c, currentMonth).paid);

  // Predictable revenue next month — assumes every client's retainer gets paid again
  const predictableNextMonth = clients.reduce((s, c) => s + retainerForClient(c), 0);

  // Average revenue per client, scoped to whichever view is active
  const avgRevenuePerClient = clients.length > 0 ? totalRevenue / clients.length : 0;

  // Revenue by plan tier, scoped to whichever view is active
  const scopeMonths = view === "month" ? [currentMonth] : months;
  const tierGroups = {};
  clients.forEach((c) => {
    const tier = c.plan_tier;
    tierGroups[tier] = tierGroups[tier] || { count: 0, revenue: 0 };
    tierGroups[tier].count += 1;
    tierGroups[tier].revenue += clientTotalRevenue(c, scopeMonths);
  });
  const tierRows = Object.entries(tierGroups).sort((a, b) => b[1].revenue - a[1].revenue);

  // Revenue growth vs. last month (always month-over-month, regardless of the view toggle)
  const prevMonth = prevMonthKey(currentMonth);
  const prevMonthAgg = aggregateOver([prevMonth]);
  const prevMonthRevenue = prevMonthAgg.fees + prevMonthAgg.retainerCollected;
  const growthPct = prevMonthRevenue > 0
    ? Math.round(((thisMonthAgg.fees + thisMonthAgg.retainerCollected - prevMonthRevenue) / prevMonthRevenue) * 100)
    : null;

  // Client concentration — how much of this scope's revenue rides on the single biggest client
  const topClient = view === "month" ? monthHL.high : yearHL.high;
  const concentrationPct = topClient && totalRevenue > 0 ? Math.round((topClient.total / totalRevenue) * 100) : null;

  async function markPaid(client) {
    const { error } = await supabase.from("retainer_payments").upsert({
      client_id: client.id, month: currentMonth, paid: true, marked_by: session.user.email, marked_at: new Date().toISOString(),
    }, { onConflict: "client_id,month" });
    if (!error) {
      await logActivity(session, `marked the ${monthLabel(currentMonth)} retainer as paid for ${client.company_name} (from Revenue).`);
      load();
    }
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function downloadCSV() {
    const rows = [["Date", "Client", "Client #", "Traveler", "Type", "Amount"]];

    scopeMonths.forEach((m) => {
      clients.forEach((c) => {
        const retRow = retainers.find((r) => r.client_id === c.id && r.month === m);
        if (retRow?.paid) {
          rows.push([m, c.company_name, c.client_number || "", "", "Retainer", retainerForClient(c)]);
        }
      });
    });

    expenses
      .filter((e) => scopeMonths.includes(e.entry_date.slice(0, 7) + "-01"))
      .forEach((e) => {
        const c = clients.find((cl) => cl.id === e.client_id);
        if (Number(e.fee) > 0) {
          rows.push([e.entry_date, c?.company_name || "", c?.client_number || "", e.traveler_name, `Booking fee (${e.category})`, e.fee]);
        }
      });

    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const label = view === "month" ? currentMonth.slice(0, 7) : `${currentMonth.slice(0, 4)}-YTD`;
    a.href = url;
    a.download = `OneStone-Revenue-${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printSummary() {
    const win = window.open("", "_blank");
    const scopeLabel = view === "month" ? monthLabel(currentMonth) : `Jan–${monthLabel(currentMonth).split(" ")[0]} ${currentMonth.slice(0, 4)} (YTD)`;
    win.document.write(`
      <html><head><title>OneStone Revenue — ${scopeLabel}</title>
      <style>
        body{font-family:Georgia,serif;padding:40px;color:#23262B;max-width:640px;margin:0 auto;}
        h1{font-size:22px;margin-bottom:2px;}
        .meta{color:#5B6270;font-size:13px;margin-bottom:24px;}
        table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;}
        td,th{padding:8px 0;border-bottom:1px solid #E2E6EB;text-align:left;}
        td:last-child,th:last-child{text-align:right;}
      </style></head><body>
      <h1>OneStone Travel — Revenue Summary</h1>
      <div class="meta">${scopeLabel}</div>
      <table>
        <tr><td>Retainers collected</td><td>$${agg.retainerCollected.toLocaleString()}</td></tr>
        <tr><td>Booking fees collected</td><td>$${agg.fees.toLocaleString()}</td></tr>
        <tr><td><b>Total revenue</b></td><td><b>$${totalRevenue.toLocaleString()}</b></td></tr>
      </table>
      <h1 style="font-size:16px;">Revenue by client</h1>
      <table>
        <tr><th>Client</th><th>Revenue</th></tr>
        ${clients.map((c) => `<tr><td>${c.company_name}</td><td>$${clientTotalRevenue(c, scopeMonths).toLocaleString()}</td></tr>`).join("")}
      </table>
      <h1 style="font-size:16px;">Revenue by plan tier</h1>
      <table>
        <tr><th>Plan</th><th>Revenue</th></tr>
        ${tierRows.map(([tier, data]) => `<tr><td>${tier} (${data.count} clients)</td><td>$${data.revenue.toLocaleString()}</td></tr>`).join("")}
      </table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  return (
    <div className="panel">
      <h2>Revenue</h2>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button className={view === "month" ? "navy" : "ghost"} onClick={() => setView("month")}>
          This month ({monthLabel(currentMonth).split(" ")[0]})
        </button>
        <button className={view === "ytd" ? "navy" : "ghost"} onClick={() => setView("ytd")}>
          Year to date (Jan–{monthLabel(currentMonth).split(" ")[0]})
        </button>
      </div>

      <div className="rev-cards">
        <div className="rev-card"><div className="l">Flight ticket volume processed</div><div className="v">${agg.flightVol.toLocaleString()}</div></div>
        <div className="rev-card"><div className="l">Booking fees collected</div><div className="v">${agg.fees.toLocaleString()}</div></div>
        <div className="rev-card"><div className="l">Retainers collected</div><div className="v">${agg.retainerCollected.toLocaleString()}</div></div>
        <div className="rev-card accent"><div className="l">Total OneStone revenue (fees + retainers)</div><div className="v">${totalRevenue.toLocaleString()}</div></div>
      </div>
      <p className="muted" style={{ fontStyle: "italic", marginTop: -8, marginBottom: 20 }}>
        Flight volume is client spend processed on their behalf, not OneStone revenue — shown separately from actual OneStone revenue (fees + retainers) above.
        Retainer collection rate: <b style={{ color: "var(--navy)" }}>{pctCollected}%</b> of ${agg.retainerExpected.toLocaleString()} expected.
      </p>

      <div className="section-label">Monthly OneStone revenue (fees + retainers), Jan–{monthLabel(currentMonth).split(" ")[0]}</div>
      <div dangerouslySetInnerHTML={{ __html: barChart(monthlyRevenue, months.map(monthLabel), true) }} />

      <div className="section-label">Additional metrics</div>
      <div className="rev-cards">
        <div className="rev-card"><div className="l">Predictable revenue next month (retainers only)</div><div className="v">${predictableNextMonth.toLocaleString()}</div></div>
        <div className="rev-card"><div className="l">Average revenue per client ({view === "month" ? "this month" : "YTD"})</div><div className="v">${avgRevenuePerClient.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
        <div className="rev-card">
          <div className="l">Revenue growth vs. last month</div>
          <div className="v" style={{ color: growthPct === null ? undefined : growthPct >= 0 ? "var(--green)" : "var(--red)" }}>
            {growthPct === null ? "—" : `${growthPct > 0 ? "+" : ""}${growthPct}%`}
          </div>
        </div>
        <div className="rev-card">
          <div className="l">Client concentration risk</div>
          <div className="v" style={{ fontSize: 15 }}>
            {concentrationPct === null ? "—" : `${concentrationPct}% from ${topClient.name}`}
          </div>
        </div>
      </div>

      <div className="section-label">Revenue by plan tier — {view === "month" ? monthLabel(currentMonth) : `Jan–${monthLabel(currentMonth).split(" ")[0]}`}</div>
      <div className="tbl-wrap" style={{ marginBottom: 20 }}>
        <table className="k">
          <thead><tr><th>Plan tier</th><th>Clients</th><th>Revenue</th></tr></thead>
          <tbody>
            {tierRows.length === 0 ? (
              <tr><td colSpan={3} className="empty">No data yet.</td></tr>
            ) : (
              tierRows.map(([tier, data]) => (
                <tr key={tier}>
                  <td><span className="plan-tag">{tier}</span></td>
                  <td>{data.count}</td>
                  <td>${data.revenue.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="section-label">Highest and lowest paying clients</div>
      <div className="rev-cards">
        <div className="rev-card"><div className="l">Highest this month</div><div className="v" style={{ fontSize: 16 }}>{monthHL.high ? `${monthHL.high.name} — $${monthHL.high.total.toLocaleString()}` : "—"}</div></div>
        <div className="rev-card"><div className="l">Lowest this month</div><div className="v" style={{ fontSize: 16 }}>{monthHL.low ? `${monthHL.low.name} — $${monthHL.low.total.toLocaleString()}` : "—"}</div></div>
        <div className="rev-card"><div className="l">Highest this year</div><div className="v" style={{ fontSize: 16 }}>{yearHL.high ? `${yearHL.high.name} — $${yearHL.high.total.toLocaleString()}` : "—"}</div></div>
        <div className="rev-card"><div className="l">Lowest this year</div><div className="v" style={{ fontSize: 16 }}>{yearHL.low ? `${yearHL.low.name} — $${yearHL.low.total.toLocaleString()}` : "—"}</div></div>
      </div>

      <div className="section-label">By client — {view === "month" ? monthLabel(currentMonth) : `Jan–${monthLabel(currentMonth).split(" ")[0]}`}</div>
      <div className="tbl-wrap" style={{ marginBottom: 20 }}>
        <table className="k">
          <thead>
            <tr><th>Client</th><th>Plan</th><th>Flight volume</th><th>Fees</th><th>Retainer</th><th>Retainer status</th></tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              if (view === "month") {
                const s = clientMonthStats(c, currentMonth);
                return (
                  <tr key={c.id}>
                    <td className="cnum">{c.company_name}</td>
                    <td><span className="plan-tag">{c.plan_tier}</span></td>
                    <td>${s.flightVol.toLocaleString()}</td>
                    <td>${s.fees.toLocaleString()}</td>
                    <td>${s.retainerAmt.toLocaleString()}</td>
                    <td><span className={`check-pill ${s.paid ? "paid" : "unpaid"}`}>{s.paid ? "✓ Paid" : "Unpaid"}</span></td>
                  </tr>
                );
              }
              const flightVol = months.reduce((s, m) => s + clientMonthStats(c, m).flightVol, 0);
              const fees = months.reduce((s, m) => s + clientMonthStats(c, m).fees, 0);
              const paidCount = months.filter((m) => clientMonthStats(c, m).paid).length;
              const retainerCollected = paidCount * retainerForClient(c);
              return (
                <tr key={c.id}>
                  <td className="cnum">{c.company_name}</td>
                  <td><span className="plan-tag">{c.plan_tier}</span></td>
                  <td>${flightVol.toLocaleString()}</td>
                  <td>${fees.toLocaleString()}</td>
                  <td>${retainerCollected.toLocaleString()}</td>
                  <td><span className={`check-pill ${paidCount === months.length ? "paid" : "unpaid"}`}>{paidCount}/{months.length} paid</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="section-label">Retainers outstanding this month</div>
      {unpaidThisMonth.length === 0 ? (
        <div className="empty">Everyone's paid up for {monthLabel(currentMonth)}.</div>
      ) : (
        <div className="tbl-wrap">
          {unpaidThisMonth.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--navy)" }}>{c.company_name}</div>
                <div className="muted">{c.client_number} &middot; {c.plan_tier} plan &middot; ${retainerForClient(c).toLocaleString()}/mo &middot; due the {c.retainer_due_day || 1}{c.retainer_due_day === 1 ? "st" : "th"}</div>
              </div>
              <button className="navy" onClick={() => markPaid(c)}>Mark paid</button>
            </div>
          ))}
        </div>
      )}

      <div className="section-label">Reports</div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="navy" onClick={downloadCSV}>Download revenue CSV ({view === "month" ? "this month" : "YTD"})</button>
        <button className="ghost" onClick={printSummary}>Print summary report</button>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        The CSV lists every retainer and booking fee transaction — ready to hand to a tax professional or import into QuickBooks.
        The summary is a clean one-page printout of the totals above.
      </p>
    </div>
  );
}
