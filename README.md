# YT Factory · Dashboard

Owner/admin PWA for the faceless YouTube factory: channels, people, role access tokens and pipeline numbers.

- **App:** https://thl007.github.io/yt-factory-dashboard/ (Expo web PWA, Hallmark Console theme, Google Fonts Host Grotesk + Atkinson Hyperlegible Mono, Lucide icons)
- **API:** https://yt-factory-api.thl007.workers.dev, code in [THL007/yt-factory-research](https://github.com/THL007/yt-factory-research) (`api/`)
- **Data:** Neon project `yt-factory-cm-1`

| Screen | What it does |
|---|---|
| Overview | Videos per stage (all channels and per channel), research jobs, research agent runs and cost, active tokens per role, recent activity. Only numbers from the factory database; YouTube analytics are not connected. |
| Channels | Add, edit (name, niche, language, cadence, voice and tone, status), members, delete when it has no videos (otherwise archive). |
| People and tokens | Add a person, rename, deactivate (revokes every token); mint a token for one person and one role (shown once), revoke tokens. |

Only `owner` and `admin` tokens can sign in. Only an owner can mint or revoke owner tokens. The Research desk keeps just its own token input and the agent wake-up secret.

## Develop

```sh
npm ci
npm run web       # dev server
npm run deploy    # build and publish to gh-pages
```
