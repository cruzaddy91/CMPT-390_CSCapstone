# Computer Science Capstone (CMPT-390)

Full-stack capstone workspace: course deliverables plus the **115 Weightlifting** coach and athlete platform.

## Repository layout

| Path | Purpose |
|------|---------|
| `docs/` | Assignments, proposals, reports, presentations, transcripts, and final submission artifacts |
| `115-weightlifting/` | Application source: Django backend, React (Vite) frontend, operator CLI (`zw`), scripts, and deployment docs |

## Product overview

**115 Weightlifting** is a web application for Olympic weightlifting coaches and athletes: structured training plans, completion logging, PR history, and Sinclair-related analytics. The runnable system lives under `115-weightlifting/`; this repository root keeps coursework and the app in one place for the capstone.

## Stack (at a glance)

| Layer | Technology |
|-------|------------|
| Backend | Django REST-style API, SQLite-oriented local workflow |
| Frontend | React with Vite |
| Operations | Shell/Python tooling, `bin/zw` CLI, CI via `.github/workflows` |

## Canonical entry point

All routine developer and operator tasks go through the **`zw`** CLI:

```bash
cd 115-weightlifting
./bin/zw help
```

## Key paths

| Path | Purpose |
|------|---------|
| `115-weightlifting/bin/zw` | Primary CLI entrypoint |
| `115-weightlifting/src/backend/` | Django project and apps |
| `115-weightlifting/src/frontend/` | React application |
| `115-weightlifting/scripts/` | Build, demo, backup, test, and release helpers |
| `115-weightlifting/config/` | Deployment and self-hosting notes |
| `docs/deliverables/` | Submitted course materials |
| `.github/workflows/ci.yml` | Continuous integration |

## Quick start

```bash
cd 115-weightlifting
./bin/zw setup
./bin/zw doctor
./bin/zw dev
```

Use `./bin/zw help` for the full command list (migrate, seed, demo, host-local, release, etc.).

## Local validation

```bash
cd 115-weightlifting
./bin/zw doctor
./bin/zw test
./bin/zw uat
```

## Project structure

```text
CMPT-390_CSCapstone/
├── .github/
├── docs/
│   ├── assignments/
│   ├── deliverables/
│   └── final_deliverables/
├── 115-weightlifting/
│   ├── bin/
│   ├── config/
│   ├── docs/
│   ├── scripts/
│   └── src/
│       ├── backend/
│       ├── frontend/
│       ├── data-science/
│       └── infrastructure/
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── SECURITY.md
```

## License

MIT — see [LICENSE](LICENSE).
