import { FormEvent, useCallback, useEffect, useState } from "react";
import { Archive, CircleCheck, CircleDashed, CirclePause, MousePointerClick, Plus, RefreshCw, Save, Trash2, Tv, UserCheck, Users, type LucideIcon } from "lucide-react";
import { api, Channel, CHANNEL_STATUS, ChannelStatus, Person } from "../lib/api";

type Draft = { name: string; niche: string; language: string; cadence: string; voice_tone: string; status: ChannelStatus };
const blank: Draft = { name: "", niche: "", language: "EN", cadence: "", voice_tone: "", status: "draft" };
const toDraft = (c: Channel): Draft => ({ name: c.name, niche: c.niche || "", language: c.language || "", cadence: c.cadence || "", voice_tone: c.voice_tone || "", status: c.status });

const STATUS_ICON: Record<ChannelStatus, LucideIcon> = { draft: CircleDashed, active: CircleCheck, paused: CirclePause, archived: Archive };
const I = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export function Channels() {
  const [list, setList] = useState<Channel[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([api.channels(), api.people()]);
      setList(c); setPeople(p.users); setError("");
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = (list || []).filter((c) => showArchived || c.status !== "archived");
  const archived = (list || []).filter((c) => c.status === "archived").length;
  const current = (list || []).find((c) => c.id === open) || null;

  return (
    <section className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Channels</h1>
          <p className="page__lede">Each channel has a niche, a language and a cadence. Members are the people who work its videos.</p>
        </div>
        {!adding && <button type="button" className="btn btn--primary" onClick={() => { setAdding(true); setOpen(null); }}><Plus {...I} />Add a channel</button>}
      </div>

      {error && <div className="notice notice--error" role="alert"><p>Couldn’t load channels: {error}</p><button type="button" className="btn" onClick={load}><RefreshCw {...I} />Try again</button></div>}
      {!error && list === null && <div className="panels"><div className="panel">{[0, 1, 2].map((i) => <span key={i} className="skel skel--line" style={{ width: `${70 - i * 12}%`, margin: "0.9rem 0" }} />)}</div></div>}
      {list && list.length === 0 && !adding && (
        <div className="panels"><div className="panel empty"><p className="empty__title">No channels yet.</p><p>Add the first one: a name and a niche are enough to start research.</p><button type="button" className="btn btn--primary" onClick={() => setAdding(true)}><Plus {...I} />Add a channel</button></div></div>
      )}

      {list && (list.length > 0 || adding) && (
        <div className="panels master">
          <nav className="master__list" aria-label="Channels">
            <ul>
              {shown.map((c) => {
                const SIcon = STATUS_ICON[c.status];
                return (
                  <li key={c.id}>
                    <button type="button" className="master__item" aria-current={open === c.id ? "true" : undefined} aria-expanded={open === c.id}
                      onClick={() => { setAdding(false); setOpen(open === c.id ? null : c.id); }} aria-label={`${open === c.id ? "Close" : "Edit"} ${c.name}`}>
                      <span className="master__name"><Tv {...I} />{c.name}</span>
                      <span className="master__meta">
                        <span className={`chip chip--${c.status}`}><SIcon size={12} strokeWidth={2} aria-hidden="true" />{CHANNEL_STATUS.find((x) => x.id === c.status)?.label}</span>
                        <span className="measured">{c.language}</span>
                        <span className="measured">{c.videos} video{c.videos === 1 ? "" : "s"}</span>
                      </span>
                      <span className="row-sub">{c.niche || "No niche yet"}{c.cadence ? `. ${c.cadence}` : ""}</span>
                      {c.members.length > 0 && <span className="master__members"><Users size={12} strokeWidth={1.75} aria-hidden="true" />{c.members.map((m) => m.display_name).join(", ")}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {archived > 0 && <button type="button" className="link-btn master__more" onClick={() => setShowArchived(!showArchived)}>{showArchived ? "Hide" : "Show"} {archived} archived</button>}
          </nav>
          <div className="master__detail">
            {adding && <ChannelForm title="New channel" initial={blank} submitLabel="Add channel" onCancel={() => setAdding(false)}
              onSubmit={async (d) => { const r = await api.createChannel(d); setAdding(false); await load(); setOpen(r.id); }} />}
            {!adding && current && (
              <>
                <ChannelForm key={current.id} title={`Edit ${current.name}`} initial={toDraft(current)} submitLabel="Save changes" onCancel={() => setOpen(null)}
                  onSubmit={async (d) => { await api.updateChannel(current.id, d); await load(); }} />
                <Members key={`m-${current.id}`} c={current} people={people} onSaved={load} />
                <Danger c={current} onDone={async () => { await load(); }} />
              </>
            )}
            {!adding && !current && (
              <div className="detail-empty"><MousePointerClick size={20} strokeWidth={1.5} aria-hidden="true" /><p>Pick a channel to edit its details, status and members.</p></div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ChannelForm({ title, initial, submitLabel, onSubmit, onCancel }: { title: string; initial: Draft; submitLabel: string; onSubmit: (d: Draft) => Promise<void>; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!d.name.trim()) { setMsg({ ok: false, text: "The channel needs a name." }); return; }
    setBusy(true); setMsg(null);
    try { await onSubmit({ ...d, name: d.name.trim() }); setMsg({ ok: true, text: "Saved." }); } catch (err: any) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  }
  return (
    <form className="form" onSubmit={submit} noValidate>
      <h2 className="panel__head">{title}</h2>
      <div className="grid-2">
        <label className="field"><span className="field__label">Name</span><input className="input" value={d.name} onChange={set("name")} placeholder="Deep Sea Facts" /></label>
        <label className="field"><span className="field__label">Niche</span><input className="input" value={d.niche} onChange={set("niche")} placeholder="Ocean animals, science explainers" /></label>
        <label className="field"><span className="field__label">Language</span><input className="input input--s" value={d.language} onChange={set("language")} placeholder="EN" /></label>
        <label className="field"><span className="field__label">Cadence</span><input className="input" value={d.cadence} onChange={set("cadence")} placeholder="3 Shorts a week" /></label>
        <label className="field field--wide"><span className="field__label">Voice and tone</span><input className="input" value={d.voice_tone} onChange={set("voice_tone")} placeholder="Calm, curious, no hype" /></label>
      </div>
      <fieldset className="field">
        <legend className="field__label">Status</legend>
        <div className="groove" role="radiogroup">
          {CHANNEL_STATUS.map((s) => (
            <label key={s.id} className="groove__opt"><input type="radio" name={`status-${title}`} checked={d.status === s.id} onChange={() => setD({ ...d, status: s.id })} /><span>{(() => { const SI = STATUS_ICON[s.id]; return <SI size={14} strokeWidth={1.75} aria-hidden="true" />; })()}{s.label}</span></label>
          ))}
        </div>
      </fieldset>
      {msg && <p className={msg.ok ? "field__ok" : "field__error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <div className="form__actions">
        <button className="btn btn--primary" type="submit" disabled={busy} aria-busy={busy}><Save {...I} />{busy ? "Saving…" : submitLabel}</button>
        <button className="btn" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

function Members({ c, people, onSaved }: { c: Channel; people: Person[]; onSaved: () => Promise<void> }) {
  const [sel, setSel] = useState<Set<string>>(new Set(c.members.map((m) => m.id)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = sel.size !== c.members.length || c.members.some((m) => !sel.has(m.id));
  async function save() {
    setBusy(true); setMsg(null);
    try { await api.setMembers(c.id, [...sel]); await onSaved(); setMsg({ ok: true, text: "Members saved." }); } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  }
  return (
    <div className="subsection">
      <h3 className="subsection__head"><Users {...I} />Members</h3>
      {people.length === 0 ? <p className="muted">No people yet. Add them under People and tokens.</p> : (
        <div className="checks">
          {people.map((p) => (
            <label key={p.id} className="check">
              <input type="checkbox" checked={sel.has(p.id)} onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(p.id) : n.delete(p.id); setSel(n); }} />
              <span>{p.display_name}<span className="row-sub">{p.roles.join(", ") || "no role"}</span></span>
            </label>
          ))}
        </div>
      )}
      {msg && <p className={msg.ok ? "field__ok" : "field__error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <button type="button" className="btn" disabled={busy || !changed} aria-busy={busy} onClick={save}><UserCheck {...I} />{busy ? "Saving…" : "Save members"}</button>
    </div>
  );
}

function Danger({ c, onDone }: { c: Channel; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function del() {
    if (!window.confirm(`Delete ${c.name}? This can’t be undone from the dashboard.`)) return;
    setBusy(true); setError("");
    try { await api.deleteChannel(c.id); await onDone(); } catch (e: any) { setError(e.message); setBusy(false); }
  }
  return (
    <div className="subsection">
      <h3 className="subsection__head"><Trash2 {...I} />Remove</h3>
      {c.videos > 0
        ? <p className="muted">This channel has {c.videos} video ticket{c.videos === 1 ? "" : "s"}, so it can only be archived. Set its status to Archived above.</p>
        : <><p className="muted">No videos yet, so the channel can be deleted.</p><button type="button" className="btn btn--danger" disabled={busy} aria-busy={busy} onClick={del}><Trash2 {...I} />{busy ? "Deleting…" : "Delete channel"}</button></>}
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  );
}
