import { useState } from "react";
import { supabase } from "../supabaseClient";
import { PLAN_TIERS, localDateStr, logActivity } from "../shared";

export default function NewClient({ session }) {
  const [form, setForm] = useState({
    company_name: "",
    client_number: "",
    plan_tier: "Starter",
    authorized_person: "",
    contact_phone: "",
    date_joined: localDateStr(),
    monthly_threshold: 5000,
  });
  const [travelerDraft, setTravelerDraft] = useState("");
  const [travelerList, setTravelerList] = useState([]);
  const [status, setStatus] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function addTraveler() {
    const name = travelerDraft.trim();
    if (!name || travelerList.includes(name)) return;
    setTravelerList([...travelerList, name]);
    setTravelerDraft("");
  }

  function removeTraveler(name) {
    setTravelerList(travelerList.filter((n) => n !== name));
  }

  async function submit(e) {
    e.preventDefault();
    setStatus(null);

    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        company_name: form.company_name,
        client_number: form.client_number || null,
        plan_tier: form.plan_tier,
        authorized_person: form.authorized_person || null,
        contact_phone: form.contact_phone || null,
        date_joined: form.date_joined,
        monthly_threshold: parseFloat(form.monthly_threshold) || 0,
      })
      .select()
      .single();

    if (error) {
      setStatus({ ok: false, msg: error.message });
      return;
    }

    if (travelerList.length > 0) {
      await supabase.from("travelers").insert(
        travelerList.map((name) => ({ client_id: client.id, name }))
      );
    }

    await logActivity(session, `added a new client: ${form.company_name}${form.client_number ? ` (${form.client_number})` : ""}, ${form.plan_tier} plan.`);

    setStatus({ ok: true, msg: `${form.company_name} was created.` });
    setForm({
      company_name: "", client_number: "", plan_tier: "Starter", authorized_person: "",
      contact_phone: "", date_joined: localDateStr(), monthly_threshold: 5000,
    });
    setTravelerList([]);
  }

  return (
    <div className="panel">
      <h2>Add a new client</h2>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div><label>Company name</label><input required value={form.company_name} onChange={set("company_name")} placeholder="Valley Health Staffing" /></div>
          <div><label>Client number</label><input value={form.client_number} onChange={set("client_number")} placeholder="OS-1005-C" /></div>
          <div><label>Authorized contact</label><input value={form.authorized_person} onChange={set("authorized_person")} placeholder="Priya Nair" /></div>
          <div><label>Contact phone</label><input value={form.contact_phone} onChange={set("contact_phone")} placeholder="(602) 555-0142" /></div>
          <div><label>Client since</label><input type="date" value={form.date_joined} onChange={set("date_joined")} /></div>
          <div><label>Monthly threshold ($)</label><input type="number" step="1" value={form.monthly_threshold} onChange={set("monthly_threshold")} /></div>

          <div className="form-full">
            <label>Plan tier</label>
            <div className="tier-pick-row">
              {PLAN_TIERS.map((p) => (
                <div
                  key={p.key}
                  className={`tier-option ${form.plan_tier === p.key ? "selected" : ""}`}
                  onClick={() => setForm({ ...form, plan_tier: p.key })}
                >
                  <div className="tier-name">{p.label}</div>
                  <div className="tier-desc">${p.retainer.toLocaleString()}/mo &middot; {p.tagline}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-full">
            <label>Travelers</label>
            <div className="add-inline">
              <input
                value={travelerDraft}
                onChange={(e) => setTravelerDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTraveler(); } }}
                placeholder="Traveler name, press Enter to add"
              />
              <button type="button" onClick={addTraveler}>Add</button>
            </div>
            <div className="chip-row">
              {travelerList.map((name) => (
                <span className="chip" key={name}>{name}<button type="button" onClick={() => removeTraveler(name)}>×</button></span>
              ))}
            </div>
          </div>
        </div>

        <button type="submit" style={{ marginTop: 20 }}>Create client</button>
        {status && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: status.ok ? "var(--green)" : "var(--red)" }}>
            {status.msg}
          </div>
        )}
      </form>
    </div>
  );
}
