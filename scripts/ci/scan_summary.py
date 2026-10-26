"""Turn a test or scan report into a short table for the GitHub Actions run.

Usage: scan_summary.py <tool> <report-file> <tool-version>

The table is printed to the job log and appended to $GITHUB_STEP_SUMMARY, so
every check appears on the run's Summary page. The script exits with status 1
when the report breaks that tool's gate, which fails the CI job.
"""

import json
import os
import sys
from collections import Counter

SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]


def pytest_report(path):
    # defusedxml refuses external entities and entity-expansion bombs, which the
    # standard library parser does not fully guard against. Only the backend
    # job installs it, so it is imported here rather than at the top.
    from defusedxml import ElementTree

    suite = ElementTree.parse(path).getroot()
    suite = suite if suite.tag == "testsuite" else suite.find("testsuite")
    total = int(suite.get("tests"))
    failed = int(suite.get("failures")) + int(suite.get("errors"))
    skipped = int(suite.get("skipped"))
    counts = {"passed": total - failed - skipped, "failed": failed, "skipped": skipped}
    return counts, failed > 0 or skipped > 0


def playwright_report(path):
    stats = json.load(open(path))["stats"]
    counts = {
        "passed": stats["expected"],
        "failed": stats["unexpected"],
        "flaky": stats["flaky"],
        "skipped": stats["skipped"],
    }
    return counts, stats["unexpected"] > 0 or stats["skipped"] > 0


def ruff_report(path):
    findings = json.load(open(path))
    counts = Counter(f["code"] for f in findings)
    return {"findings": len(findings), **counts}, len(findings) > 0


def eslint_report(path):
    files = json.load(open(path))
    errors = sum(f["errorCount"] for f in files)
    warnings = sum(f["warningCount"] for f in files)
    return {"errors": errors, "warnings": warnings}, errors > 0


def bandit_report(path):
    results = json.load(open(path))["results"]
    counts = Counter(r["issue_severity"] for r in results)
    return by_severity(counts), counts["HIGH"] + counts["MEDIUM"] > 0


def pip_audit_report(path):
    deps = json.load(open(path))["dependencies"]
    vulnerable = [d for d in deps if d.get("vulns")]
    advisories = sum(len(d["vulns"]) for d in vulnerable)
    counts = {"packages": len(deps), "vulnerable": len(vulnerable), "advisories": advisories}
    return counts, advisories > 0


def npm_audit_report(path):
    vulns = json.load(open(path))["metadata"]["vulnerabilities"]
    counts = Counter({k.upper(): v for k, v in vulns.items() if k != "total"})
    return by_severity(counts), counts["CRITICAL"] + counts["HIGH"] > 0


def semgrep_report(path):
    results = json.load(open(path))["results"]
    counts = Counter(r["extra"]["severity"] for r in results)
    return {"findings": len(results), **counts}, counts["ERROR"] > 0


def trivy_report(path):
    counts = Counter()
    for result in json.load(open(path)).get("Results", []):
        for item in result.get("Misconfigurations", []) + result.get("Vulnerabilities", []):
            counts[item["Severity"]] += 1
    return by_severity(counts), counts["CRITICAL"] + counts["HIGH"] > 0


def gitleaks_report(path):
    leaks = json.load(open(path))
    return {"secrets found": len(leaks)}, len(leaks) > 0


def by_severity(counts):
    return {s: counts.get(s, 0) for s in SEVERITIES if s in counts or s in ("CRITICAL", "HIGH")}


PARSERS = {
    "pytest": pytest_report,
    "playwright": playwright_report,
    "ruff": ruff_report,
    "eslint": eslint_report,
    "bandit": bandit_report,
    "pip-audit": pip_audit_report,
    "npm-audit": npm_audit_report,
    "semgrep": semgrep_report,
    "trivy": trivy_report,
    "gitleaks": gitleaks_report,
}


def main():
    tool, path, version = sys.argv[1], sys.argv[2], sys.argv[3]
    counts, failed = PARSERS[tool](path)
    result = "FAIL" if failed else "PASS"

    header = "| Tool | Version | " + " | ".join(counts) + " | Result |"
    divider = "|" + "---|" * (len(counts) + 3)
    row = f"| {tool} | {version} | " + " | ".join(str(v) for v in counts.values())
    table = f"{header}\n{divider}\n{row} | **{result}** |\n"

    print(table)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as handle:
            handle.write(table + "\n")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
