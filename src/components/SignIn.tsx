import { FormEvent, useState } from "react";
import { Factory, LogIn } from "lucide-react";
import { api, DEFAULT_API, isAdmin, saveSettings } from "../lib/api";

export function SignIn({ onDone }: { onDone: () => void }) {
  const [token, setToken] = useState("");
  const [apiUrl, setApiUrl] = useState(DEFAULT_API);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const s = { api: apiUrl.trim(), token: token.trim() };
    if (!/^ytf_[a-f0-9]{48}$/.test(s.token)) { setError("A factory token starts with ytf_ followed by 48 characters."); return; }
    setBusy(true); setError("");
    try {
      const me = await api.me(s);
      if (!isAdmin(me.role)) { setError(`This token has the ${me.role} role. The dashboard needs an owner or admin token.`); return; }
      saveSettings(s); onDone();
    } catch (err: any) { setError(err.status === 401 ? "That token is not valid, revoked or expired." : err.message); }
    finally { setBusy(false); }
  }

  return (
    <main className="signin">
      <form className="panel signin__card" onSubmit={submit} noValidate>
        <Factory size={28} strokeWidth={1.5} aria-hidden="true" className="signin__mark" />
        <h1 className="signin__title">Factory dashboard</h1>
        <p className="signin__lede">Channels, people, access tokens and pipeline numbers. Sign in with an owner or admin token.</p>
        <label className="field">
          <span className="field__label">Access token</span>
          <input className="input input--mono" type="password" autoComplete="off" spellCheck={false} value={token}
            onChange={(e) => setToken(e.target.value)} placeholder="ytf_…" aria-invalid={!!error} aria-describedby={error ? "signin-err" : undefined} />
        </label>
        <details className="disclosure">
          <summary>API address</summary>
          <label className="field"><span className="field__label">Factory API</span><input className="input input--mono" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} /></label>
        </details>
        {error && <p id="signin-err" className="field__error" role="alert">{error}</p>}
        <button className="btn btn--primary" type="submit" disabled={busy} aria-busy={busy}><LogIn size={16} strokeWidth={1.75} aria-hidden="true" />{busy ? "Checking…" : "Sign in"}</button>
        <p className="fine">The token stays in this browser. Signing out removes it.</p>
      </form>
    </main>
  );
}
