# Equipment Fault Register

A web application for a community workshop to record faulty shared equipment and track each
fault until it is repaired or written off. Coordinators can report a fault, search, filter, sort and page
through the register, open a fault's details, edit it, delete incorrect records and keep a dated repair log
of the work done on each fault.

The application is deployed on AWS through a GitHub Actions CI/CD pipeline that runs automated
tests, static code analysis and security scans before every deployment.

## Technology

| Layer | Choice |
| --- | --- |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic migrations |
| Frontend | React 19, React Router, Vite |
| Database | PostgreSQL 16 (Amazon RDS in AWS, Docker locally) |
| Web server | Nginx serving the React build and proxying `/api/` to FastAPI |
| Infrastructure | Terraform (VPC with S3/SSM/CloudWatch endpoints, EC2 with Elastic IP, RDS, S3, CloudWatch) |
| CI/CD | GitHub Actions, one workflow with separate CI and CD stages |
| Testing | pytest (API), curl smoke test after each deployment |

## Repository layout

```text
.github/workflows/   CI/CD pipeline
code/                application source: FastAPI backend (app/, migrations/, tests/)
                     and React frontend (src/) with their build configuration
infra/               Terraform, Nginx configuration and the local Docker Compose stack
scripts/             deployment and rollback scripts
docs/                local working notes and evidence (not tracked in git)
```

## Data model

Each fault records an asset tag (letters, numbers and dashes), the equipment name, its workshop
location, a fault description, the date it was reported and a repair status: Open, In progress,
Waiting for parts, Fixed or Not repairable. A fault has any number of repair notes, each with a date
and a short description of the work done; a note cannot be dated before the fault was reported
or in the future, and deleting a fault deletes its notes. The API validates every field, and the
database enforces the allowed statuses and the link between notes and faults.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check including a database query and the running release |
| GET | `/api/faults?q=&status=&sort=&order=&page=&page_size=` | One page of faults (10 by default, at most 50) with the total and open counts; searched by tag or name, filtered by status and sorted by tag, equipment, location, reported date or status |
| GET | `/api/faults/{id}` | One fault |
| POST | `/api/faults` | Report a fault |
| PUT | `/api/faults/{id}` | Edit a fault |
| DELETE | `/api/faults/{id}` | Delete a fault and its notes |
| GET | `/api/faults/{id}/notes` | Repair notes for a fault, newest first |
| POST | `/api/faults/{id}/notes` | Add a repair note |
| PUT | `/api/notes/{id}` | Edit a repair note |
| DELETE | `/api/notes/{id}` | Delete a repair note |

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

### API tests and linting

```bash
docker run -d --rm --name efr-testdb -e POSTGRES_USER=faults -e POSTGRES_PASSWORD=faults \
  -e POSTGRES_DB=faults -p 55432:5432 postgres:16-alpine
python3.12 -m venv .venv && .venv/bin/pip install -r code/requirements-dev.txt
cd code
../.venv/bin/pytest
../.venv/bin/ruff check .
npx eslint .
```

### Deployed application check

```bash
bash scripts/smoke-test.sh http://localhost:8080 local
```

## Deployment

Pushing to `main` runs the full pipeline. The CD stage starts only after every CI job has
passed. It uploads the tested release, including the Python wheels it needs, to S3, and AWS
Systems Manager installs it on the EC2 instance: the backend is installed, Alembic migrations run against RDS, the release is switched
and Nginx is reloaded. A failed health check restores the previous release automatically.
See `infra/terraform/` for the AWS resources and `scripts/` for the release and rollback steps.

The EC2 instance has no outbound internet access: it reaches S3 (release bundles and Amazon
Linux packages) through a gateway endpoint and SSM, Parameter Store and CloudWatch through
interface endpoints, and installs Python packages only from the wheels in the release bundle.
