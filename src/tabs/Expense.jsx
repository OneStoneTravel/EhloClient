import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { currentMonthKey, monthLabel } from "../shared";

export default function Expense({ session }) {
  const [clients, setClients] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const month = currentMonthKey();

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from("clients").select("*");
      setClients(c || []);
      const { data: e } = await supabase.from("client_expenses").select("*").gte("entry_date", month);
      setExpenses((e || []).filter((row) => row.entry_date.slice(0, 7) === month.slice(0, 7)));
    }
    load();
  }, []);

  const travelRows = expenses.filter((e) => e.category !== "Booking Fee");
  const catTotal = (cat) => travelRows.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0);
  const totalTravel = travelRows.reduce((s, e) => s + Number(e.amount), 0);

  const byClient = clients.map((c) => {
    const rows = travelRows.filter((e) => e.client_id === c.id);
    return { name: c.company_name, total: rows.reduce((s, r) => s + Number(r.amount), 0) };
  }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="panel">
      <h2>Expense — {monthLabel(month)}</h2>

      <div className="rev-cards">
        <div className="rev-card"><div className="l">Flights</div><div className="v">${catTotal("Flight").toLocaleString()}</div></div>
        <div className="rev-card"><div className="l">Hotels</div><div className="v">${catTotal("Hotel").toLocaleString()}</div></div>
        <div className="rev-card"><div className="l">Cars</div><div className="v">${catTotal("Car").toLocaleString()}</div></div>
        <div className="rev-card accent"><div className="l">Total travel spend</div><div className="v">${totalTravel.toLocaleString()}</div></div>
      </div>

      <div className="section-label">Top clients by spend this month</div>
      {byClient.length === 0 ? (
        <div className="empty">No expenses logged yet this month.</div>
      ) : (
        <div className="tbl-wrap">
          <table className="k">
            <thead><tr><th>Client</th><th>Total spend</th></tr></thead>
            <tbody>
              {byClient.map((c) => (
                <tr key={c.name}><td className="cnum">{c.name}</td><td>${c.total.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
