import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Factory, KeyRound, LayoutDashboard, LogOut, Tv } from "lucide-react";
import { api, getSettings, isAdmin, Me, RESEARCH_URL, signOut } from "../lib/api";
import { SignIn } from "../components/SignIn";
import { Overview } from "../components/Overview";
import { Channels } from "../components/Channels";
import { People } from "../components/People";

type View = "overview" | "channels" | "people";
const TABS: { id: View; label: string; Icon: typeof Tv }[] = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "channels", label: "Channels", Icon: Tv },
  { id: "people", label: "People and tokens", Icon: KeyRound },
];

function readView(): View {
  if (typeof window === "undefined") return "overview";
  const v = new URLSearchParams(window.location.search).get("view");
  return v === "channels" || v === "people" ? v : "overview";
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [boot, setBoot] = useState<"loading" | "signed-out" | "ready" | "error" | "forbidden">("loading");
  const [bootError, setBootError] = useState("");
  const [view, setView] = useState<View>("overview");

  const load = useCallback(async () => {
    if (!getSettings().token) { setBoot("signed-out"); return; }
    setBoot("loading");
    try {
      const m = await api.me();
      setMe(m);
      setBoot(isAdmin(m.role) ? "ready" : "forbidden");
    } catch (e: any) {
      if (e.status === 401) { signOut(); setBoot("signed-out"); }
      else { setBootError(e.message); setBoot("error"); }
    }
  }, []);

  useEffect(() => {
    setView(readView());
    load();
    const onPop = () => setView(readView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [load]);

  const go = (v: View) => {
    const url = new URL(window.location.href);
    url.search = "";
    if (v !== "overview") url.searchParams.set("view", v);
    window.history.pushState({}, "", url);
    setView(v);
    window.scrollTo({ top: 0 });
  };
  const leave = () => { signOut(); setMe(null); setBoot("signed-out"); };

  if (boot === "signed-out") return <SignIn onDone={load} />;

  return (
    <div className="app">
      <header className="bar">
        <div className="bar__in">
          <a className="wordmark" href="./" onClick={(e) => { e.preventDefault(); go("overview"); }}>
            <Factory className="wordmark__mark" size={22} strokeWidth={1.75} aria-hidden="true" />
            <span className="wordmark__text">
              <span className="wordmark__name">Factory dashboard</span>
              <span className="wordmark__sub">YT factory, all channels</span>
            </span>
          </a>
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" className="tab" aria-current={view === t.id ? "page" : undefined} onClick={() => go(t.id)}><t.Icon size={16} strokeWidth={1.75} aria-hidden="true" /><span>{t.label}</span></button>
            ))}
          </nav>
          <div className="who">
            <a className="who__link" href={RESEARCH_URL} target="_blank" rel="noopener noreferrer">Research desk<ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" /></a>
            {me ? <span className="who__name">{me.user.display_name}<span className="who__role">{me.role}</span></span> : <span className="skel skel--line" style={{ width: 96 }} />}
            <button type="button" className="icon-btn" onClick={leave} aria-label="Sign out" title="Sign out"><LogOut size={16} strokeWidth={1.75} aria-hidden="true" /></button>
          </div>
        </div>
      </header>

      <main className="main">
        {boot === "error" && (
          <div className="notice notice--error" role="alert"><p>{bootError}</p><button type="button" className="btn" onClick={load}>Try again</button></div>
        )}
        {boot === "forbidden" && me && (
          <div className="panels"><div className="panel empty">
            <p className="empty__title">This dashboard is for owners and admins.</p>
            <p>Your token has the {me.role} role. Use the <a href={RESEARCH_URL}>Research desk</a>, or ask the owner for an admin token.</p>
            <button type="button" className="btn" onClick={leave}>Use another token</button>
          </div></div>
        )}
        {boot === "loading" && <Overview.Skeleton />}
        {boot === "ready" && me && (
          <>
            {view === "overview" && <Overview onGo={go} />}
            {view === "channels" && <Channels />}
            {view === "people" && <People me={me} />}
          </>
        )}
      </main>
    </div>
  );
}
