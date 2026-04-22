# 115 Weightlifting — simulation toolkit

Python-based tools for seeding demo data, simulating coach + athlete
workflows, and stress-testing the 115 Weightlifting API.

## Layout

```
tools/sim/
├── client.py       # Thin HTTP client wrapper around the API
├── themes.py       # Character-name pools (Game of Thrones, LOTR)
├── seed.py         # CLI: create a coach + N athletes
├── requirements.txt
└── README.md
```

## Setup

From the repository root:

```bash
cd 115-weightlifting/tools/sim
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

The backend must be running (`./bin/zw dev` from `115-weightlifting/`), and
`COACH_SIGNUP_CODE=test123` must be set in `src/backend/.env` (or pass a
matching value via `--coach-signup-code`).

## Seed a coach + athletes

```bash
# Default: Coachone + 5 Game of Thrones athletes
python seed.py

# Different coach, bigger roster, different theme
python seed.py --coach Coachtwo --athletes 12 --theme lord-of-the-rings

# Against a remote stage
python seed.py --api https://wl.example.com --coach-signup-code "$PROD_CODE"
```

All seeded users share the same password (default `Passw0rd!123`, override
with `--password`). Script is idempotent — re-running it logs into existing
users instead of creating duplicates.

After seeding, log in as the coach at `http://localhost:3000/login`. The
athletes will show up under the athlete-search box in the program editor
(scope=all). They'll move into the coach's personal roster (scope=mine) as
soon as programs are assigned to them.

## What's coming next

- `build_programs.py` — realistic weekly programs per athlete, using the
  xlsx-template schema
- `simulate_completion.py` — athletes "execute" programs, log actual
  results + PRs
- `stress_test.py` — parallel-client load harness (asyncio + aiohttp)
  to probe throttle limits, connection pool behavior, N+1 at scale

Each new entry point will live in this directory and reuse `client.py` +
`themes.py`.
