import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { currentMonthKey, prevMonthKey, nextMonthKey, monthLabel, localDateStr, logActivity, fetchExpenseTotals, hoursWorked } from "../shared";

const CATEGORIES = ["Software & Subscriptions", "Payroll (one-off)", "Office & Rent", "Marketing", "Insurance", "Staff Travel", "Other"];

export default function Expense({ session }) {
  const [viewMonth, setViewMonth] = useState(currentMonthKey());
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ category: CATEGORIES[0], description: "", amount: "", expense_date: localDateStr() });
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({ amount: "", description: "" });
  const [payrollMonth, setPayrollMonth] = useState(0);
  const [payrollYtd, setPayrollYtd] = useState(0);

  async function loadPayroll() {
    const monthTotals = await fetchExpenseTotals([viewMonth]);
    setPayrollMonth(monthTotals.payroll);

    const now = new Date();
    const yearMonths = [];
    for (let i = 0; i <= now.getMonth(); i++) {
      yearMonths.push(`${now.getFullYear()}-${String(i + 1).padStart(2, "0")}-01`);
    }
    const ytdTotals = await fetchExpenseTotals(yearMonths);
    setPayrollYtd(ytdTotals.payroll);
  }

  async function load() {
    const { data } = await supabase
      .from("business_expenses")
      .select("*")
      .gte("expense_date", viewMonth)
      .lt("expense_date", nextMonthKey(viewMonth))
      .order("expense_date", { ascending: false });
    setEntries(data || []);
  }

  useEffect(() => { load(); loadPayroll(); }, [viewMonth]);

  const total = entries.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = CATEGORIES.map((cat) => ({
    cat, total: entries.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
  })).filter((c) => c.total > 0);

  async function submit(e) {
    e.preventDefault();
    const amount = parseFloat(form.amount) || 0;
    if (amount <= 0) return;
    await supabase.from("business_expenses").insert({
      category: form.category,
      description: form.description || null,
      amount,
      expense_date: form.expense_date,
      created_by: session.user.email,
    });
    await logActivity(session, `logged a $${amount.toLocaleString()} ${form.category} business expense.`);
    setForm({ category: CATEGORIES[0], description: "", amount: "", expense_date: localDateStr() });
    load();
  }

  function openEdit(entry) {
    setEditingEntry(entry);
    setEditForm({ amount: entry.amount, description: entry.description || "" });
  }

  async function saveEdit() {
    await supabase.from("business_expenses").update({
      amount: parseFloat(editForm.amount) || 0,
      description: editForm.description,
    }).eq("id", editingEntry.id);
    await logActivity(session, `edited a business expense entry (${editingEntry.category}).`);
    setEditingEntry(null);
    load();
  }

  async function remove(entry) {
    if (!confirm("Remove this expense entry?")) return;
    await supabase.from("business_expenses").delete().eq("id", entry.id);
    await logActivity(session, `removed a $${entry.amount} ${entry.category} business expense.`);
    load();
  }

  async function printPayrollReport() {
    const { data: sheets } = await supabase
      .from("timesheets")
      .select("*")
      .gte("work_date", viewMonth)
      .lt("work_date", nextMonthKey(viewMonth));

    const byStaff = {};
    (sheets || []).forEach((s) => {
      byStaff[s.staff_name] = byStaff[s.staff_name] || { hours: 0, pay: 0 };
      const h = hoursWorked(s);
      byStaff[s.staff_name].hours += h;
      byStaff[s.staff_name].pay += h * Number(s.hourly_rate || 0);
    });

    const rows = Object.entries(byStaff);
    const totalHours = rows.reduce((s, [, v]) => s + v.hours, 0);
    const totalPay = rows.reduce((s, [, v]) => s + v.pay, 0);

    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Payroll Report — ${monthLabel(viewMonth)}</title>
      <style>
        body{font-family:Georgia,serif;padding:40px;color:#23262B;max-width:640px;margin:0 auto;}
        h1{font-size:20px;margin-bottom:2px;}
        .meta{color:#5B6270;font-size:13px;margin-bottom:24px;}
        table{width:100%;border-collapse:collapse;font-size:13px;}
        td,th{padding:7px 0;border-bottom:1px solid #E2E6EB;text-align:left;}
        td:last-child,th:last-child{text-align:right;}
      </style></head><body>
      <h1>OneStone Travel — Payroll Report</h1>
      <div class="meta">${monthLabel(viewMonth)}</div>
      <table>
        <tr><th>Staff</th><th>Hours</th><th>Pay</th></tr>
        ${rows.map(([name, v]) => `<tr><td>${name}</td><td>${v.hours.toFixed(2)}</td><td>$${v.pay.toFixed(2)}</td></tr>`).join("")}
        <tr><td><b>Total</b></td><td><b>${totalHours.toFixed(2)}</b></td><td><b>$${totalPay.toFixed(2)}</b></td></tr>
      </table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  return (
    <div className="panel">
      <div className="sec-head" style={{ margin: "0 0 16px" }}>
        <h2 style={{ margin: 0 }}>Expense — OneStone's own operating costs</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="ghost" onClick={() => setViewMonth(prevMonthKey(viewMonth))}>&larr;</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{monthLabel(viewMonth)}</span>
          <button className="ghost" onClick={() => setViewMonth(nextMonthKey(viewMonth))}>&rarr;</button>
          {viewMonth !== currentMonthKey() && <button className="ghost" onClick={() => setViewMonth(currentMonthKey())}>Today</button>}
        </div>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 18 }}>
        This is separate from client travel spend (that lives in Billing) — this tracks what OneStone itself spends to operate.
      </p>

      <div className="rev-cards">
        <div className="rev-card"><div className="l">Manual expenses — {monthLabel(viewMonth)}</div><div className="v">${total.toLocaleString()}</div></div>
        <div className="rev-card"><div className="l">Payroll (from Time tab) — {monthLabel(viewMonth)}</div><div className="v">${payrollMonth.toLocaleString()}</div></div>
        <div className="rev-card"><div className="l">Payroll — year to date</div><div className="v">${payrollYtd.toLocaleString()}</div></div>
        <div className="rev-card accent"><div className="l">Total operating expenses — {monthLabel(viewMonth)}</div><div className="v">${(total + payrollMonth).toLocaleString()}</div></div>
      </div>
      <p className="muted" style={{ marginTop: 10, marginBottom: 18 }}>
        Payroll is calculated automatically from hours logged in the Time tab × each staff member's hourly rate (set in Team/Users) —
        no need to enter it manually here. The "Payroll (one-off)" category below is only for exceptions like bonuses or contractor payments.
      </p>
      <div className="rev-cards">
        <div className="rev-card">
          <div className="l">Payroll as % of total expense</div>
          <div className="v">{(total + payrollMonth) > 0 ? Math.round((payrollMonth / (total + payrollMonth)) * 100) : 0}%</div>
        </div>
      </div>

      <div className="section-label">Reports</div>
      <button className="navy" onClick={printPayrollReport}>Print payroll report — {monthLabel(viewMonth)}</button>

      <div className="section-label" style={{ marginTop: 24 }}>By category</div>
      {byCategory.length === 0 ? (
        <div className="empty">No expenses logged for {monthLabel(viewMonth)} yet.</div>
      ) : (
        <div className="tbl-wrap" style={{ marginBottom: 20 }}>
          <table className="k">
            <thead><tr><th>Category</th><th>Total</th></tr></thead>
            <tbody>
              {byCategory.map((c) => (
                <tr key={c.cat}><td className="cnum">{c.cat}</td><td>${c.total.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-label">Log an expense</div>
      <form className="entry-form" onSubmit={submit}>
        <div>
          <label>Category</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label>Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" /></div>
        <div><label>Amount ($)</label><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <div><label>Date</label><input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
        <div><button type="submit">Add</button></div>
      </form>

      <div className="section-label">Entry log</div>
      {entries.length === 0 ? (
        <div className="empty">No entries for {monthLabel(viewMonth)}.</div>
      ) : (
        entries.map((e) => (
          <div className="log-row" key={e.id} style={{ gridTemplateColumns: "80px 1fr 140px 80px auto" }}>
            <span className="muted">{e.expense_date.slice(5)}</span>
            <span>{e.description || "—"}</span>
            <span className="muted">{e.category}</span>
            <span>${e.amount}</span>
            <span className="log-actions">
              <button className="icon-btn" onClick={() => openEdit(e)}>Edit</button>
              <button className="icon-btn" onClick={() => remove(e)}>Remove</button>
            </span>
          </div>
        ))
      )}

      {editingEntry && (
        <div className="modal-overlay show" onClick={(ev) => { if (ev.target === ev.currentTarget) setEditingEntry(null); }}>
          <div className="modal-box">
            <h3>Edit expense</h3>
            <div className="modal-sub">{editingEntry.category}</div>
            <label>Amount ($)</label>
            <input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
            <label>Description</label>
            <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            <div className="modal-actions">
              <button className="ghost" onClick={() => setEditingEntry(null)}>Cancel</button>
              <button onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
