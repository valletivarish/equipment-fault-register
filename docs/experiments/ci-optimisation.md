# CI/CD optimisation experiment

## Change under test

Commit `e67c6d7` changed `.github/workflows/ci-cd.yml` in two ways:

1. **Skip runs that cannot change the application:** `paths-ignore` for `docs/**`, `report/**`,
   `video/**` and `**/*.md` on push and pull request; a newer pull-request commit cancels the
   older run (`concurrency`, never on `main`).
2. **Caching:** pip (keyed on `code/requirements-dev.txt` and
   `scripts/ci/requirements-security.txt`), npm (keyed on both lock files), the Playwright
   Chromium build (keyed on `e2e/package-lock.json`), and the checksum-verified Trivy and
   Gitleaks binaries with the Trivy checks bundle (keyed on tool versions).

No test, analysis or security step was removed; every job still runs on every code change.

## Method

Same GitHub-hosted runner type (`ubuntu-latest`) for all runs. Baseline runs B1–B3 use one
commit (`f17c7da`) and the old workflow; optimised runs O2–O3 use one commit (`e67c6d7`) and the
new workflow. B2, B3, O2 and O3 were started with `workflow_dispatch`, so the trigger is the
same. Timings come from the GitHub API with `scripts/ci/run_timings.py`: queue time (run created
to first job started) is kept apart from wall time (first job started to last job finished) and
job-minutes (sum of job durations, which is what the runner actually executes). The deploy job
was skipped in every run, as AWS was not configured.

## Results

| Condition | Run ID | Commit | Trigger | Cache | Queue (s) | Wall (s) | Job-min | Install steps (s) | Jobs run / skipped | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline B1 | 40360515409 | f17c7da | push (docs only) | none | 3 | 109 | 3.6 | 64 | 5 / 1 | success |
| Baseline B2 | 40360830887 | f17c7da | dispatch | none | 5 | 106 | 3.6 | 63 | 5 / 1 | success |
| Baseline B3 | 40361138449 | f17c7da | dispatch | none | 4 | 111 | 3.8 | 63 | 5 / 1 | success |
| Baseline B4 | 40361874110 | 96fd069 | push (code) | none | 3 | 503 | 10.4 | 450 | 5 / 1 | success |
| Optimised O1 | 40363253377 | e67c6d7 | push (workflow) | cold | 4 | 121 | 3.9 | 62 | 5 / 1 | success |
| Optimised O2 | 40363756571 | e67c6d7 | dispatch | warm | 5 | 101 | 3.4 | 42 | 5 / 1 | success |
| Optimised O3 | 40364058668 | e67c6d7 | dispatch | warm | 4 | 113 | 3.9 | 44 | 5 / 1 | success |
| Optimised docs-only | — | (this commit) | push (docs only) | — | — | 0 | 0 | 0 | 0 / 0 | no run started |

"Install steps" adds the backend pip install, the scanner install and download, the frontend
`npm ci` and the Playwright install (which includes the E2E `npm ci`).

## Interpretation

Documentation-only commits are where the clearest saving lies: B1 spent 3.6 job-minutes
rebuilding, testing and scanning an unchanged application because a Markdown file changed,
while the same kind of commit now starts no run. Report writing will produce many such commits
in the final weeks, so this removes whole redundant pipelines rather than seconds.

Caching reduced the measured install and download time from about 63 s to about 43 s per warm
run (about a third), mainly by skipping the scanner binary downloads and the Chromium download.
Total job-minutes did not change in a meaningful way (3.67 baseline average against 3.65 warm
average), because the scans and tests dominate each run and cache restore and save steps add a
few seconds back. The cold run O1 was slightly slower than the baseline because it also saved
the caches.

## Limitations

Only three comparable baseline runs and two warm optimised runs were collected, so differences
of a few seconds are within normal runner variation. B4 shows how large that variation can be:
its Playwright step spent 411 s in `apt` package downloads on GitHub's side, an external delay
that caching the browser does not remove, because system libraries are still installed with
`apt` on each run. Wall time and job-minutes are proxies; runner energy use and carbon were not
measured, and cache storage itself has a cost. Runs B2–B3 and O2–O3 were started manually, not
by real development commits, to keep the code identical within each condition.
