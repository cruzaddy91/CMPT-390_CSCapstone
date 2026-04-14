# CMPT-390 Capstone Workspace

This repository currently contains two separate concerns:

- `docs/` for course deliverables and submission artifacts
- `115-weightlifting/` for the actual `115 Weightlifting` application codebase

## Recommended GitHub posture

If you want the cleanest product-facing GitHub repository, publish the `115 Weightlifting` app as the standalone private application repo. The current local directory is `115-weightlifting/`.

If you keep this full workspace as the GitHub root, this README exists to make the structure explicit.

## Structure

- `docs/`
  Course assignments, deliverables, and final submission materials.
- `115-weightlifting/`
  The `115 Weightlifting` full-stack application, scripts, config, local hosting support, and operator CLI.

## Application Entry Point

```bash
cd 115-weightlifting
./bin/zw help
```

## Safe Local Validation

```bash
cd 115-weightlifting
./bin/zw doctor
./bin/zw test
./bin/zw uat
```
