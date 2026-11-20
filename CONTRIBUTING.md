# Contributing

Create a task-sized branch and open a pull request. Explain the observed problem,
the resulting behavior and the checks actually run. Product-owner review belongs
to `@kienbh`; passing CI is required before merge. Do not auto-merge others' work.

Use Node 24, `npm ci`, and `npm run security:install-hooks` in each clone. Before a
PR, run `npm run security:test`, `npm test`, `npm run build` and `git diff --check`.
UI changes need browser evidence; label simulated devices honestly.

Use synthetic local data. Never commit environment secrets, tokens, databases,
backups, sessions, logs or personal screenshots. Only submit assets you may
redistribute; include their source/license and retain notices. Original submitted
code and original copy are contributed under MIT; third-party material keeps its
own terms. Do not restore assets or quotations from private project history.

This public repository has independent history. Publish reviewed patches through
PRs, never by mirroring private branches or adding the private repository as a
public remote. Deployments and production access require the operator's consent.
