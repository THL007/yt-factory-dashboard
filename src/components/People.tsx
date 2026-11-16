import { FormEvent, useCallback, useEffect, useState } from "react";
import { Ban, Bot, Check, Copy, KeyRound, Pencil, UserPlus, UserRound, UserX } from "lucide-react";
import { ago, api, Me, Person, PIPELINE_ROLES, Role, Token } from "../lib/api";

const I = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export function People({ me }: { me: Me }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [error, setError] = useState("");
  const [mintFor, setMintFor] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([api.people(), api.tokens()]);
      setPeople(p.users); setRoles(p.roles); setTokens(t); setError("");
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const activeCount = (uid: string) => (tokens || []).filter((t) => t.user_id === uid && !t.revoked_at).length;

  return (
    <section className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">People and tokens</h1>
          <p className="page__lede">A token belongs to one person and one role. Someone with two roles gets two tokens. Only a fingerprint of each token is stored.</p>
        </div>
      </div>
      {error && <div className="notice notice--error" role="alert"><p>{error}</p><button type="button" className="btn" onClick={load}>Try again</button></div>}

      <div className="panels duo">
        <MintToken me={me} people={people} roles={roles} preset={mintFor} onMinted={load} />
        <AddPerson onCreated={(id) => { setMintFor(id); load(); }} />
      </div>

      <section className="panels">
        <div className="panel panel--flush">
        <div className="panel__headrow panel__headrow--pad"><h2 className="panel__head"><UserRound {...I} />People</h2></div>
        {people === null && !error && <div className="pad">{[0, 1, 2].map((i) => <span key={i} className="skel skel--line" style={{ width: `${70 - i * 12}%`, margin: "0.9rem 0" }} />)}</div>}
        {people && (
          <table className="table table--rows">
            <thead><tr><th scope="col">Name</th><th scope="col" className="hide-s">Kind</th><th scope="col">Roles</th><th scope="col" className="num">Active tokens</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{people.map((p) => <PersonRow key={p.id} p={p} me={me} tokens={activeCount(p.id)} onMint={() => { setMintFor(p.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} onChanged={load} />)}</tbody>
          </table>
        )}
        </div>
      </section>

      <TokenTable tokens={tokens} me={me} onChanged={load} />
    </section>
  );
}

function PersonRow({ p, me, tokens, onMint, onChanged }: { p: Person; me: Me; tokens: number; onMint: () => void; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.display_name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const self = p.id === me.user.id;
  async function rename(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await api.renamePerson(p.id, name.trim()); setEditing(false); await onChanged(); } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }
  async function deactivate() {
    const warn = p.kind === "agent" ? " The research agent stops working until you add it back." : "";
    if (!window.confirm(`Deactivate ${p.display_name}? All their tokens are revoked at once.${warn}`)) return;
    setBusy(true); setError("");
    try { await api.deactivatePerson(p.id); await onChanged(); } catch (err: any) { setError(err.message); setBusy(false); }
  }
  return (
    <tr>
      <td>
        {editing ? (
          <form className="inline-form" onSubmit={rename}>
            <input className="input" aria-label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn" type="submit" disabled={busy || !name.trim()} aria-busy={busy}><Check {...I} />Save</button>
            <button className="link-btn" type="button" onClick={() => { setEditing(false); setName(p.display_name); }}>Cancel</button>
          </form>
        ) : <span className="person">{p.kind === "agent" ? <Bot {...I} className="person__icon person__icon--agent" /> : <UserRound {...I} className="person__icon" />}<span><span className="row-title">{p.display_name}{self ? " (you)" : ""}</span><span className="row-sub measured">{p.username}</span></span></span>}
        {error && <span className="field__error">{error}</span>}
      </td>
      <td className="hide-s">{p.kind === "agent" ? "Agent" : "Person"}</td>
      <td>{p.roles.length ? p.roles.join(", ") : <span className="muted">none</span>}</td>
      <td className="num">{tokens}</td>
      <td className="cell-action">
        <div className="row-actions">
          <button type="button" className="link-btn" onClick={onMint} aria-label={`Mint a token for ${p.display_name}`}><KeyRound size={14} strokeWidth={1.75} aria-hidden="true" />Mint token</button>
          {!editing && <button type="button" className="link-btn" onClick={() => setEditing(true)} aria-label={`Rename ${p.display_name}`}><Pencil size={14} strokeWidth={1.75} aria-hidden="true" />Rename</button>}
          {!self && <button type="button" className="link-btn link-btn--danger" disabled={busy} onClick={deactivate} aria-label={`Deactivate ${p.display_name}`}><UserX size={14} strokeWidth={1.75} aria-hidden="true" />Deactivate</button>}
        </div>
      </td>
    </tr>
  );
}

function MintToken({ me, people, roles, preset, onMinted }: { me: Me; people: Person[] | null; roles: Role[]; preset: string; onMinted: () => void }) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("research");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [minted, setMinted] = useState<{ token: string; who: string; role: string } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (preset) setUserId(preset); }, [preset]);

  const ordered = [...roles].sort((a, b) => {
    const rank = (c: string) => (PIPELINE_ROLES.includes(c) ? PIPELINE_ROLES.indexOf(c) : c === "admin" ? 10 : c === "owner" ? 11 : 20);
    return rank(a.code) - rank(b.code);
  }).filter((r) => r.code !== "owner" || me.role === "owner");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId) { setError("Pick a person."); return; }
    setBusy(true); setError(""); setMinted(null); setCopied(false);
    try {
      const r = await api.mintToken({ user_id: userId, role, label: label.trim(), expires_days: days ? Number(days) : undefined });
      setMinted({ token: r.token, who: people?.find((u) => u.id === userId)?.display_name || "", role });
      setLabel(""); setDays(""); onMinted();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="panel stack">
    <form className="form" onSubmit={submit} noValidate>
      <h2 className="panel__head"><KeyRound {...I} />Mint a token</h2>
      <div className="grid-2">
        <label className="field"><span className="field__label">Person</span>
          {people ? (
            <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Choose a person</option>
              {people.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
          ) : <span className="skel skel--input" />}
        </label>
        <label className="field"><span className="field__label">Role</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {ordered.map((r) => <option key={r.code} value={r.code}>{r.label}{PIPELINE_ROLES.includes(r.code) || r.code === "admin" || r.code === "owner" ? "" : " (old CM role)"}</option>)}
          </select>
        </label>
        <label className="field"><span className="field__label">Label (optional)</span><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Phone, laptop, freelancer name" /></label>
        <label className="field"><span className="field__label">Expires after, days (optional)</span><input className="input input--mono input--s" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} placeholder="never" /></label>
      </div>
      {error && <p className="field__error" role="alert">{error}</p>}
      <div className="form__actions"><button className="btn btn--primary" type="submit" disabled={busy} aria-busy={busy}><KeyRound {...I} />{busy ? "Minting…" : "Mint token"}</button></div>
    </form>
      {minted && (
        <div className="issued" role="status">
          <div className="issued__head"><span className="chip chip--person"><Check size={12} strokeWidth={2} aria-hidden="true" />Issued</span><span className="issued__who">{minted.who}</span><span className="chip chip--cool">{minted.role}</span></div>
          <code className="issued__token">{minted.token}</code>
          <p className="fine">Shown once. Copy it and send it to {minted.who} privately.</p>
          <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(minted.token).then(() => setCopied(true))}>{copied ? <Check {...I} /> : <Copy {...I} />}{copied ? "Copied" : "Copy token"}</button>
        </div>
      )}
    </div>
  );
}

function AddPerson({ onCreated }: { onCreated: (id: string) => void }) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await api.createPerson({ username: username.trim(), display_name: name.trim() });
      setMsg({ ok: true, text: `Added ${name || username}. They are picked in Mint a token.` });
      setUsername(""); setName(""); onCreated(r.id);
    } catch (err: any) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  }
  return (
    <form className="panel form" onSubmit={submit} noValidate>
      <h2 className="panel__head"><UserPlus {...I} />Add a person</h2>
      <label className="field"><span className="field__label">Username</span><input className="input input--mono" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="ama.k" autoCapitalize="off" /></label>
      <label className="field"><span className="field__label">Display name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ama K." /></label>
      {msg && <p className={msg.ok ? "field__ok" : "field__error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <div className="form__actions"><button className="btn" type="submit" disabled={busy || !username} aria-busy={busy}><UserPlus {...I} />{busy ? "Adding…" : "Add person"}</button></div>
    </form>
  );
}

function TokenTable({ tokens, me, onChanged }: { tokens: Token[] | null; me: Me; onChanged: () => Promise<void> }) {
  const [showRevoked, setShowRevoked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!tokens) return null;
  const revoked = tokens.filter((t) => t.revoked_at).length;
  const rows = tokens.filter((t) => showRevoked || !t.revoked_at);
  async function revoke(t: Token) {
    if (!window.confirm(`Revoke ${t.display_name}’s ${t.role} token${t.label ? ` (${t.label})` : ""}? Anyone using it is signed out at once.`)) return;
    setBusy(t.id); setError("");
    try { await api.revokeToken(t.id); await onChanged(); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }
  const expired = (t: Token) => t.expires_at && new Date(t.expires_at.replace(" ", "T").replace(/\+00$/, "Z")).getTime() < Date.now();
  return (
    <section className="panels">
      <div className="panel panel--flush">
      <div className="panel__headrow panel__headrow--pad"><h2 className="panel__head"><KeyRound {...I} />Tokens</h2>{revoked > 0 && <button type="button" className="link-btn" onClick={() => setShowRevoked(!showRevoked)}>{showRevoked ? "Hide" : "Show"} {revoked} revoked</button>}</div>
      {error && <div className="notice notice--error pad" role="alert"><p>{error}</p></div>}
      {rows.length === 0 ? <p className="muted pad">No active tokens.</p> : (
        <table className="table table--rows">
          <thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col" className="hide-s">Label</th><th scope="col" className="hide-s">Starts with</th><th scope="col" className="num">Last used</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className={t.revoked_at ? "is-revoked" : undefined}>
                <td>{t.display_name}<span className="row-sub measured">{t.username}</span></td>
                <td><span className="chip chip--cool">{t.role}</span></td>
                <td className="hide-s">{t.label || <span className="muted">none</span>}</td>
                <td className="hide-s measured">{t.token_prefix}…</td>
                <td className="num">{t.revoked_at ? "Revoked" : expired(t) ? "Expired" : t.last_used_at ? ago(t.last_used_at) : "Never"}</td>
                <td className="cell-action">{!t.revoked_at && (t.role !== "owner" || me.role === "owner") && (
                  <button type="button" className="link-btn link-btn--danger" disabled={busy === t.id} aria-busy={busy === t.id} onClick={() => revoke(t)}><Ban size={14} strokeWidth={1.75} aria-hidden="true" />{busy === t.id ? "Revoking…" : "Revoke"}</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>
    </section>
  );
}
