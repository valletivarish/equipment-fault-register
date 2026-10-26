# Equipment Fault Register

A web application for a community workshop to record faulty shared equipment and track each
fault until it is repaired or written off. Coordinators can report a fault, browse the register,
open a fault's details, edit its description or repair status, and delete incorrect records.

The application is deployed on AWS through a GitHub Actions CI/CD pipeline that runs automated
tests, static code analysis and security scans before every deployment.

## Technology

| Layer | Choice |
| --- | --- |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic migrations |
| Frontend | React 19, React Router, Vite |
| Database | PostgreSQL 16 (Amazon RDS in AWS, Docker locally) |
| Web server | Nginx serving the React build and proxying `/api/` to FastAPI |
| Infrastructure | Terraform (VPC, EC2 with Elastic IP, RDS, S3, SSM, CloudWatch) |
| CI/CD | GitHub Actions, one workflow with separate CI and CD stages |
| Testing | pytest (API), Playwright (browser end-to-end) |

## Repository layout

```text
.github/workflows/   CI/CD pipeline
code/                application source: FastAPI backend (app/, migrations/, tests/)
                     and React frontend (src/, e2e/) with their build configuration
infra/               Terraform, Nginx configuration and the local Docker Compose stack
scripts/             deployment and rollback scripts
docs/                UI plan, evidence, experiments and verification records
```

## Data model

Each fault records an asset tag (letters, numbers and dashes), the equipment name, a fault
description, the date it was reported and a repair status: Reported, In repair, Awaiting parts,
Repaired or Written off. The API validates every field, and the database enforces the
allowed statuses.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check including a database query and the running release |
| GET | `/api/faults` | List faults, newest first |
| GET | `/api/faults/{id}` | One fault |
| POST | `/api/faults` | Report a fault |
| PUT | `/api/faults/{id}` | Edit a fault |
| DELETE | `/api/faults/{id}` | Delete a fault |

## Running locally

Requirements: Docker, Node.js 22, Python 3.12.

```bash
cd code
npm ci
npm run build
docker compose -f ../infra/local/docker-compose.yml up -d --build
```

The application is then available at http://localhost:8080. For frontend development with hot
reload, run the API with `uvicorn app.main:app --port 8000` from `code/` and start `npm run dev`.

## Tests and checks

API tests need a PostgreSQL database; by default they use `localhost:55432`.

```bash
docker run -d --rm --name efr-testdb -e POSTGRES_USER=faults -e POSTGRES_PASSWORD=faults \
  -e POSTGRES_DB=faults -p 55432:5432 postgres:16-alpine
python3.12 -m venv .venv && .venv/bin/pip install -r code/requirements-dev.txt
cd code
../.venv/bin/pytest
../.venv/bin/ruff check .
npx eslint .
```

Browser end-to-end tests run against the Docker Compose stack:

```bash
cd code
npx playwright install chromium
RESTART_API_CMD="docker compose -f ../infra/local/docker-compose.yml restart api" npx playwright test
```

## Deployment

Pushing to `main` runs the full pipeline. The CD stage starts only after every CI job has
passed. It uploads the tested release to S3, and AWS Systems Manager installs it on the EC2
instance: the backend is installed, Alembic migrations run against RDS, the release is switched
and Nginx is reloaded. A failed health check restores the previous release automatically.
See `infra/terraform/` for the AWS resources and `scripts/` for the release and rollback steps.
