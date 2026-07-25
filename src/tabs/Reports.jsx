import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { monthLabel, logActivity } from "../shared";

export default function Reports({ session }) {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const now = new Date();
  const [monthInput, setMonthInput] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  useEffect(() => {
    supabase.from("clients").select("*").order("company_name").then(({ data }) => setClients(data || []));
  }, []);

  async function generate() {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const monthKey = `${monthInput}-01`;

    const { data: expenses } = await supabase
      .from("client_expenses")
      .select("*")
      .eq("client_id", clientId)
      .gte("entry_date", monthKey)
      .lt("entry_date", nextMonth(monthKey));

    const { data: retainer } = await supabase
      .from("retainer_payments")
      .select("*")
      .eq("client_id", clientId)
      .eq("month", monthKey)
      .maybeSingle();

    const travelRows = (expenses || []).filter((e) => e.category !== "Booking Fee");
    const spend = travelRows.reduce((s, e) => s + Number(e.amount), 0);
    const fees = (expenses || []).reduce((s, e) => s + Number(e.fee), 0);
    const catTotal = (cat) => travelRows.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0);
    const pct = Math.round((spend / (client.monthly_threshold || 1)) * 100);

    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>${client.company_name} — ${monthLabel(monthKey)}</title>
      <style>
        body{font-family:Georgia,serif;padding:40px;color:#23262B;max-width:600px;margin:0 auto;}
        h1{font-size:22px;margin-bottom:2px;}
        .meta{color:#5B6270;font-size:13px;margin-bottom:24px;}
        table{width:100%;border-collapse:collapse;font-size:14px;}
        td{padding:8px 0;border-bottom:1px solid #E2E6EB;}
        td:last-child{text-align:right;}
      </style></head><body>
      <h1>${client.company_name} — Monthly Report</h1>
      <div class="meta">${client.client_number || ""} &middot; ${client.plan_tier} plan &middot; Authorized: ${client.authorized_person || "—"} &middot; ${monthLabel(monthKey)}</div>
      <table>
        <tr><td>Monthly threshold</td><td>$${(client.monthly_threshold || 0).toLocaleString()}</td></tr>
        <tr><td>Total travel spend</td><td>$${spend.toLocaleString()} (${pct}%)</td></tr>
        <tr><td>Flights</td><td>$${catTotal("Flight").toLocaleString()}</td></tr>
        <tr><td>Hotels</td><td>$${catTotal("Hotel").toLocaleString()}</td></tr>
        <tr><td>Cars</td><td>$${catTotal("Car").toLocaleString()}</td></tr>
        <tr><td>Booking fees</td><td>$${fees.toLocaleString()}</td></tr>
        <tr><td>Retainer</td><td>${retainer?.paid ? "Paid" : "Unpaid"}</td></tr>
      </table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);

    await logActivity(session, `generated a ${monthLabel(monthKey)} report for ${client.company_name}.`);
  }

  function nextMonth(monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }

  return (
    <div className="panel">
      <h2>Reports</h2>
      <div className="form-grid">
        <div>
          <label>Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select a client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        <div>
          <label>Month</label>
          <input type="month" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} />
        </div>
      </div>
      <button className="navy" style={{ marginTop: 18 }} onClick={generate} disabled={!clientId}>
        Generate &amp; print report
      </button>
      <p className="muted" style={{ marginTop: 14 }}>Opens a print-ready report in a new tab — save as PDF from your browser's print dialog to email to the client.</p>
    </div>
  );
}
