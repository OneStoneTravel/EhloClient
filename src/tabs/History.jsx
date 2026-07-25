import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function History({ session }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setEntries(data || []));
  }, []);

  const groups = {};
  entries.forEach((e) => {
    const d = new Date(e.created_at);
    const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    groups[key] = groups[key] || [];
    groups[key].push(e);
  });

  return (
    <div className="panel">
      <h2>History</h2>
      {Object.keys(groups).length === 0 ? (
        <div className="empty">Nothing logged yet — actions across Ehlo will show up here as they happen.</div>
      ) : (
        Object.entries(groups).map(([month, rows]) => (
          <div key={month} style={{ marginBottom: 22 }}>
            <div className="section-label">{month}</div>
            {rows.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 12.5 }}>
                <span className="muted" style={{ whiteSpace: "nowrap" }}>
                  {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} &middot;{" "}
                  {new Date(e.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
                <span><b style={{ color: "var(--navy)" }}>{e.actor_email?.split("@")[0]}</b> {e.action}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
