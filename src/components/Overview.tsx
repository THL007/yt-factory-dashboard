import { useCallback, useEffect, useState } from "react";
import { ago, api, Stats, STAGES, usd } from "../lib/api";

const ACTION_LABEL: Record<string, string> = {
  "research.create": "started research", "research.handoff": "handed a video to Script", "research.agent": "gave research to the agent",
  "research.claim": "claimed research", "research.cancel": "cancelled research", "token.create": "minted a token", "token.revoke": "revoked a token",
  "user.create": "added a person", "user.update": "renamed a person", "user.deactivate": "deactivated a person", "user.delete": "deleted a person",
  "channel.create": "added a channel", "channel.update": "edited a channel", "channel.delete": "deleted a channel", "channel.members": "changed channel members",
  "webhook.secret.set": "set the agent wake-up secret", "auth.login": "signed in to the CM app", "credential.issue": "issued a CM login",
};
const JOB_LABEL: Record<string, string> = { queued: "Queued", running: "Researching", review: "Needs review", handed_off: "In Script", failed: "Failed", cancelled: "Cancelled" };

export function Overview({ onGo }: { onGo: (v: "channels" | "people") => void }) {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { setS(await api.stats()); setError(""); } catch (e: any) { setError(e.message); } }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <section className="page"><div className="notice notice--error" role="alert"><p>Couldn’t load the numbers: {error}</p><button type="button" className="btn" onClick={load}>Try again</button></div></section>;
  if (!s) return <Overview.Skeleton />;

  const byStage = Object.fromEntries(s.stages.map((x) => [x.stage, x.n]));
  const total = s.stages.reduce((a, x) => a + x.n, 0);
  const channels = Object.values(s.per_channel.reduce<Record<string, { id: string; name: string; status: string; stages: Record<string, number> }>>((acc, r) => {
    acc[r.id] ||= { id: r.id, name: r.name, status: r.status, stages: {} };
    if (r.stage) acc[r.id].stages[r.stage] = r.n;
    return acc;
  }, {}));
  const a = s.agent;
  const verifiedPct = s.briefs.facts ? Math.round((s.briefs.verified / s.briefs.facts) * 100) : null;
  const tokenTotal = s.tokens.reduce((x, t) => x + t.n, 0);

  return (
    <section className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Overview</h1>
          <p className="page__lede">Every video in the factory, by stage. Numbers come from the factory database, updated {ago(s.generated_at)}.</p>
        </div>
        <button type="button" className="btn" onClick={load}>Refresh</button>
      </div>

      <div className="pipeline" role="list" aria-label="Videos per stage">
        {STAGES.map((st) => (
          <div key={st.id} role="listitem" className={`stage-card${byStage[st.id] ? "" : " stage-card--empty"}`}>
            <span className="stage-card__label">{st.label}</span>
            <span className="stage-card__n num">{byStage[st.id] || 0}</span>
          </div>
        ))}
      </div>
      <p className="fine">{total} video{total === 1 ? "" : "s"} across {channels.length} channel{channels.length === 1 ? "" : "s"}.</p>

      <section className="card">
        <div className="card__headrow"><h2 className="card__head">By channel</h2><button type="button" className="link-btn" onClick={() => onGo("channels")}>Manage channels</button></div>
        {channels.length === 0 ? (
          <div className="empty"><p className="empty__title">No channels yet.</p><p>Add the first channel to start the pipeline.</p><button type="button" className="btn btn--primary" onClick={() => onGo("channels")}>Add a channel</button></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Channel</th>{STAGES.map((st) => <th key={st.id} scope="col" className="num">{st.label}</th>)}</tr></thead>
              <tbody>{channels.map((c) => (
                <tr key={c.id}><td>{c.name}<span className="row-sub">{c.status}</span></td>
                  {STAGES.map((st) => <td key={st.id} className={`num${c.stages[st.id] ? "" : " num--zero"}`}>{c.stages[st.id] || 0}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <div className="split">
        <section className="card">
          <h2 className="card__head">Research agent</h2>
          {a.runs === 0 ? <p className="muted">No agent runs yet.</p> : (
            <dl className="figures">
              <div><dt>Briefs written</dt><dd className="num">{a.succeeded}</dd></div>
              <div><dt>Failed runs</dt><dd className="num">{a.failed}</dd></div>
              <div><dt>Average cost per brief</dt><dd className="num">{usd(a.cost_avg, 3)}</dd></div>
              <div><dt>Spent, last 7 days</dt><dd className="num">{usd(a.cost_7d)}</dd></div>
              <div><dt>Average time per brief</dt><dd className="num">{Math.round(a.secs_avg)} s</dd></div>
              <div><dt>Average tool calls</dt><dd className="num">{a.tools_avg.toFixed(1)}</dd></div>
            </dl>
          )}
          {a.model && <p className="fine">Model {a.model.replace(/^openrouter\//, "")} through OpenRouter. Total spent {usd(a.cost_total)}.</p>}
        </section>
        <section className="card">
          <h2 className="card__head">Research jobs</h2>
          <table className="table table--tight">
            <tbody>
              {s.jobs.length === 0 && <tr><td className="muted">No research jobs yet.</td></tr>}
              {s.jobs.map((j) => <tr key={j.status}><td>{JOB_LABEL[j.status] || j.status}</td><td className="num">{j.n}</td></tr>)}
            </tbody>
          </table>
          {verifiedPct !== null && <p className="fine">Facts in the latest briefs: {s.briefs.facts}, of which {s.briefs.verified} ({verifiedPct}%) were read at the source.</p>}
        </section>
      </div>

      <div className="split">
        <section className="card">
          <div className="card__headrow"><h2 className="card__head">People and access</h2><button type="button" className="link-btn" onClick={() => onGo("people")}>Manage</button></div>
          <dl className="figures figures--two">
            <div><dt>People</dt><dd className="num">{s.people.humans}</dd></div>
            <div><dt>Agents</dt><dd className="num">{s.people.agents}</dd></div>
          </dl>
          <table className="table table--tight">
            <thead><tr><th scope="col">Role</th><th scope="col" className="num">Active tokens</th></tr></thead>
            <tbody>
              {s.tokens.map((t) => <tr key={t.role}><td>{t.role}</td><td className="num">{t.n}</td></tr>)}
              <tr className="row-total"><td>Total</td><td className="num">{tokenTotal}</td></tr>
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2 className="card__head">Channel numbers</h2>
          <p>Views, watch time, subscribers and revenue are not connected yet, so nothing is shown here.</p>
          <p className="fine">Connecting the YouTube Analytics API for each channel would fill this in. No figure is estimated.</p>
        </section>
      </div>

      <section className="card">
        <h2 className="card__head">Recent activity</h2>
        {s.activity.length === 0 ? <p className="muted">Nothing yet.</p> : (
          <ol className="activity">
            {s.activity.map((e, i) => (
              <li key={i}><span className="activity__who">{e.actor || "System"}</span> {ACTION_LABEL[e.action] || e.action}<span className="activity__when">{ago(e.created_at)}</span></li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

Overview.Skeleton = function OverviewSkeleton() {
  return (
    <section className="page" aria-busy="true" aria-label="Loading">
      <div className="page__head"><span className="skel skel--head" /></div>
      <div className="pipeline">{STAGES.map((st) => <div key={st.id} className="stage-card stage-card--empty"><span className="skel skel--line" style={{ width: "60%" }} /><span className="skel skel--fig" /></div>)}</div>
      <div className="card">{[0, 1, 2].map((i) => <span key={i} className="skel skel--line" style={{ width: `${80 - i * 15}%`, margin: "0.9rem 0" }} />)}</div>
    </section>
  );
};
