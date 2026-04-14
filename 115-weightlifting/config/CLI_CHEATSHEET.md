# CLI Cheat Sheet

Quick reference for operating the `115 Weightlifting` app from the terminal. The local app directory is `115-weightlifting/`.

## Start Here

```bash
cd /Users/addycruz/Workspace/CMPT-390_CSCapstone/115-weightlifting
./bin/zw help
```

## Core Project Control

```bash
./bin/zw setup
./bin/zw doctor
./bin/zw doctor --json
./bin/zw status
./bin/zw test
./bin/zw uat
./bin/zw release
./bin/zw report
```

Report outputs:

```text
var/reports/REPORT.md
var/reports/index.html
var/reports/app_snapshot.json
var/reports/UAT_REPORT.md
var/reports/uat_latest.json
var/reports/events/
```

## Local Run Modes

```bash
./bin/zw dev
./bin/zw host-local foreground
./bin/zw host-local start
./bin/zw host-local status
./bin/zw host-local stop
./bin/zw logs
```

## Demo Data

```bash
./bin/zw seed-demo
./bin/zw reset-demo
./bin/zw reset-demo --yes
./bin/zw make-demo
./bin/zw smoke
```

Demo credentials:

```text
coach_smoke   / DemoPass123!
athlete_smoke / DemoPass123!
```

## Data Safety

```bash
./bin/zw backup
./bin/zw export-data
./bin/zw export-data var/backups/custom_export.json
./bin/zw import-data var/backups/export_YYYYMMDD_HHMMSS.json --yes
./bin/zw restore --sqlite var/backups/db_YYYYMMDD_HHMMSS.sqlite3 --yes
./bin/zw restore --fixture var/backups/data_YYYYMMDD_HHMMSS.json --yes
```

## Cleanup

Preview:

```bash
./bin/zw clean
```

Apply:

```bash
./bin/zw clean --yes
```

Deep clean including `node_modules`:

```bash
./bin/zw clean --deep --yes
```

## Public Hosting Prep

```bash
./bin/zw prepare-public
```

Related files:

```text
config/self_hosting.md
config/self_hosting/Caddyfile.example
config/self_hosting/backend.env.production.example
config/self_hosting/frontend.env.production.example
config/self_hosting/weightlifting-backend.service
```

## Practical Sequences

### Fresh machine

```bash
./bin/zw setup
./bin/zw doctor
./bin/zw make-demo
./bin/zw host-local foreground
```

### Before a demo

```bash
./bin/zw doctor
./bin/zw reset-demo --yes
./bin/zw make-demo
./bin/zw smoke
./bin/zw host-local foreground
```

### Before deployment work

```bash
./bin/zw backup
./bin/zw test
./bin/zw release
./bin/zw prepare-public
```
