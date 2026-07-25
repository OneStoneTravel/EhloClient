import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import NewClient from "./tabs/NewClient";
import Directory from "./tabs/Directory";
import Billing from "./tabs/Billing";
import Revenue from "./tabs/Revenue";
import Expense from "./tabs/Expense";
import Proration from "./tabs/Proration";
import Reports from "./tabs/Reports";
import Timesheets from "./tabs/Timesheets";
import Team from "./tabs/Team";
import History from "./tabs/History";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="knox-logo login-logo">Ehlo</div>
        <p className="sub">OneStone Client Accounts</p>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}

function AccessDenied({ email }) {
  return (
    <div className="denied-wrap">
      <div className="denied-box">
        <h2>Not authorized</h2>
        <p>
          {email} doesn't have owner access to Ehlo Client. This account can still use Knox
          Tracker as normal — just not this system.
        </p>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  );
}

const TABS = [
  { key: "newclient", label: "New Client +" },
  { key: "directory", label: "Directory" },
  { key: "billing", label: "Billing" },
  { key: "revenue", label: "Revenue" },
  { key: "expense", label: "Expense" },
  { key: "proration", label: "Proration" },
  { key: "reports", label: "Reports" },
  { key: "timesheets", label: "Time" },
  { key: "team", label: "Team / Users" },
  { key: "history", label: "History" },
];

function EhloShell({ session }) {
  const [tab, setTab] = useState("directory");

  return (
    <div>
      <div className="knoxbar">
        <div className="knoxbar-inner">
          <div>
            <div className="knox-logo">Ehlo</div>
            <div className="knox-sub">OneStone Client Accounts</div>
          </div>
          <div className="knox-user">
            <span>Signed in as <span className="who">{session.user.email}</span></span>
            <button onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="tab-bar">
          {TABS.map((t) => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "newclient" && <NewClient session={session} />}
        {tab === "directory" && <Directory session={session} />}
        {tab === "billing" && <Billing session={session} />}
        {tab === "revenue" && <Revenue session={session} />}
        {tab === "expense" && <Expense session={session} />}
        {tab === "proration" && <Proration session={session} />}
        {tab === "reports" && <Reports session={session} />}
        {tab === "timesheets" && <Timesheets session={session} />}
        {tab === "team" && <Team session={session} />}
        {tab === "history" && <History session={session} />}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);
  const [isOwner, setIsOwner] = useState(null); // null = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsOwner(null);
      return;
    }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        setIsOwner(!error && data?.role === "owner");
      });
  }, [session]);

  if (!checked) return null;
  if (!session) return <Login />;
  if (isOwner === null) return null; // checking role
  if (!isOwner) return <AccessDenied email={session.user.email} />;
  return <EhloShell session={session} />;
}
