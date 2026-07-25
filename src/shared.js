import { supabase } from "./supabaseClient";

export const PLAN_TIERS = [
  { key: "Starter", label: "Starter", retainer: 399.99, travelerCap: 8, flightRate: 40, otherRate: 25,
    tagline: "Best for small teams with occasional travel." },
  { key: "Growth", label: "Growth", retainer: 899.99, travelerCap: 20, flightRate: 35, otherRate: 20,
    tagline: "Best for growing teams traveling regularly." },
  { key: "Premier", label: "Premier", retainer: 1899.99, travelerCap: 40, flightRate: 30, otherRate: 15,
    tagline: "Best for frequent travel that needs a dedicated hand." },
  { key: "Anchor", label: "Anchor / Custom", retainer: 2500, travelerCap: Infinity, flightRate: 32, otherRate: 32,
    tagline: "Best for high-volume travel, larger teams, sports teams, and events." },
];

export function planByKey(key) {
  return PLAN_TIERS.find((p) => p.key === key) || PLAN_TIERS[0];
}

export function suggestedFee(planKey, category) {
  const plan = planByKey(planKey);
  return category === "Flight" ? plan.flightRate : plan.otherRate;
}

// Local-date helpers — never use toISOString() for "today", it returns UTC
// and can silently roll to the wrong day depending on time of day.
export function localDateStr(d) {
  d = d || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthKeyOf(dateStr) {
  return dateStr.slice(0, 7) + "-01";
}

export function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function tenureLabel(dateJoined) {
  if (!dateJoined) return "—";
  const start = new Date(dateJoined + "T00:00:00");
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 1) return "Joined this month";
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years}yr`);
  if (remMonths > 0 || years === 0) parts.push(`${remMonths}mo`);
  return parts.join(" ");
}

export function statusColor(pct) {
  if (pct >= 90) return { c: "var(--red)", bg: "var(--red-bg)", label: "Critical" };
  if (pct >= 75) return { c: "var(--orange)", bg: "var(--orange-bg)", label: "High" };
  if (pct >= 50) return { c: "var(--amber)", bg: "var(--amber-bg)", label: "Watch" };
  return { c: "var(--green)", bg: "var(--green-bg)", label: "On track" };
}

export function sparkline(values) {
  if (!values.length) return "";
  const w = 280, h = 64;
  const max = Math.max(...values, 1);
  const min = Math.min(...values) * 0.85;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const dots = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#7A2E3A"/>`;
  }).join("");
  return `<svg width="${w}" height="${h}" style="overflow:visible;"><polyline points="${pts}" fill="none" stroke="#7A2E3A" stroke-width="2"/>${dots}</svg>`;
}

export function barChart(values, labels, highlightLast) {
  const w = 620, h = 130, gap = 12;
  const max = Math.max(...values, 1);
  const bw = (w - gap * (values.length - 1)) / Math.max(values.length, 1);
  const bars = values.map((v, i) => {
    const bh = Math.max((v / max) * (h - 40), 2);
    const x = i * (bw + gap);
    const y = h - bh - 20;
    const isLast = highlightLast && i === values.length - 1;
    const fill = isLast ? "#7A2E3A" : "#16233F";
    const valLabel = v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${fill}"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" font-size="10.5" fill="#23262B" text-anchor="middle" font-weight="600">${valLabel}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${h + 14}" font-size="10" fill="#5B6270" text-anchor="middle">${labels[i]}</text>`;
  }).join("");
  return `<svg width="${w}" height="${h + 18}" viewBox="0 0 ${w} ${h + 18}" style="overflow:visible;">${bars}</svg>`;
}

export function prevMonthKey(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function nextMonthKey(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function daysUntilDue(dueDay) {
  const now = new Date();
  const day = dueDay || 1;
  const due = new Date(now.getFullYear(), now.getMonth(), day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86400000);
}

export function dueStatus(days) {
  if (days < 0) return { label: `Overdue by ${Math.abs(days)}d`, color: "var(--red)", urgent: true };
  if (days === 0) return { label: "Due today", color: "var(--red)", urgent: true };
  if (days <= 5) return { label: `Due in ${days}d`, color: "var(--amber)", urgent: true };
  return { label: `Due in ${days}d`, color: "var(--ink-soft)", urgent: false };
}

export function startOfWeekStr(d) {
  d = d || new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return localDateStr(monday);
}

export function addDaysStr(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return localDateStr(dt);
}

export function weekLabel(weekStartStr) {
  const end = addDaysStr(weekStartStr, 6);
  const [y1, m1, d1] = weekStartStr.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  const s = new Date(y1, m1 - 1, d1).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = new Date(y2, m2 - 1, d2).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}

function punchToDecimal(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

export function hoursWorked(entry) {
  if (!entry) return 0;
  const ci = punchToDecimal(entry.clock_in);
  const lo = punchToDecimal(entry.lunch_out);
  const li = punchToDecimal(entry.lunch_in);
  const co = punchToDecimal(entry.clock_out);
  if (ci == null || co == null) return 0;
  if (lo != null && li != null) return Math.max((lo - ci) + (co - li), 0);
  return Math.max(co - ci, 0);
}

export async function fetchExpenseTotals(monthKeys) {
  if (!monthKeys.length) return { manual: 0, payroll: 0, total: 0 };
  const start = monthKeys[0];
  const end = nextMonthKey(monthKeys[monthKeys.length - 1]);

  const { data: manualRows } = await supabase
    .from("business_expenses")
    .select("amount")
    .gte("expense_date", start)
    .lt("expense_date", end);
  const manual = (manualRows || []).reduce((s, e) => s + Number(e.amount), 0);

  const { data: sheets } = await supabase
    .from("timesheets")
    .select("clock_in, lunch_out, lunch_in, clock_out, hourly_rate")
    .gte("work_date", start)
    .lt("work_date", end);
  const payroll = (sheets || []).reduce((s, t) => s + hoursWorked(t) * (Number(t.hourly_rate) || 0), 0);

  return { manual, payroll, total: manual + payroll };
}

export async function logActivity(session, action) {
  await supabase.from("activity_log").insert({
    actor_email: session?.user?.email || "unknown",
    action,
  });
}
