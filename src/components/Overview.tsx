import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck, Bot, CirclePlay, FileText, FlaskConical, KeyRound, Lightbulb, LogIn, PenLine, PlugZap, RefreshCw, Scissors,
  ShieldCheck, Tv, Upload, UserRound, Users, Webhook, Wrench, type LucideIcon,
} from "lucide-react";
import { ago, api, Stats, STAGES, usd } from "../lib/api";

const ACTION_LABEL: Record<string, string> = {
  "research.create": "started research", "research.handoff": "handed a video to Script", "research.agent": "gave research to the agent",
  "research.claim": "claimed research", "research.cancel": "cancelled research", "token.create": "minted a token", "token.revoke": "revoked a token",
  "user.create": "added a person", "user.update": "renamed a person", "user.deactivate": "deactivated a person", "user.delete": "deleted a person",
  "channel.create": "added a channel", "channel.update": "edited a channel", "channel.delete": "deleted a channel", "channel.members": "changed channel members",
  "webhook.secret.set": "set the agent wake-up secret", "auth.login": "signed in to the CM app", "credential.issue": "issued a CM login",
};
const JOB_LABEL: Record<string, string> = { queued: "Queued", running: "Researching", review: "Needs review", handed_off: "In Script", failed: "Failed", cancelled: "Cancelled" };

export const STAGE_ICON: Record<string, LucideIcon> = {
  idea: Lightbulb, script: PenLine, assets: FileText, edit: Scissors, qa: ShieldCheck, upload: Upload, published: CirclePlay,
};
function actionIcon(action: string): LucideIcon {
  const k = action.split(".")[0];
  return ({ research: FlaskConical, token: KeyRound, user: UserRound, channel: Tv, webhook: Webhook, auth: LogIn, credential: BadgeCheck } as Record<string, LucideIcon>)[k] || Wrench;
}
const I = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export function Overview({ onGo }: { onGo: (v: "channels" | "people") => void }) {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { setS(await api.stats()); setError(""); } catch (e: any) { setError(e.message); } }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <section className="page"><div className="notice notice--error" role="alert"><p>Couldn’t load the numbers: {error}</p><button type="button" className="btn" onClick={load}><RefreshCw {...I} />Try again</button></div></section>;
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
          <p className="page__lede">Every video in the factory, by stage. Numbers come from the factory database, updated <span className="measured">{ago(s.generated_at)}</span>.</p>
        </div>
        <button type="button" className="btn" onClick={load}><RefreshCw {...I} />Refresh</button>
      </div>

      {/* Lead: one reading set large, then the stage track */}
      <div className="panels lead-panel">
        <div className="lead__reading">
          <span className="label">Videos in the factory</span>
          <span className="reading">{total}</span>
          <span className="lead__sub">across <span className="measured">{channels.length}</span> channel{channels.length === 1 ? "" : "s"}</span>
        </div>
        <ol className="track" aria-label="Videos per stage">
          {STAGES.map((st) => {
            const Icon = STAGE_ICON[st.id];
            const n = byStage[st.id] || 0;
            return (
              <li key={st.id} className={`track__stage${n ? " is-live" : ""}`}>
                <span className="track__label"><Icon {...I} />{st.label}</span>
                <span className="track__n">{n}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Readings: one surface, three panels */}
      <div className="panels bento">
        <section className="panel">
          <h2 className="panel__head"><Bot {...I} />Research agent</h2>
          {a.runs === 0 ? <p className="muted">No agent runs yet.</p> : (
            <dl className="figures">
              <div><dt>Briefs written</dt><dd>{a.succeeded}</dd></div>
              <div><dt>Failed runs</dt><dd>{a.failed}</dd></div>
              <div><dt>Average cost per brief</dt><dd>{usd(a.cost_avg, 3)}</dd></div>
              <div><dt>Spent, last 7 days</dt><dd>{usd(a.cost_7d)}</dd></div>
              <div><dt>Average time per brief</dt><dd>{Math.round(a.secs_avg)} s</dd></div>
              <div><dt>Average tool calls</dt><dd>{a.tools_avg.toFixed(1)}</dd></div>
            </dl>
          )}
          {a.model && <p className="fine">Model <span className="measured">{a.model.replace(/^openrouter\//, "")}</span> through OpenRouter. Total spent <span className="measured">{usd(a.cost_total)}</span>.</p>}
        </section>
        <section className="panel">
          <h2 className="panel__head"><FlaskConical {...I} />Research jobs</h2>
          <table className="table table--tight">
            <tbody>
              {s.jobs.length === 0 && <tr><td className="muted">No research jobs yet.</td></tr>}
              {s.jobs.map((j) => <tr key={j.status}><td>{JOB_LABEL[j.status] || j.status}</td><td className="num">{j.n}</td></tr>)}
            </tbody>
          </table>
          {verifiedPct !== null && <p className="fine">Facts in the latest briefs: <span className="measured">{s.briefs.facts}</span>, of which <span className="measured">{s.briefs.verified}</span> (<span className="measured">{verifiedPct}%</span>) were read at the source.</p>}
        </section>
        <section className="panel">
          <div className="panel__headrow"><h2 className="panel__head"><Users {...I} />People and access</h2><button type="button" className="link-btn" onClick={() => onGo("people")}>Manage</button></div>
          <dl className="figures figures--two">
            <div><dt>People</dt><dd className="is-person">{s.people.humans}</dd></div>
            <div><dt>Agents</dt><dd>{s.people.agents}</dd></div>
          </dl>
          <table className="table table--tight">
            <thead><tr><th scope="col">Role</th><th scope="col" className="num">Active tokens</th></tr></thead>
            <tbody>
              {s.tokens.map((t) => <tr key={t.role}><td>{t.role}</td><td className="num">{t.n}</td></tr>)}
              <tr className="row-total"><td>Total</td><td className="num">{tokenTotal}</td></tr>
            </tbody>
          </table>
        </section>
      </div>

      <section className="panels">
        <div className="panel">
          <div className="panel__headrow"><h2 className="panel__head"><Tv {...I} />By channel</h2><button type="button" className="link-btn" onClick={() => onGo("channels")}>Manage channels</button></div>
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
        </div>
      </section>

      <div className="split split--trail">
        <section className="panels">
          <div className="panel">
            <h2 className="panel__head">Recent activity</h2>
            {s.activity.length === 0 ? <p className="muted">Nothing yet.</p> : (
              <ol className="trail">
                {s.activity.map((e, i) => {
                  const Icon = actionIcon(e.action);
                  return (
                    <li key={i} className="trail__entry">
                      <span className="trail__node"><Icon size={14} strokeWidth={1.75} aria-hidden="true" /></span>
                      <span className="trail__text"><span className="trail__who">{e.actor || "System"}</span> {ACTION_LABEL[e.action] || e.action}</span>
                      <span className="trail__when">{ago(e.created_at)}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
        <section className="panels">
          <div className="panel">
            <h2 className="panel__head"><PlugZap {...I} />Channel numbers</h2>
            <p>Views, watch time, subscribers and revenue are not connected yet, so nothing is shown here.</p>
            <p className="fine">Connecting the YouTube Analytics API for each channel would fill this in. No figure is estimated.</p>
          </div>
        </section>
      </div>
    </section>
  );
}

Overview.Skeleton = function OverviewSkeleton() {
  return (
    <section className="page" aria-busy="true" aria-label="Loading">
      <div className="page__head"><span className="skel skel--head" /></div>
      <div className="panels lead-panel">
        <div className="lead__reading"><span className="skel skel--line" style={{ width: "50%" }} /><span className="skel skel--fig" /></div>
        <ol className="track">{STAGES.map((st) => <li key={st.id} className="track__stage"><span className="skel skel--line" style={{ width: "60%" }} /><span className="skel skel--line" style={{ width: "30%" }} /></li>)}</ol>
      </div>
      <div className="panels"><div className="panel">{[0, 1, 2].map((i) => <span key={i} className="skel skel--line" style={{ width: `${80 - i * 15}%`, margin: "0.9rem 0" }} />)}</div></div>
    </section>
  );
};
