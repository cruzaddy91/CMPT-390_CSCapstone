# Contributing

## Working area

Primary application work happens in the `115 Weightlifting` app directory: `115-weightlifting/`.

## Local setup

```bash
cd 115-weightlifting
./bin/zw setup
```

## Validation before pushing

```bash
cd 115-weightlifting
./bin/zw doctor
./bin/zw test
./bin/zw uat
```

## Conventions

- Do not commit `.env` files or secrets.
- Use `./bin/zw` as the main operator interface.
- Keep generated runtime state under `var/` out of version control.
- Keep course deliverables under top-level `docs/` separate from application code.
