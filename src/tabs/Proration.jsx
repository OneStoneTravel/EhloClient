import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { PLAN_TIERS, planByKey, localDateStr } from "../shared";

export default function Proration({ session }) {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [planKey, setPlanKey] = useState("Starter");
  const [startDate, setStartDate] = useState(localDateStr());
  const [customRetainer, setCustomRetainer] = useState("");

  useEffect(() => {
    supabase.from("clients").select("*").order("company_name").then(({ data }) => setClients(data || []));
  }, []);

  const selectedClient = clients.find((c) => c.id === clientId);
  const retainer = customRetainer !== "" ? parseFloat(customRetainer) || 0 : planByKey(planKey).retainer;

  const [y, m, d] = startDate.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dayOfMonth = d;
  const daysRemaining = daysInMonth - dayOfMonth + 1;
  const prorated = retainer * (daysRemaining / daysInMonth);

  return (
    <div className="panel">
      <h2>Proration calculator</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Figures out a client's first-month retainer charge when they join partway through a billing month.
      </p>

      <div className="form-grid">
        <div>
          <label>Existing client (optional)</label>
          <select value={clientId} onChange={(e) => { setClientId(e.target.value); const c = clients.find((x) => x.id === e.target.value); if (c) setPlanKey(c.plan_tier); }}>
            <option value="">— Manual entry instead —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        <div>
          <label>Plan tier</label>
          <select value={planKey} onChange={(e) => setPlanKey(e.target.value)} disabled={!!clientId}>
            {PLAN_TIERS.map((p) => <option key={p.key} value={p.key}>{p.label} — ${p.retainer.toLocaleString()}/mo</option>)}
          </select>
        </div>
        <div>
          <label>Override retainer amount ($, optional)</label>
          <input type="number" value={customRetainer} onChange={(e) => setCustomRetainer(e.target.value)} placeholder={String(planByKey(planKey).retainer)} />
        </div>
        <div>
          <label>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      <div className="rev-cards" style={{ marginTop: 20 }}>
        <div className="rev-card"><div className="l">Full monthly retainer</div><div className="v">${retainer.toLocaleString()}</div></div>
        <div className="rev-card"><div className="l">Days remaining in month</div><div className="v">{daysRemaining} of {daysInMonth}</div></div>
        <div className="rev-card accent"><div className="l">Prorated first charge</div><div className="v">${prorated.toFixed(2)}</div></div>
      </div>
    </div>
  );
}
