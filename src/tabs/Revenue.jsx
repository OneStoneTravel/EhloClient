import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { planByKey, currentMonthKey, monthLabel, barChart } from "../shared";

export default function Revenue({ session }) {
  const [clients, setClients] = useState([]);
  const [retainers, setRetainers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [months, setMonths] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from("clients").select("*");
      setClients(c || []);

      const now = new Date();
      const m = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        m.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
      }
      setMonths(m);

      const { data: r } = await supabase.from("retainer_payments").select("*").gte("month", m[0]);
      setRetainers(r || []);

      const { data: e } = await supabase.from("client_expenses").select("fee, entry_date").gte("entry_date", m[0]);
      setExpenses(e || []);
    }
    load();
  }, []);

  const month = currentMonthKey();
  const retainerForClient = (c) => planByKey(c.plan_tier).retainer;

  const retainerPaidThisMonth = clients.reduce((s, c) => {
    const row = retainers.find((r) => r.client_id === c.id && r.month === month);
    return row?.paid ? s + retainerForClient(c) : s;
  }, 0);
  const retainerExpectedThisMonth = clients.reduce((s, c) => s + retainerForClient(c), 0);
  const feesThisMonth = expenses.filter((e) => e.entry_date.slice(0, 7) === month.slice(0, 7)).reduce((s, e) => s + Number(e.fee), 0);
  const totalThisMonth = retainerPaidThisMonth + feesThisMonth;

  const revenueByMonth = months.map((m) => {
    const retainerSum = clients.reduce((s, c) => {
      const row = retainers.find((r) => r.client_id === c.id && r.month === m);
      return row?.paid ? s + retainerForClient(c) : s;
    }, 0);
    const feeSum = expenses.filter((e) => e.entry_date.slice(0, 7) === m.slice(0, 7)).reduce((s, e) => s + Number(e.fee), 0);
    return retainerSum + feeSum;
  });

  const unpaidClients = clients.filter((c) => {
    const row = retainers.find((r) => r.client_id === c.id && r.month === month);
    return !row?.paid;
  });

  return (
    <div className="panel">
      <h2>Revenue</h2>

      <div className="rev-cards">
        <div className="rev-card">
          <div className="l">Retainer collected ({monthLabel(month)})</div>
          <div className="v">${retainerPaidThisMonth.toLocaleString()}</div>
        </div>
        <div className="rev-card">
          <div className="l">Retainer expected</div>
          <div className="v">${retainerExpectedThisMonth.toLocaleString()}</div>
        </div>
        <div className="rev-card">
          <div className="l">Booking fees this month</div>
          <div className="v">${feesThisMonth.toLocaleString()}</div>
        </div>
        <div className="rev-card accent">
          <div className="l">Total revenue this month</div>
          <div className="v">${totalThisMonth.toLocaleString()}</div>
        </div>
      </div>

      <div className="section-label">Revenue by month (retainer + fees)</div>
      <div dangerouslySetInnerHTML={{ __html: barChart(revenueByMonth, months.map(monthLabel)) }} />

      <div className="section-label">Outstanding retainers this month</div>
      {unpaidClients.length === 0 ? (
        <div className="empty">Everyone's paid up for {monthLabel(month)}.</div>
      ) : (
        <div className="tbl-wrap">
          <table className="k">
            <thead><tr><th>Client</th><th>Plan</th><th>Amount owed</th></tr></thead>
            <tbody>
              {unpaidClients.map((c) => (
                <tr key={c.id}>
                  <td className="cnum">{c.company_name}</td>
                  <td><span className="plan-tag">{c.plan_tier}</span></td>
                  <td>${retainerForClient(c).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="muted" style={{ marginTop: 10, fontSize: 11.5 }}>
        Mark retainers as paid from the Billing tab — this view just reflects what's already recorded there.
      </div>
    </div>
  );
}
