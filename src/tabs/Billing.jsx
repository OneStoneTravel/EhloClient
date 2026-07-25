import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  statusColor, sparkline, suggestedFee, currentMonthKey, nextMonthKey, prevMonthKey, monthLabel, localDateStr, logActivity, planByKey,
} from "../shared";
import Modal from "../Modal";
import ClientNotes from "../ClientNotes";

export default function Billing({ session }) {
  const [clients, setClients] = useState([]);
  const [travelers, setTravelers] = useState([]);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [retainerRow, setRetainerRow] = useState(null);
  const [trend, setTrend] = useState([]);
  const [entryForm, setEntryForm] = useState({ traveler: "", category: "Flight", amount: "", fee: "", date: localDateStr() });
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({ amount: "", fee: "" });
  const [reportHtml, setReportHtml] = useState(null);
  const [viewMonth, setViewMonth] = useState(currentMonthKey());
  const [ytdSpend, setYtdSpend] = useState(0);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const month = viewMonth;
  const active = clients.find((c) => c.id === activeId);
  const clientTravelers = travelers.filter((t) => t.client_id === activeId);

  async function loadClients() {
    const { data } = await supabase.from("clients").select("*").order("company_name");
    setClients(data || []);
    if (!activeId && data && data.length > 0) setActiveId(data[0].id);
  }
  async function loadTravelers() {
    const { data } = await supabase.from("travelers").select("*");
    setTravelers(data || []);
  }

  useEffect(() => { loadClients(); loadTravelers(); }, []);

  async function loadClientData(id) {
    if (!id) return;
    const { data: exp } = await supabase
      .from("client_expenses")
      .select("*")
      .eq("client_id", id)
      .gte("entry_date", month)
      .lt("entry_date", nextMonthKey(month))
      .order("entry_date", { ascending: false });
    setExpenses(exp || []);

    const { data: ret } = await supabase
      .from("retainer_payments")
      .select("*")
      .eq("client_id", id)
      .eq("month", month)
      .maybeSingle();
    setRetainerRow(ret);

    // Year-to-date travel spend, always relative to the current real year
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const { data: ytd } = await supabase
      .from("client_expenses")
      .select("amount, category")
      .eq("client_id", id)
      .neq("category", "Booking Fee")
      .gte("entry_date", yearStart);
    setYtdSpend((ytd || []).reduce((s, e) => s + Number(e.amount), 0));

    // Last 6 months of total travel spend, for the trend line
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    }
    const { data: allExp } = await supabase
      .from("client_expenses")
      .select("amount, category, entry_date")
      .eq("client_id", id)
      .neq("category", "Booking Fee")
      .gte("entry_date", months[0]);
    const byMonth = months.map((m) =>
      (allExp || []).filter((e) => e.entry_date.slice(0, 7) === m.slice(0, 7))
        .reduce((s, e) => s + Number(e.amount), 0)
    );
    setTrend(byMonth);
  }

  useEffect(() => { loadClientData(activeId); }, [activeId, viewMonth]);

  const travelSpend = expenses.filter((e) => e.category !== "Booking Fee").reduce((s, e) => s + Number(e.amount), 0);
  const feesCollected = expenses.reduce((s, e) => s + Number(e.fee), 0);
  const pct = active ? Math.round((travelSpend / (active.monthly_threshold || 1)) * 100) : 0;
  const st = statusColor(pct);

  function categoryTotal(cat) {
    return expenses.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0);
  }

  const travelerBreakdown = clientTravelers.map((t) => {
    const rows = expenses.filter((e) => e.traveler_name === t.name);
    const flight = rows.filter((r) => r.category === "Flight").reduce((s, r) => s + Number(r.amount), 0);
    const hotel = rows.filter((r) => r.category === "Hotel").reduce((s, r) => s + Number(r.amount), 0);
    const car = rows.filter((r) => r.category === "Car").reduce((s, r) => s + Number(r.amount), 0);
    const fees = rows.reduce((s, r) => s + Number(r.fee), 0);
    return { name: t.name, flight, hotel, car, fees, total: flight + hotel + car };
  });

  async function toggleRetainer() {
    const nowPaid = !(retainerRow?.paid);
    const { data, error } = await supabase.from("retainer_payments").upsert({
      client_id: activeId, month, paid: nowPaid, marked_by: session.user.email, marked_at: new Date().toISOString(),
    }, { onConflict: "client_id,month" }).select().single();
    if (!error) {
      setRetainerRow(data);
      await logActivity(session, `marked the ${monthLabel(month)} retainer as ${nowPaid ? "paid" : "unpaid"} for ${active.company_name}.`);
    }
  }

  async function logExpense(e) {
    e.preventDefault();
    const amount = parseFloat(entryForm.amount) || 0;
    if (amount <= 0 || !entryForm.traveler) return;
    const fee = entryForm.fee === "" ? suggestedFee(active.plan_tier, entryForm.category) : parseFloat(entryForm.fee);

    await supabase.from("client_expenses").insert({
      client_id: activeId,
      traveler_name: entryForm.traveler,
      category: entryForm.category,
      amount,
      fee,
      entry_date: entryForm.date || localDateStr(),
      created_by: session.user.email,
    });
    await logActivity(session, `logged a $${amount.toLocaleString()} ${entryForm.category} entry for ${entryForm.traveler} at ${active.company_name} ($${fee} fee).`);
    setEntryForm({ traveler: "", category: "Flight", amount: "", fee: "", date: localDateStr() });
    loadClientData(activeId);
  }

  function openEditEntry(entry) {
    setEditingEntry(entry);
    setEditForm({ amount: entry.amount, fee: entry.fee });
  }

  async function saveEditEntry() {
    const { error } = await supabase.from("client_expenses").update({
      amount: parseFloat(editForm.amount) || 0,
      fee: parseFloat(editForm.fee) || 0,
    }).eq("id", editingEntry.id);
    if (!error) {
      await logActivity(session, `edited a ${editingEntry.category} entry for ${editingEntry.traveler_name} at ${active.company_name}.`);
      setEditingEntry(null);
      loadClientData(activeId);
    }
  }

  async function deleteEntry(entry) {
    if (!confirm("Remove this entry? This can't be undone.")) return;
    await supabase.from("client_expenses").delete().eq("id", entry.id);
    await logActivity(session, `removed a $${entry.amount} ${entry.category} entry for ${entry.traveler_name} at ${active.company_name}.`);
    loadClientData(activeId);
  }

  function generateReport() {
    setReportHtml(`
      <h4>${active.company_name} — ${monthLabel(month)}</h4>
      <div class="report-line"><span>Plan</span><span>${active.plan_tier}</span></div>
      <div class="report-line"><span>Monthly threshold</span><span>$${(active.monthly_threshold || 0).toLocaleString()}</span></div>
      <div class="report-line"><span>Total travel spend</span><span>$${travelSpend.toLocaleString()} (${pct}%)</span></div>
      <div class="report-line"><span>Flights</span><span>$${categoryTotal("Flight").toLocaleString()}</span></div>
      <div class="report-line"><span>Hotels</span><span>$${categoryTotal("Hotel").toLocaleString()}</span></div>
      <div class="report-line"><span>Cars</span><span>$${categoryTotal("Car").toLocaleString()}</span></div>
      <div class="report-line"><span>Booking fees</span><span>$${feesCollected.toLocaleString()}</span></div>
      <div class="report-line"><span>Retainer</span><span>${retainerRow?.paid ? "Paid" : "Unpaid"}</span></div>
    `);
  }

  const filteredClients = clients.filter((c) =>
    !search || (c.company_name + (c.client_number || "")).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="panel">
      <h2>Billing</h2>
      <div className="layout">
        <div>
          <input className="search-input" placeholder="Search client..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="list">
            {filteredClients.map((c) => (
              <div key={c.id} className={`card-row ${c.id === activeId ? "active" : ""}`} onClick={() => setActiveId(c.id)}>
                <div className="row-name">{c.company_name}</div>
                <div className="row-num">{c.client_number}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {!active ? (
            <div className="empty">Select a client to see their account.</div>
          ) : (
            <div>
              <div className="dtop">
                <div>
                  <div className="dname">{active.company_name}</div>
                  <div className="dmeta">
                    {active.client_number} &middot; Authorized: {active.authorized_person || "—"} &middot; {active.contact_phone || "—"}
                    {active.authorized_email ? ` · ${active.authorized_email}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="plan-tag" style={{ cursor: "pointer" }} onClick={() => setShowPlanModal(true)}>
                    {active.plan_tier} plan · ${planByKey(active.plan_tier).retainer.toLocaleString()}/mo
                  </span>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                    <button className="ghost" onClick={() => setViewMonth(prevMonthKey(viewMonth))}>&larr;</button>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--navy)" }}>{monthLabel(viewMonth)}</span>
                    <button className="ghost" onClick={() => setViewMonth(nextMonthKey(viewMonth))}>&rarr;</button>
                    {viewMonth !== currentMonthKey() && (
                      <button className="ghost" onClick={() => setViewMonth(currentMonthKey())}>Today</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="bar-wrap">
                <div className="bar-label">
                  <span>Travel spend — {monthLabel(viewMonth)} (vs threshold)</span>
                  <span style={{ color: st.c, fontWeight: 700 }}>{pct}% used &middot; {st.label}</span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: st.c }} /></div>
                <div className="bar-note">${travelSpend.toLocaleString()} of ${(active.monthly_threshold || 0).toLocaleString()}</div>
              </div>

              <div className="section-label">OneStone account (what they owe us)</div>
              <div className="account-row">
                <div className="account-box">
                  <div className="l">Monthly retainer</div>
                  <button className={`paid-btn ${retainerRow?.paid ? "paid" : "unpaid"}`} onClick={toggleRetainer}>
                    {retainerRow?.paid ? "Paid this month" : "Unpaid — click to mark paid"}
                  </button>
                </div>
                <div className="account-box"><div className="l">Booking fees this month</div><div className="v">${feesCollected.toLocaleString()}</div></div>
                <div className="account-box"><div className="l">Year-to-date travel spend</div><div className="v">${ytdSpend.toLocaleString()}</div></div>
              </div>

              <div className="section-label">Cost breakdown (this month)</div>
              <table className="k">
                <tbody>
                  <tr><td className="cnum">Flights</td><td>${categoryTotal("Flight").toLocaleString()}</td></tr>
                  <tr><td className="cnum">Hotels</td><td>${categoryTotal("Hotel").toLocaleString()}</td></tr>
                  <tr><td className="cnum">Cars</td><td>${categoryTotal("Car").toLocaleString()}</td></tr>
                </tbody>
              </table>

              <div className="section-label">Monthly spend trend</div>
              <div dangerouslySetInnerHTML={{ __html: sparkline(trend) }} />

              <div className="section-label">Spend by traveler</div>
              <table className="k">
                <thead><tr><th>Traveler</th><th>Flight</th><th>Hotel</th><th>Car</th><th>Fees</th><th>Total</th></tr></thead>
                <tbody>
                  {travelerBreakdown.map((t) => (
                    <tr key={t.name}>
                      <td className="cnum">{t.name}</td><td>${t.flight}</td><td>${t.hotel}</td><td>${t.car}</td><td>${t.fees}</td>
                      <td style={{ fontWeight: 600 }}>${t.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="section-label">Log an entry</div>
              <form className="entry-form" onSubmit={logExpense}>
                <div>
                  <label>Traveler</label>
                  <select value={entryForm.traveler} onChange={(e) => setEntryForm({ ...entryForm, traveler: e.target.value })}>
                    <option value="">Select…</option>
                    {clientTravelers.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Category</label>
                  <select value={entryForm.category} onChange={(e) => setEntryForm({ ...entryForm, category: e.target.value })}>
                    <option>Flight</option><option>Hotel</option><option>Car</option><option>Booking Fee</option>
                  </select>
                </div>
                <div><label>Amount</label><input type="number" value={entryForm.amount} onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })} /></div>
                <div><label>Date</label><input type="date" value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} /></div>
                <div><label>Fee (suggested {suggestedFee(active.plan_tier, entryForm.category)})</label>
                  <input type="number" placeholder={String(suggestedFee(active.plan_tier, entryForm.category))} value={entryForm.fee} onChange={(e) => setEntryForm({ ...entryForm, fee: e.target.value })} />
                </div>
                <div><button type="submit">Add</button></div>
              </form>

              <div className="section-label">Entry log</div>
              {expenses.length === 0 ? <div className="empty">No entries yet this month.</div> : expenses.map((e) => (
                <div className="log-row" key={e.id}>
                  <span className="muted">{e.entry_date.slice(5)}</span>
                  <span>{e.traveler_name}</span>
                  <span className="muted">{e.category}</span>
                  <span>${e.amount}</span>
                  <span className="muted">fee ${e.fee}</span>
                  <span className="muted">{e.created_by?.split("@")[0]}</span>
                  <span className="log-actions">
                    <button className="icon-btn" onClick={() => openEditEntry(e)}>Edit</button>
                    <button className="icon-btn" onClick={() => deleteEntry(e)}>Remove</button>
                  </span>
                </div>
              ))}

              <button className="navy" style={{ marginTop: 16 }} onClick={generateReport}>Generate report preview</button>
              {reportHtml && <div className="report-preview" dangerouslySetInnerHTML={{ __html: reportHtml }} />}

              <div style={{ marginTop: 24, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                <ClientNotes clientId={activeId} session={session} />
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={showPlanModal} onClose={() => setShowPlanModal(false)}>
        {active && (() => {
          const p = planByKey(active.plan_tier);
          return (
            <>
              <h3>{p.label} plan</h3>
              <div className="modal-sub">{p.tagline}</div>
              <table className="k" style={{ marginTop: 10 }}>
                <tbody>
                  <tr><td className="cnum">Monthly retainer</td><td>${p.retainer.toLocaleString()}</td></tr>
                  <tr><td className="cnum">Traveler cap</td><td>{p.travelerCap === Infinity ? "No cap" : p.travelerCap}</td></tr>
                  <tr><td className="cnum">Flight booking fee</td><td>${p.flightRate}</td></tr>
                  <tr><td className="cnum">Hotel / car booking fee</td><td>${p.otherRate}</td></tr>
                </tbody>
              </table>
              <div className="modal-actions">
                <button className="ghost" onClick={() => setShowPlanModal(false)}>Close</button>
              </div>
            </>
          );
        })()}
      </Modal>

      <Modal open={!!editingEntry} onClose={() => setEditingEntry(null)}>
        {editingEntry && (
          <>
            <h3>Edit entry</h3>
            <div className="modal-sub">{editingEntry.traveler_name} &middot; {editingEntry.category}</div>
            <label>Amount ($)</label>
            <input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
            <label>Fee ($)</label>
            <input type="number" value={editForm.fee} onChange={(e) => setEditForm({ ...editForm, fee: e.target.value })} />
            <div className="modal-actions">
              <button className="ghost" onClick={() => setEditingEntry(null)}>Cancel</button>
              <button onClick={saveEditEntry}>Save</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
