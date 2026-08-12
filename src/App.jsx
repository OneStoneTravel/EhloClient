import { useEffect, useState, Component } from "react";
import { supabase } from "./supabaseClient";
import Home from "./tabs/Home";
import NewClient from "./tabs/NewClient";
import Directory from "./tabs/Directory";
import Inquiries from "./tabs/Inquiries";
import Requests from "./tabs/Requests";
import Billing from "./tabs/Billing";
import Revenue from "./tabs/Revenue";
import Expense from "./tabs/Expense";
import Reports from "./tabs/Reports";
import Timesheets from "./tabs/Timesheets";
import Team from "./tabs/Team";
import History from "./tabs/History";
import Plans from "./tabs/Plans";

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
        <div className="knox-logo login-logo">Ehl<span>o</span></div>
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

const NAV = [
  { type: "single", key: "home", label: "🏠" },
  {
    type: "group", key: "clientsGroup", label: "Clients",
    items: [
      { key: "newclient", label: "New Client +" },
      { key: "directory", label: "Directory" },
      { key: "inquiries", label: "Business Inquiries" },
      { key: "requests", label: "Travel Requests" },
    ],
  },
  {
    type: "group", key: "financeGroup", label: "Finance",
    items: [
      { key: "billing", label: "Billing" },
      { key: "revenue", label: "Revenue" },
      { key: "expense", label: "Expense" },
      { key: "reports", label: "Reports" },
    ],
  },
  {
    type: "group", key: "teamGroup", label: "Team",
    items: [
      { key: "timesheets", label: "Time" },
      { key: "team", label: "Staff" },
      { key: "history", label: "History" },
    ],
  },
  { type: "single", key: "plans", label: "Plans" },
];

class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Tab crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="panel">
          <div style={{ color: "var(--red)", fontWeight: 600, marginBottom: 6 }}>This tab hit an error and couldn't load.</div>
          <div className="muted">{this.state.error.message || String(this.state.error)}</div>
          <button className="ghost" style={{ marginTop: 10 }} onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function TabGroup({ group, tab, setTab, badges, openGroup, setOpenGroup }) {
  const isOpen = openGroup === group.key;
  const activeItem = group.items.find((i) => i.key === tab);
  const badgeSum = group.items.reduce((s, i) => s + (badges[i.key] || 0), 0);

  return (
    <div className="tab-group">
      <button
        className={`tab-btn ${activeItem ? "active" : ""}`}
        onClick={() => setOpenGroup(isOpen ? null : group.key)}
      >
        {activeItem ? activeItem.label : group.label}
        {badgeSum > 0 && <span className="tab-badge">{badgeSum}</span>}
        <span className="tab-caret">▾</span>
      </button>
      {isOpen && (
        <div className="tab-dropdown">
          {group.items.map((it) => (
            <button
              key={it.key}
              className={`tab-dropdown-item ${tab === it.key ? "active" : ""}`}
              onClick={() => { setTab(it.key); setOpenGroup(null); }}
            >
              {it.label}
              {badges[it.key] > 0 && <span className="tab-badge">{badges[it.key]}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EhloShell({ session }) {
  const [tab, setTab] = useState("home");
  const [openGroup, setOpenGroup] = useState(null);
  const [badges, setBadges] = useState({ inquiries: 0, requests: 0 });

  async function loadBadges() {
    const { count: leadCount } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("reviewed", false);
    const { count: reqCount } = await supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "New");
    setBadges({ inquiries: leadCount || 0, requests: reqCount || 0 });
  }

  useEffect(() => { loadBadges(); }, [tab]);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (!e.target.closest(".tab-group")) setOpenGroup(null);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div>
      <div className="knoxbar">
        <div className="knoxbar-inner">
          <div>
            <div className="knox-logo">Ehl<span>o</span> <span className="version-tag">v1.8</span></div>
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
          {NAV.map((n) =>
            n.type === "single" ? (
              <button
                key={n.key}
                className={`tab-btn ${tab === n.key ? "active" : ""}`}
                style={n.key === "home" ? { fontSize: 17 } : undefined}
                onClick={() => { setTab(n.key); setOpenGroup(null); }}
              >
                {n.label}
                {badges[n.key] > 0 && <span className="tab-badge">{badges[n.key]}</span>}
              </button>
            ) : (
              <TabGroup
                key={n.key}
                group={n}
                tab={tab}
                setTab={setTab}
                badges={badges}
                openGroup={openGroup}
                setOpenGroup={setOpenGroup}
              />
            )
          )}
        </div>

        <TabErrorBoundary key={tab}>
          {tab === "home" && <Home session={session} onNavigate={setTab} />}
          {tab === "newclient" && <NewClient session={session} />}
          {tab === "directory" && <Directory session={session} />}
          {tab === "inquiries" && <Inquiries session={session} />}
          {tab === "requests" && <Requests session={session} />}
          {tab === "billing" && <Billing session={session} />}
          {tab === "revenue" && <Revenue session={session} />}
          {tab === "expense" && <Expense session={session} />}
          {tab === "reports" && <Reports session={session} />}
          {tab === "timesheets" && <Timesheets session={session} onNavigate={setTab} />}
          {tab === "team" && <Team session={session} />}
          {tab === "history" && <History session={session} />}
          {tab === "plans" && <Plans session={session} />}
        </TabErrorBoundary>
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
