# Verification register

States: Planned · Implemented but unverified · Verified with evidence · Blocked.

| Requirement (brief) | State | Evidence |
| --- | --- | --- |
| CRUD web application with persistent storage | Verified with evidence (local) | 23 pytest API tests and 8 Playwright browser tests (plus a manual browser walkthrough) against PostgreSQL 16; CI runs 40359245088, 40359773935 |
| Automated testing in CI/CD | Verified with evidence | Jobs "backend lint and tests" and "browser end-to-end tests" in runs 40359245088, 40359773935 |
| Static code analysis | Verified with evidence | Ruff and ESLint in every run; ESLint findings fixed before first commit (`docs/evidence/eslint-local-*.txt`) |
| Security vulnerability analysis | Verified with evidence | Run 40356987759 failed on Semgrep (1 error) and Trivy (1 critical, 1 high); fixed in the next two commits; run 40359245088 passes. Reports in `docs/evidence/run-40356987759/` |
| Declarative infrastructure | Verified with evidence | `infra/terraform/` applied in us-west-2 (32 resources); re-applied in every CD run |
| Deployment to public cloud, public URL | Verified with evidence | Runs 40480996816, 40482755029, 40483467970; Elastic IP URL serves the release named in `/api/health`; post-deploy smoke tests pass |
| CI/CD optimisation with before/after runs | Verified with evidence | `docs/experiments/ci-optimisation.md`; runs 40360515409, 40360830887, 40361138449, 40361874110 (baseline) and 40363253377, 40363756571, 40364058668 (optimised) |
| Health and resource utilisation monitoring | Verified with evidence | `AppHealthy` custom metric, EC2/RDS CPU, RDS storage; graphs in `screenshots/cw-*.png`; alarms OK |
| Recovery procedure for a failed deployment | Verified with evidence | `docs/evidence/recovery-rehearsal.md` |
| Local source change traced to the deployed app | Verified with evidence | `docs/evidence/local-change-commands.md` (commit 9318d3f, run 40483467970) |
