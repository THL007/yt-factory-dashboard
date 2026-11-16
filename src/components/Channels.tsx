import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Channel, CHANNEL_STATUS, ChannelStatus, Person } from "../lib/api";

type Draft = { name: string; niche: string; language: string; cadence: string; voice_tone: string; status: ChannelStatus };
const blank: Draft = { name: "", niche: "", language: "EN", cadence: "", voice_tone: "", status: "draft" };
const toDraft = (c: Channel): Draft => ({ name: c.name, niche: c.niche || "", language: c.language || "", cadence: c.cadence || "", voice_tone: c.voice_tone || "", status: c.status });

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

  return (
    <section className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Channels</h1>
          <p className="page__lede">Each channel has a niche, a language and a cadence. Members are the people who work its videos.</p>
        </div>
        {!adding && <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>Add a channel</button>}
      </div>

      {adding && <ChannelForm title="New channel" initial={blank} submitLabel="Add channel" onCancel={() => setAdding(false)}
        onSubmit={async (d) => { const r = await api.createChannel(d); setAdding(false); await load(); setOpen(r.id); }} />}

      {error && <div className="notice notice--error" role="alert"><p>Couldn’t load channels: {error}</p><button type="button" className="btn" onClick={load}>Try again</button></div>}
      {!error && list === null && <div className="card">{[0, 1, 2].map((i) => <span key={i} className="skel skel--line" style={{ width: `${70 - i * 12}%`, margin: "0.9rem 0" }} />)}</div>}
      {list && list.length === 0 && !adding && (
        <div className="card empty"><p className="empty__title">No channels yet.</p><p>Add the first one: a name and a niche are enough to start research.</p><button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>Add a channel</button></div>
      )}

      {list && list.length > 0 && (
        <section className="card card--flush">
          <table className="table table--rows">
            <thead><tr><th scope="col">Channel</th><th scope="col" className="hide-s">Language</th><th scope="col" className="hide-s">Cadence</th><th scope="col">Status</th><th scope="col" className="num">Videos</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <ChannelRow key={c.id} c={c} people={people} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} onChanged={load} />
              ))}
            </tbody>
          </table>
          {archived > 0 && <div className="card__foot"><button type="button" className="link-btn" onClick={() => setShowArchived(!showArchived)}>{showArchived ? "Hide" : "Show"} {archived} archived</button></div>}
        </section>
      )}
    </section>
  );
}

function ChannelRow({ c, people, open, onToggle, onChanged }: { c: Channel; people: Person[]; open: boolean; onToggle: () => void; onChanged: () => Promise<void> }) {
  return (
    <>
      <tr className={open ? "is-open" : undefined}>
        <td><span className="row-title">{c.name}</span><span className="row-sub">{c.niche || "No niche yet"}{c.members.length ? `. ${c.members.map((m) => m.display_name).join(", ")}` : ""}</span></td>
        <td className="hide-s">{c.language}</td>
        <td className="hide-s">{c.cadence || <span className="muted">not set</span>}</td>
        <td><span className={`status status--${c.status}`}>{CHANNEL_STATUS.find((s) => s.id === c.status)?.label}</span></td>
        <td className="num">{c.videos}</td>
        <td className="cell-action"><button type="button" className="link-btn" aria-expanded={open} onClick={onToggle} aria-label={`${open ? "Close" : "Edit"} ${c.name}`}>{open ? "Close" : "Edit"}</button></td>
      </tr>
      {open && (
        <tr className="row-panel"><td colSpan={6}>
          <ChannelForm title={`Edit ${c.name}`} initial={toDraft(c)} submitLabel="Save changes" onCancel={onToggle}
            onSubmit={async (d) => { await api.updateChannel(c.id, d); await onChanged(); }} flat />
          <Members c={c} people={people} onSaved={onChanged} />
          <Danger c={c} onDone={onChanged} />
        </td></tr>
      )}
    </>
  );
}

function ChannelForm({ title, initial, submitLabel, onSubmit, onCancel, flat }: { title: string; initial: Draft; submitLabel: string; onSubmit: (d: Draft) => Promise<void>; onCancel: () => void; flat?: boolean }) {
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
    <form className={flat ? "form" : "card form"} onSubmit={submit} noValidate>
      <h2 className="card__head">{title}</h2>
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
            <label key={s.id} className="groove__opt"><input type="radio" name={`status-${title}`} checked={d.status === s.id} onChange={() => setD({ ...d, status: s.id })} /><span>{s.label}</span></label>
          ))}
        </div>
      </fieldset>
      {msg && <p className={msg.ok ? "field__ok" : "field__error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <div className="form__actions">
        <button className="btn btn--primary" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving…" : submitLabel}</button>
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
      <h3 className="subsection__head">Members</h3>
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
      <button type="button" className="btn" disabled={busy || !changed} aria-busy={busy} onClick={save}>{busy ? "Saving…" : "Save members"}</button>
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
      <h3 className="subsection__head">Remove</h3>
      {c.videos > 0
        ? <p className="muted">This channel has {c.videos} video ticket{c.videos === 1 ? "" : "s"}, so it can only be archived. Set its status to Archived above.</p>
        : <><p className="muted">No videos yet, so the channel can be deleted.</p><button type="button" className="btn btn--danger" disabled={busy} aria-busy={busy} onClick={del}>{busy ? "Deleting…" : "Delete channel"}</button></>}
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  );
}
