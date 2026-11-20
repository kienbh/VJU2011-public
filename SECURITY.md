# Security

Keep API keys, passwords, SSO secrets, private keys, admin tokens, sessions and
databases outside Git and the served `public/` and `dist/` directories. API
route names and public client IDs are not credentials. Never put credentials in
`VITE_*` variables: client code is visible to every visitor.

Run `npm run security:install-hooks` in every clone. Gitleaks 8.30.1 is downloaded
from its official release and verified against a pinned SHA-256. Installation
refuses to overwrite existing custom hooks. Pre-commit scans staged contents;
pre-push scans reachable history. Findings are redacted. Hooks may be bypassed;
GitHub protections and CI provide additional controls.

`npm run release:package` rebuilds a clean commit, rejects ignored/untracked
public files, includes dependency license notices and scans extracted source
and runtime archives. Upload only listed artifacts after verifying checksums.
Never upload a directory containing `FAILED.txt` or ZIP the entire workspace.

`.gitignore` and archive exclusions do not remove files from history. If a real
credential is exposed, revoke/rotate it first, then coordinate history/artifact
cleanup with the maintainer. Do not paste its value in an issue or PR.

Report vulnerabilities privately through GitHub's **Security → Report a
vulnerability** when enabled. Public issues should contain only non-sensitive
reproduction steps. No passwords, tokens or user data are needed for a report.
