# Recovery rehearsal (27 Oct 2026, AWS Academy lab, us-west-2)

The deployed release before the rehearsal was `9318d3f51309`. A copy of that release bundle was
changed so the API raises an error on import, given the release id `rehearsal-broken-2`,
uploaded to the release bucket and installed through the same SSM command the CD job uses.
Nothing was committed to the repository.

## Automatic recovery (deploy.sh)

SSM command `1b595c9f-9b67-42f5-9e07-3d0fad4c8014`, status **Failed** (what the CD job reports):

```text
== Ensure limited application database role
== Python environment
== Database migrations
== Switch to rehearsal-broken-2
== Health check failed for rehearsal-broken-2
== Rolling back to 9318d3f51309
== Previous release restored
```

Polling the public `/api/health` every 5 s during the command gave `502` nine times (about 45 s)
and then `200`. Afterwards `/api/health` returned `"release":"9318d3f51309"` and all 6 records
were still present, because the database is not touched by an application rollback. The
CloudWatch `AppHealthy` metric shows 0 at 09:52 and 09:53 UTC (`screenshots/cw-01-app-health.png`);
the alarm needs three failing minutes, so it stayed OK.

An earlier attempt (`658ccaa2-...`) failed before the switch because the re-packed bundle
contained macOS `._` metadata files that Alembic tried to load; the live release was not
affected. The bundle was rebuilt with `COPYFILE_DISABLE=1 tar --no-xattrs`.

## Manual recovery (rollback.sh)

| Step | SSM command | Result |
| --- | --- | --- |
| `rollback.sh` with no argument | `44a62c65-...` | rolled back from 9318d3f51309 to a844e1b77ec5 (last healthy release before it); healthy |
| `rollback.sh 9318d3f51309` | `30921301-...` | rolled forward to 9318d3f51309; healthy |

## Limitations

The switch happens before the health check, so a bad release causes up to about a minute of 502
responses before the rollback completes. Starting the new process on a second port and checking
it before switching Nginx would remove that gap. Rollback restores application code only; schema
changes must stay backwards compatible (migration 0005 keeps a server default so older code can
still insert faults).
