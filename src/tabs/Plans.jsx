import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { PLAN_TIERS, barChart, logActivity } from "../shared";

// Rough bands for scoping an Anchor-tier deal live, on a call.
// These are starting points, not locked pricing — always editable below.
function estimateAnchorDeal(travelers, dedicatedManager) {
  let retainer, fee, note = null;

  function interpolate(t, tLow, tHigh, rLow, rHigh) {
    const pct = Math.max(0, Math.min(1, (t - tLow) / (tHigh - tLow)));
    return rLow + (rHigh - rLow) * pct;
  }

  if (!travelers || travelers < 40) {
    note = "Under 40 travelers usually fits Starter, Growth, or Premier instead — see the tiers above.";
    retainer = 2500;
    fee = 32;
  } else if (travelers < 75) {
    retainer = interpolate(travelers, 40, 75, 2500, 4000);
    fee = 30;
  } else if (travelers < 150) {
    retainer = interpolate(travelers, 75, 150, 4000, 7500);
    fee = 27;
  } else if (travelers < 300) {
    retainer = interpolate(travelers, 150, 300, 7500, 15000);
    fee = 24;
  } else {
    retainer = 15000 + (travelers - 300) * 40;
    fee = 20;
    note = "Enterprise scale — treat these as a rough starting point, not a quote. Scope an SLA (response times, coverage hours, dedicated staffing) before proposing a real number.";
  }

  if (dedicatedManager) retainer += 1500;

  return {
    retainer: Math.round(retainer / 50) * 50,
    fee: Math.round(fee * 2) / 2,
    note,
  };
}

function money(n) {
  return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function Plans({ session }) {
  const [estimates, setEstimates] = useState([]);
  const [loadingEstimates, setLoadingEstimates] = useState(true);

  const [prospect, setProspect] = useState("");
  const [travelers, setTravelers] = useState(60);
  const [bookingsPerTraveler, setBookingsPerTraveler] = useState(1.5);
  const [dedicated, setDedicated] = useState(false);

  const [goal, setGoal] = useState(2000000);
  const [mix, setMix] = useState({ Starter: 0, Growth: 0, Premier: 0, Anchor: 0 });
  const [anchorAvg, setAnchorAvg] = useState(4000);

  function rateFor(key) {
    return PLAN_TIERS.find((p) => p.key === key)?.retainer || 0;
  }

  function setMixCount(key, val) {
    setMix((m) => ({ ...m, [key]: Number(val) || 0 }));
  }

  const monthlyRetainer =
    (Number(mix.Starter) || 0) * rateFor("Starter") +
    (Number(mix.Growth) || 0) * rateFor("Growth") +
    (Number(mix.Premier) || 0) * rateFor("Premier") +
    (Number(mix.Anchor) || 0) * (Number(anchorAvg) || 0);
  const sixMonthRetainer = monthlyRetainer * 6;
  const annualRetainer = monthlyRetainer * 12;
  const pctOfGoal = Number(goal) > 0 ? (annualRetainer / Number(goal)) * 100 : 0;
  const gap = (Number(goal) || 0) - annualRetainer;

  const tierRows = [
    { key: "Starter", rate: rateFor("Starter") },
    { key: "Growth", rate: rateFor("Growth") },
    { key: "Premier", rate: rateFor("Premier") },
    { key: "Anchor", rate: Number(anchorAvg) || 0 },
  ].map((t) => ({
    ...t,
    clientsNeeded: t.rate > 0 ? Math.ceil((Number(goal) || 0) / (t.rate * 12)) : 0,
  }));

  const [retainer, setRetainer] = useState(0);
  const [fee, setFee] = useState(0);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const suggested = useMemo(
    () => estimateAnchorDeal(Number(travelers) || 0, dedicated),
    [travelers, dedicated]
  );

  useEffect(() => {
    if (!touched) {
      setRetainer(suggested.retainer);
      setFee(suggested.fee);
    }
  }, [suggested.retainer, suggested.fee, touched]);

  useEffect(() => {
    loadEstimates();
  }, []);

  async function loadEstimates() {
    setLoadingEstimates(true);
    const { data } = await supabase
      .from("plan_estimates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    setEstimates(data || []);
    setLoadingEstimates(false);
  }

  const monthlyBookings = (Number(travelers) || 0) * (Number(bookingsPerTraveler) || 0);
  const bookingRevenue = monthlyBookings * (Number(fee) || 0);
  const totalMonthly = (Number(retainer) || 0) + bookingRevenue;
  const proj1 = totalMonthly;
  const proj3 = totalMonthly * 3;
  const proj6 = totalMonthly * 6;
  const proj12 = totalMonthly * 12;

  function resetToSuggested() {
    setTouched(false);
    setRetainer(suggested.retainer);
    setFee(suggested.fee);
  }

  async function saveEstimate() {
    setSaving(true);
    setSaveMsg("");
    const { error } = await supabase.from("plan_estimates").insert({
      prospect_name: prospect.trim() || "Unnamed prospect",
      travelers: Number(travelers) || 0,
      bookings_per_traveler: Number(bookingsPerTraveler) || 0,
      dedicated_manager: dedicated,
      monthly_retainer: Number(retainer) || 0,
      per_booking_fee: Number(fee) || 0,
    });
    setSaving(false);
    if (error) {
      setSaveMsg("Couldn't save — try again.");
      return;
    }
    setSaveMsg("Saved.");
    await logActivity(session, `saved a plan estimate for ${prospect.trim() || "an unnamed prospect"}.`);
    await loadEstimates();
    setTimeout(() => setSaveMsg(""), 2500);
  }

  async function deleteEstimate(id) {
    await supabase.from("plan_estimates").delete().eq("id", id);
    await loadEstimates();
  }

  return (
    <div>
      <div className="panel">
        <h2>Plan Tiers</h2>
        <div className="plan-card-grid">
          {PLAN_TIERS.map((p) => (
            <div className="plan-card" key={p.key}>
              <div className="plan-card-name">{p.label}</div>
              <div className="plan-card-price">
                {money(p.retainer)}
                <small>/ mo{p.key === "Anchor" ? "+" : ""}</small>
              </div>
              <div className="plan-card-cap">{p.travelerCap === Infinity ? "40+ travelers" : `Up to ${p.travelerCap} travelers`}</div>
              <ul>
                {p.key === "Anchor" ? (
                  <>
                    <li>Blended rate, ~${p.flightRate}/booking</li>
                    <li>Scoped to your volume</li>
                    <li>Per-trip or per-event pricing</li>
                  </>
                ) : (
                  <>
                    <li>${p.flightRate} per flight</li>
                    <li>${p.otherRate} per hotel, car, or other</li>
                  </>
                )}
              </ul>
              <div className="plan-card-tagline">{p.tagline}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Growth &amp; Goal Planner</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 16 }}>
          Set a revenue goal, then build a client mix to see how close it gets you. This is retainer revenue only — booking fees would add more on top.
        </p>

        <div className="form-grid">
          <div>
            <label>Annual revenue goal</label>
            <input type="number" min="0" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
        </div>

        <h3 style={{ marginTop: 18 }}>If you filled your whole roster with just one tier</h3>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Tier</th><th>Monthly retainer</th><th>Clients needed to hit the goal</th></tr>
            </thead>
            <tbody>
              {tierRows.map((t) => (
                <tr key={t.key}>
                  <td>
                    {t.key}
                    {t.key === "Anchor" && <span className="muted"> (at {money(anchorAvg)}/mo avg)</span>}
                  </td>
                  <td>{money(t.rate)}</td>
                  <td style={{ fontWeight: 600, color: "var(--wine)" }}>
                    {t.rate > 0 ? t.clientsNeeded.toLocaleString("en-US") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginTop: 22 }}>Or build your own mix</h3>
        <div className="form-grid">
          <div>
            <label>Starter — {money(rateFor("Starter"))}/mo each</label>
            <input type="number" min="0" value={mix.Starter} onChange={(e) => setMixCount("Starter", e.target.value)} />
          </div>
          <div>
            <label>Growth — {money(rateFor("Growth"))}/mo each</label>
            <input type="number" min="0" value={mix.Growth} onChange={(e) => setMixCount("Growth", e.target.value)} />
          </div>
          <div>
            <label>Premier — {money(rateFor("Premier"))}/mo each</label>
            <input type="number" min="0" value={mix.Premier} onChange={(e) => setMixCount("Premier", e.target.value)} />
          </div>
          <div>
            <label>Anchor clients</label>
            <input type="number" min="0" value={mix.Anchor} onChange={(e) => setMixCount("Anchor", e.target.value)} />
          </div>
          <div>
            <label>Avg Anchor retainer</label>
            <input type="number" min="0" value={anchorAvg} onChange={(e) => setAnchorAvg(e.target.value)} />
          </div>
        </div>

        <div className="stat-row">
          <div className="stat">
            <div className="stat-label">Monthly (retainer only)</div>
            <div className="stat-value">{money(monthlyRetainer)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">6 months</div>
            <div className="stat-value">{money(sixMonthRetainer)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">12 months</div>
            <div className="stat-value accent">{money(annualRetainer)}</div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="muted" style={{ marginBottom: 4 }}>
            {pctOfGoal.toFixed(0)}% of your {money(goal)} goal, retainer only
          </div>
          <div style={{ background: "var(--line)", borderRadius: 999, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, Math.max(0, pctOfGoal))}%`, height: "100%", background: pctOfGoal >= 100 ? "var(--wine)" : "var(--navy)" }} />
          </div>
        </div>

        {gap > 0 ? (
          <div style={{ background: "var(--wine-pale)", border: "1px solid #E3C2C8", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "var(--wine)", marginTop: 14 }}>
            You're {money(gap)} short of the goal at this mix. Close it with roughly{" "}
            {rateFor("Starter") > 0 && <>{Math.ceil(gap / (12 * rateFor("Starter")))} more Starter, </>}
            {rateFor("Growth") > 0 && <>{Math.ceil(gap / (12 * rateFor("Growth")))} more Growth, </>}
            {rateFor("Premier") > 0 && <>{Math.ceil(gap / (12 * rateFor("Premier")))} more Premier, </>}
            or {Number(anchorAvg) > 0 ? Math.ceil(gap / (12 * Number(anchorAvg))) : "—"} more Anchor clients — each option shown on its own, not combined.
          </div>
        ) : (
          <div style={{ background: "var(--green-bg)", border: "1px solid #cfe6d7", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "var(--green)", marginTop: 14 }}>
            This mix clears your goal by {money(-gap)} on retainer revenue alone — booking fees would add even more.
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Anchor Deal Calculator</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 16 }}>
          Plug in what a prospect tells you on a call. Suggested numbers fill in automatically — adjust them freely, the projections update live.
        </p>

        <div className="form-grid">
          <div>
            <label>Prospect / company name</label>
            <input value={prospect} onChange={(e) => setProspect(e.target.value)} placeholder="e.g. Dignity Health — AZ region" />
          </div>
          <div>
            <label>Number of travelers</label>
            <input
              type="number"
              min="1"
              value={travelers}
              onChange={(e) => setTravelers(e.target.value)}
            />
          </div>
          <div>
            <label>Bookings per traveler / mo</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={bookingsPerTraveler}
              onChange={(e) => setBookingsPerTraveler(e.target.value)}
            />
          </div>
          <div>
            <label>Dedicated account contact?</label>
            <select value={dedicated ? "yes" : "no"} onChange={(e) => setDedicated(e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes (+$1,500/mo)</option>
            </select>
          </div>
        </div>

        {suggested.note && (
          <div style={{ background: "var(--wine-pale)", border: "1px solid #E3C2C8", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "var(--wine)", marginTop: 14 }}>
            {suggested.note}
          </div>
        )}

        <div className="form-grid" style={{ marginTop: 18 }}>
          <div>
            <label>Monthly retainer {!touched && <span className="muted">(suggested)</span>}</label>
            <input
              type="number"
              value={retainer}
              onChange={(e) => { setTouched(true); setRetainer(e.target.value); }}
            />
          </div>
          <div>
            <label>Per-booking fee {!touched && <span className="muted">(suggested)</span>}</label>
            <input
              type="number"
              step="0.5"
              value={fee}
              onChange={(e) => { setTouched(true); setFee(e.target.value); }}
            />
          </div>
        </div>
        {touched && (
          <button className="add-inline" style={{ padding: "6px 12px", background: "#fff", border: "1px solid var(--wine)", color: "var(--wine)", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 4 }} onClick={resetToSuggested}>
            Reset to suggested numbers
          </button>
        )}

        <div className="stat-row">
          <div className="stat">
            <div className="stat-label">Monthly bookings</div>
            <div className="stat-value">{monthlyBookings.toFixed(1)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Booking fee revenue / mo</div>
            <div className="stat-value">{money(bookingRevenue)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Total revenue / mo</div>
            <div className="stat-value accent">{money(totalMonthly)}</div>
          </div>
        </div>

        <h3 style={{ marginTop: 22 }}>Revenue if this deal closes</h3>
        <div className="stat-row" style={{ marginTop: 6, paddingTop: 0, borderTop: "none" }}>
          <div className="stat">
            <div className="stat-label">1 month</div>
            <div className="stat-value">{money(proj1)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">3 months</div>
            <div className="stat-value">{money(proj3)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">6 months</div>
            <div className="stat-value">{money(proj6)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">12 months</div>
            <div className="stat-value accent">{money(proj12)}</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }} dangerouslySetInnerHTML={{ __html: barChart([proj1, proj3, proj6, proj12], ["1 mo", "3 mo", "6 mo", "12 mo"], true) }} />
        <p className="muted" style={{ marginTop: 6 }}>Assumes steady monthly volume at these terms — no churn, no ramp-up.</p>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
          <button
            onClick={saveEstimate}
            disabled={saving}
            style={{ padding: "9px 16px", background: "var(--wine)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {saving ? "Saving…" : "Save this estimate"}
          </button>
          {saveMsg && <span className="muted">{saveMsg}</span>}
        </div>
      </div>

      <div className="panel">
        <h2>Saved Estimates</h2>
        {loadingEstimates ? (
          <p className="muted">Loading…</p>
        ) : estimates.length === 0 ? (
          <p className="empty">No saved estimates yet.</p>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prospect</th><th>Travelers</th><th>Bookings/mo</th><th>Retainer</th><th>Per-booking</th><th>Total / mo</th><th>Saved</th><th></th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((e) => {
                  const monthly = Number(e.monthly_retainer) + Number(e.travelers) * Number(e.bookings_per_traveler) * Number(e.per_booking_fee);
                  return (
                    <tr key={e.id}>
                      <td>{e.prospect_name}</td>
                      <td>{e.travelers}</td>
                      <td>{(Number(e.travelers) * Number(e.bookings_per_traveler)).toFixed(1)}</td>
                      <td>{money(e.monthly_retainer)}</td>
                      <td>${Number(e.per_booking_fee).toFixed(2)}</td>
                      <td style={{ fontWeight: 600, color: "var(--wine)" }}>{money(monthly)}</td>
                      <td className="muted">{new Date(e.created_at).toLocaleDateString()}</td>
                      <td><button onClick={() => deleteEstimate(e.id)} style={{ background: "none", border: "none", color: "var(--ink-soft)", cursor: "pointer", fontSize: 12 }}>Delete</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
