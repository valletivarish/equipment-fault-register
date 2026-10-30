# Prints run timings for the CI optimisation experiment; queue time is kept apart from job time.

import json
import subprocess
import sys
from datetime import datetime


def gh_api(path):
    # The gh CLI command is constant; the only argument is a run ID typed by the developer.
    output = subprocess.run(  # noqa: S603
        ["gh", "api", path],  # noqa: S607
        check=True,
        capture_output=True,
        text=True,  # noqa: S607
    )
    return json.loads(output.stdout)


def seconds(start, end):
    parse = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))  # noqa: E731
    return (parse(end) - parse(start)).total_seconds()


def row(repo, run_id):
    run = gh_api(f"repos/{repo}/actions/runs/{run_id}")
    jobs = gh_api(f"repos/{repo}/actions/runs/{run_id}/jobs")["jobs"]
    ran = [j for j in jobs if j["conclusion"] not in ("skipped", None) and j["started_at"]]
    first_start = min(j["started_at"] for j in ran)
    last_end = max(j["completed_at"] for j in ran)
    job_minutes = sum(seconds(j["started_at"], j["completed_at"]) for j in ran) / 60
    per_job = {
        j["name"].split(": ", 1)[-1]: round(seconds(j["started_at"], j["completed_at"]))
        for j in ran
    }
    return {
        "run": run_id,
        "event": run["event"],
        "commit": run["head_sha"][:7],
        "queue_s": round(seconds(run["created_at"], first_start)),
        "wall_s": round(seconds(first_start, last_end)),
        "job_minutes": round(job_minutes, 1),
        "jobs_run": len(ran),
        "jobs_skipped": len(jobs) - len(ran),
        "conclusion": run["conclusion"],
        "per_job_s": per_job,
    }


def main():
    repo = subprocess.run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],  # noqa: S607
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    rows = [row(repo, run_id) for run_id in sys.argv[1:]]
    print(json.dumps(rows, indent=2))


if __name__ == "__main__":
    main()
