import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function ClientNotes({ clientId, session }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("client_notes")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setNotes(data || []);
    setLoading(false);
  }

  useEffect(() => { if (clientId) load(); }, [clientId]);

  async function addNote(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from("client_notes").insert({
      client_id: clientId,
      note: text.trim(),
      created_by: session.user.email,
    });
    setText("");
    load();
  }

  return (
    <div>
      <div className="section-label">Notes</div>
      {loading ? (
        <div className="empty">Loading…</div>
      ) : notes.length === 0 ? (
        <div className="empty">No notes yet on this client.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ borderLeft: "3px solid var(--wine-light)", paddingLeft: 10 }}>
              <div style={{ fontSize: 10.5, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 2 }}>
                {n.created_by} &middot;{" "}
                {new Date(n.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
              <div style={{ fontSize: 13 }}>{n.note}</div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={addNote} style={{ display: "flex", gap: 8 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note for the next person handling this account…"
          rows={2}
          style={{ flex: 1, padding: "8px 9px", border: "1px solid var(--line)", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 13, boxSizing: "border-box" }}
        />
        <button type="submit">Add note</button>
      </form>
    </div>
  );
}
