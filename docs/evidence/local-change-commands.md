# Local change traced to AWS: fault priority

Change: a Priority field (Low, Medium, High; default Medium) on each fault, shown in the
register, the detail panel and the report/edit form, sortable by urgency. Made in the local
development environment, never in the GitHub web editor.

Before the change the deployed register had no Priority column
(`screenshots/aws-01-register-before-priority.png`, `aws-03-form-before-priority.png`).

## Commands used

```bash
# edit code/app/models.py, schemas.py, main.py, migrations/versions/0005_add_priority.py,
# code/src/FaultForm.jsx, FaultTable.jsx, FaultDetail.jsx, api.js, styles.css,
# code/tests/test_faults_api.py and e2e/tests/faults.spec.js in the editor

# API tests against a local PostgreSQL 16 container
docker run -d --rm --name efr-testdb -e POSTGRES_USER=faults -e POSTGRES_PASSWORD=faults \
  -e POSTGRES_DB=faults -p 55432:5432 postgres:16-alpine
cd code
../.venv/bin/ruff check .
../.venv/bin/pytest -q
npx eslint .
npm run build

# whole stack (Nginx + FastAPI + PostgreSQL) and browser tests
docker compose -f ../infra/local/docker-compose.yml up -d --build
cd ../e2e
RESTART_API_CMD="docker compose -f ../infra/local/docker-compose.yml restart api" npx playwright test

# version control and pipeline
cd ..
git add code e2e docs/evidence/local-change-commands.md
git commit -m "Add a priority to each fault"
git push origin main
gh run watch <run-id>
curl http://<elastic-ip>/api/health
```

## Result

| Item | Value |
| --- | --- |
| Commit | `9318d3f` "Add a priority to each fault" |
| Workflow run | 40483467970: all five CI jobs and the CD job passed |
| Deployed release | `/api/health` returned `"release":"9318d3f51309"` after the run |
| Database | migration 0005 ran on RDS; existing faults show Medium |
| Screenshots | before: `aws-01..03`; after: `aws-04-form-after-priority.png`, `aws-05-detail-after-priority.png`, `aws-06-register-after-priority-sorted.png` |
