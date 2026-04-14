# 115 Weightlifting

A full-stack web application for Olympic weightlifting coaches and athletes to manage structured training plans, log completion, track PR history, and calculate Sinclair scores.

## Project CLI

The app repo is now controlled through a single terminal entrypoint:

```bash
cd 115-weightlifting
./bin/zw help
```

The product name is `115 Weightlifting`. The local directory is `115-weightlifting/`.

Core commands:

- `./bin/zw setup`
- `./bin/zw doctor`
- `./bin/zw clean`
- `./bin/zw status`
- `./bin/zw migrate`
- `./bin/zw seed-demo`
- `./bin/zw reset-demo`
- `./bin/zw make-demo`
- `./bin/zw dev`
- `./bin/zw host-local start`
- `./bin/zw host-local stop`
- `./bin/zw host-local status`
- `./bin/zw logs`
- `./bin/zw backup`
- `./bin/zw export-data`
- `./bin/zw import-data <fixture.json> --yes`
- `./bin/zw restore --sqlite <backup.sqlite3> --yes`
- `./bin/zw report`
- `./bin/zw smoke`
- `./bin/zw test`
- `./bin/zw uat`
- `./bin/zw release`
- `./bin/zw prepare-public`

Report artifacts:

- `var/reports/REPORT.md`
- `var/reports/index.html`
- `var/reports/app_snapshot.json`
- `var/reports/UAT_REPORT.md`
- `var/reports/uat_latest.json`
- `var/reports/events/*.json`

Safe defaults:

- `./bin/zw clean` is preview-only unless you add `--yes`
- `./bin/zw reset-demo` is preview-only unless you add `--yes`

Quick reference:

- `config/CLI_CHEATSHEET.md`

## Current Feature Set

- JWT authentication with role-aware routing for `coach` and `athlete`
- Structured weekly training programs stored as JSON on each assigned program
- Coach dashboard for creating, editing, and reassigning weekly plans
- Athlete dashboard for completing prescribed exercises, adding logs, tracking PRs, and viewing charts
- Sinclair score API and frontend calculator
- Django REST backend with SQLite-by-default and PostgreSQL-ready production settings

## Tech Stack

- Frontend: React with Vite, React Router, Chart.js
- Backend: Django REST Framework with SimpleJWT
- Database: SQLite locally, PostgreSQL in production
- Data science logic: Python Sinclair calculator reused in the backend analytics layer

## Project Structure

```text
115-weightlifting/   # current local directory name for 115 Weightlifting
├── src/
│   ├── frontend/           # React frontend application
│   ├── backend/            # Django REST API
│   ├── data-science/       # Python analytics scripts
│   └── infrastructure/     # Hosting config (Netlify)
├── docs/                   # App docs only
├── config/                 # Deployment notes
└── assets/                 # Static assets
```

Capstone turn-in documents live in the parent repo under `CMPT-390_CSCapstone/docs/`.

## Local Setup

### Frontend

```bash
cd 115-weightlifting/src/frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:3000`.

### Backend

```bash
cd 115-weightlifting/src/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

Backend runs on `http://localhost:8000`.

## Local Hosting

For a simple self-hosted local stack without Netlify:

```bash
cd 115-weightlifting
./bin/zw seed-demo
./bin/zw host-local start
```

This launches:

- frontend preview on `http://localhost:4173`
- backend on `http://localhost:8000`

See `config/self_hosting.md` for both local and public self-hosting plans.

## Main API Endpoints

- `POST /api/auth/register/`
- `POST /api/auth/token/`
- `GET /api/auth/me/`
- `GET|POST /api/programs/`
- `PATCH /api/programs/<id>/`
- `PATCH /api/programs/<id>/assign/`
- `GET|PATCH /api/athletes/program-completion/<program_id>/`
- `GET|POST /api/athletes/workouts/`
- `GET|POST /api/athletes/prs/`
- `POST /api/analytics/sinclair/`

## Environment Variables

### Frontend

```text
VITE_API_BASE_URL=http://localhost:8000
```

### Backend

```text
SECRET_KEY=change-me
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

See `config/deployment.md` for hosting details.
See `config/self_hosting.md` for local and public self-hosting guidance.
