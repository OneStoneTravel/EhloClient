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

export function barChart(values, labels) {
  const w = 560, h = 110, gap = 10;
  const max = Math.max(...values, 1);
  const bw = (w - gap * (values.length - 1)) / Math.max(values.length, 1);
  const bars = values.map((v, i) => {
    const bh = Math.max((v / max) * (h - 20), 2);
    const x = i * (bw + gap);
    const y = h - bh;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="#16233F"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${h + 14}" font-size="10" fill="#5B6270" text-anchor="middle">${labels[i]}</text>`;
  }).join("");
  return `<svg width="${w}" height="${h + 18}" viewBox="0 0 ${w} ${h + 18}" style="overflow:visible;">${bars}</svg>`;
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

export async function logActivity(session, action) {
  await supabase.from("activity_log").insert({
    actor_email: session?.user?.email || "unknown",
    action,
  });
}
