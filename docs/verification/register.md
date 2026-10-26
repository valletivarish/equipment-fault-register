# Verification register

States: Planned · Implemented but unverified · Verified with evidence · Blocked.

| Requirement (brief) | State | Evidence |
| --- | --- | --- |
| CRUD web application with persistent storage | Verified with evidence (local) | 23 pytest API tests and 8 Playwright browser tests (plus a manual browser walkthrough) against PostgreSQL 16; CI runs 40359245088, 40359773935 |
| Automated testing in CI/CD | Verified with evidence | Jobs "backend lint and tests" and "browser end-to-end tests" in runs 40359245088, 40359773935 |
| Static code analysis | Verified with evidence | Ruff and ESLint in every run; ESLint findings fixed before first commit (`docs/evidence/eslint-local-*.txt`) |
| Security vulnerability analysis | Verified with evidence | Run 40356987759 failed on Semgrep (1 error) and Trivy (1 critical, 1 high); fixed in the next two commits; run 40359245088 passes. Reports in `docs/evidence/run-40356987759/` |
| Declarative infrastructure | Implemented but unverified | `infra/terraform/` validates in CI; not yet applied to AWS |
| Deployment to public cloud, public URL | Planned | Needs AWS Academy lab session |
| CI/CD optimisation with before/after runs | Verified with evidence | `docs/experiments/ci-optimisation.md`; runs 40360515409, 40360830887, 40361138449, 40361874110 (baseline) and 40363253377, 40363756571, 40364058668 (optimised) |
| Health and resource utilisation monitoring | Implemented but unverified | CloudWatch alarm, dashboard and health timer defined; not yet deployed |
| Recovery procedure for a failed deployment | Implemented but unverified | `scripts/deploy.sh` automatic rollback, `scripts/rollback.sh`; rehearsal needs AWS |
| Local source change traced to the deployed app | Planned | Priority field reserved for the demonstration |
