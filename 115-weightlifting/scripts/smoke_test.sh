#!/bin/bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

ensure_backend_venv
ensure_backend_env

smoke_json="$(backend_manage shell <<'PY'
import json
from datetime import date
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.athletes.models import ProgramCompletion
from apps.programs.models import TrainingProgram

if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

User = get_user_model()
coach, _ = User.objects.get_or_create(username='coach_smoke', defaults={'user_type': 'coach'})
coach.user_type = 'coach'
coach.set_password('DemoPass123!')
coach.save()

athlete, _ = User.objects.get_or_create(username='athlete_smoke', defaults={'user_type': 'athlete'})
athlete.user_type = 'athlete'
athlete.set_password('DemoPass123!')
athlete.save()

athlete_b, _ = User.objects.get_or_create(username='athlete_smoke_b', defaults={'user_type': 'athlete'})
athlete_b.user_type = 'athlete'
athlete_b.set_password('DemoPass123!')
athlete_b.save()

program_payload = {
    'name': 'Smoke Test Week',
    'description': 'Structured program created by CLI smoke test.',
    'athlete_id': athlete.id,
    'start_date': str(date.today()),
    'end_date': None,
    'program_data': {
        'week_start_date': str(date.today()),
        'days': [
            {
                'day': 'Monday',
                'exercises': [
                    {
                        'name': 'Snatch',
                        'sets': '5',
                        'reps': '2',
                        'intensity': '75%',
                        'notes': 'Fast turnover',
                    }
                ],
            }
        ],
    },
}

coach_client = APIClient()
coach_login = coach_client.post('/api/auth/token/', {'username': 'coach_smoke', 'password': 'DemoPass123!'}, format='json')
assert coach_login.status_code == 200, coach_login.content
coach_tokens = coach_login.json()
assert 'access' in coach_tokens and 'refresh' in coach_tokens, f"expected access+refresh, got {coach_tokens}"
coach_client.credentials(HTTP_AUTHORIZATION=f"Bearer {coach_tokens['access']}")

unauth_client = APIClient()
anon_me = unauth_client.get('/api/auth/me/')
assert anon_me.status_code == 401, f"unauth /me should be 401, got {anon_me.status_code}"

import os as _os
_prev_coach_code = _os.environ.pop('COACH_SIGNUP_CODE', None)
try:
    open_coach_reg = APIClient().post(
        '/api/auth/register/',
        {'username': 'open_coach_attempt', 'password': 'longenoughpw1', 'user_type': 'coach'},
        format='json',
    )
    assert open_coach_reg.status_code == 400, (
        f'coach signup without env code should 400, got {open_coach_reg.status_code}'
    )
    assert not User.objects.filter(username='open_coach_attempt').exists(), (
        'blocked coach signup still created a user'
    )
finally:
    if _prev_coach_code is not None:
        _os.environ['COACH_SIGNUP_CODE'] = _prev_coach_code

refresh_response = APIClient().post(
    '/api/auth/token/refresh/', {'refresh': coach_tokens['refresh']}, format='json'
)
assert refresh_response.status_code == 200, refresh_response.content
refreshed_access = refresh_response.json()['access']
assert refreshed_access and refreshed_access != coach_tokens['access'], 'refresh did not rotate access token'
rotated_client = APIClient()
rotated_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed_access}")
rotated_me = rotated_client.get('/api/auth/me/')
assert rotated_me.status_code == 200, rotated_me.content

replay_refresh = APIClient().post(
    '/api/auth/token/refresh/', {'refresh': coach_tokens['refresh']}, format='json'
)
assert replay_refresh.status_code == 401, (
    f'blacklisted refresh should 401, got {replay_refresh.status_code}: {replay_refresh.content}'
)

me_response = coach_client.get('/api/auth/me/')
assert me_response.status_code == 200, me_response.content

create_program_response = coach_client.post('/api/programs/', program_payload, format='json')
assert create_program_response.status_code == 201, create_program_response.content
program_id = create_program_response.json()['id']

athlete_client = APIClient()
athlete_login = athlete_client.post('/api/auth/token/', {'username': 'athlete_smoke', 'password': 'DemoPass123!'}, format='json')
assert athlete_login.status_code == 200, athlete_login.content
athlete_client.credentials(HTTP_AUTHORIZATION=f"Bearer {athlete_login.json()['access']}")

completion_patch = athlete_client.patch(
    f'/api/athletes/program-completion/{program_id}/',
    {
        'completion_data': {
            'entries': {
                '0': {
                    '0': {
                        'completed': True,
                        'athlete_notes': 'CLI smoke test',
                        'result': '75x2',
                    }
                }
            }
        }
    },
    format='json',
)
assert completion_patch.status_code == 200, completion_patch.content

pr_response = athlete_client.post(
    '/api/athletes/prs/',
    {'lift_type': 'snatch', 'weight': '80.0', 'date': str(date.today())},
    format='json',
)
assert pr_response.status_code == 201, pr_response.content

sinclair_response = athlete_client.post(
    '/api/analytics/sinclair/',
    {'bodyweight_kg': 81.0, 'total_kg': 285.0, 'gender': 'M'},
    format='json',
)
assert sinclair_response.status_code == 200, sinclair_response.content

completion_count_before = ProgramCompletion.objects.filter(program_id=program_id).count()
assert completion_count_before >= 1, 'expected at least 1 completion record before reassignment'

athlete_c_username = f'athlete_smoke_readonly_{program_id}'
athlete_c, _ = User.objects.get_or_create(username=athlete_c_username, defaults={'user_type': 'athlete'})
athlete_c.user_type = 'athlete'
athlete_c.set_password('DemoPass123!')
athlete_c.save()
readonly_program = TrainingProgram.objects.create(
    coach=coach, athlete=athlete_c, name='RO Smoke', start_date=date.today(),
)
ro_client = APIClient()
ro_login = ro_client.post(
    '/api/auth/token/',
    {'username': athlete_c_username, 'password': 'DemoPass123!'},
    format='json',
)
ro_client.credentials(HTTP_AUTHORIZATION=f"Bearer {ro_login.json()['access']}")

ro_before = ProgramCompletion.objects.filter(program=readonly_program).count()
ro_get = ro_client.get(f'/api/athletes/program-completion/{readonly_program.id}/')
assert ro_get.status_code == 404, (
    f'GET on missing completion should 404, got {ro_get.status_code}'
)
ro_after = ProgramCompletion.objects.filter(program=readonly_program).count()
assert ro_after == ro_before, f'GET mutated DB: {ro_before} -> {ro_after}'

reassign_response = coach_client.patch(
    f'/api/programs/{program_id}/assign/',
    {'athlete_id': athlete_b.id},
    format='json',
)
assert reassign_response.status_code == 200, reassign_response.content
assert reassign_response.json()['athlete_id'] == athlete_b.id, 'athlete swap did not persist'

prior_records = ProgramCompletion.objects.filter(program_id=program_id, athlete=athlete)
assert prior_records.count() == completion_count_before, (
    f'prior athlete history lost: before={completion_count_before}, after={prior_records.count()}'
)

print(json.dumps({
    'program_id': program_id,
    'sinclair': sinclair_response.json(),
    'coach_program_count': TrainingProgram.objects.filter(coach=coach).count(),
    'refresh_rotated': True,
    'refresh_blacklist_enforced': replay_refresh.status_code == 401,
    'unauth_me_status': anon_me.status_code,
    'reassignment_preserved_completions': prior_records.count(),
    'coach_signup_gated': open_coach_reg.status_code == 400,
    'completion_get_is_readonly': ro_get.status_code == 404 and ro_after == ro_before,
}))
PY
)"
smoke_json="$(printf '%s\n' "$smoke_json" | tail -n 1)"

echo "$smoke_json"
log_event "smoke" "success" "smoke_test.sh" "$smoke_json"
"$ROOT_DIR/scripts/report.sh" >/dev/null
