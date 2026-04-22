from datetime import date

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from apps.athletes.models import ProgramCompletion
from .models import TrainingProgram

User = get_user_model()


class ProgramAssignPreservesHistoryTests(TestCase):
    """Reassigning a program to a new athlete must not wipe the prior athlete's logs."""

    def setUp(self):
        self.coach = User.objects.create_user(
            username='coach1', password='pw', user_type='coach'
        )
        self.athlete_a = User.objects.create_user(
            username='athlete_a', password='pw', user_type='athlete'
        )
        self.athlete_b = User.objects.create_user(
            username='athlete_b', password='pw', user_type='athlete'
        )
        self.program = TrainingProgram.objects.create(
            coach=self.coach,
            athlete=self.athlete_a,
            name='Block 1',
            start_date=date(2026, 1, 1),
        )
        ProgramCompletion.objects.create(
            program=self.program,
            athlete=self.athlete_a,
            completion_data={'sessions': [{'day': 'Monday', 'done': True}]},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.coach)

    def test_reassignment_preserves_prior_athletes_completion(self):
        url = reverse('program-assign', kwargs={'program_id': self.program.id})
        response = self.client.patch(url, {'athlete_id': self.athlete_b.id}, format='json')
        self.assertEqual(response.status_code, 200)

        self.program.refresh_from_db()
        self.assertEqual(self.program.athlete_id, self.athlete_b.id)

        prior_records = ProgramCompletion.objects.filter(
            program=self.program, athlete=self.athlete_a
        )
        self.assertEqual(prior_records.count(), 1, 'prior athletes history was destroyed')
        self.assertEqual(
            prior_records.first().completion_data['sessions'][0]['done'], True
        )

    def test_reassignment_allows_new_athlete_to_log_independently(self):
        url = reverse('program-assign', kwargs={'program_id': self.program.id})
        self.client.patch(url, {'athlete_id': self.athlete_b.id}, format='json')

        new_record = ProgramCompletion.objects.create(
            program=self.program,
            athlete=self.athlete_b,
            completion_data={'sessions': []},
        )
        self.assertEqual(
            ProgramCompletion.objects.filter(program=self.program).count(),
            2,
            'new athletes record should coexist with prior athletes history',
        )


class ProgramsListNPlusOneTests(TestCase):
    """Listing N programs must not issue O(N) SELECTs for completion records."""

    def setUp(self):
        self.coach = User.objects.create_user(
            username='np1_coach', password='pw', user_type='coach'
        )
        self.athletes = [
            User.objects.create_user(
                username=f'np1_athlete_{i}', password='pw', user_type='athlete'
            )
            for i in range(8)
        ]
        for i, athlete in enumerate(self.athletes):
            program = TrainingProgram.objects.create(
                coach=self.coach, athlete=athlete,
                name=f'Week {i}', start_date=date(2026, 1, 1),
            )
            ProgramCompletion.objects.create(
                program=program, athlete=athlete,
                completion_data={'entries': {'0': {'0': {'completed': True}}}},
            )
        self.client = APIClient()
        self.client.force_authenticate(user=self.coach)

    def test_programs_list_issues_constant_completion_queries(self):
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(reverse('program-list-create'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 8)
        self.assertTrue(
            all('completion_data' in item for item in response.data),
            'programs list response is missing completion_data',
        )
        queries_touching_completion = [
            q for q in ctx.captured_queries if 'programcompletion' in q['sql'].lower()
        ]
        self.assertLessEqual(
            len(queries_touching_completion),
            1,
            f'expected <=1 completion query via prefetch, got {len(queries_touching_completion)}',
        )


class ProgramDataDayIdTests(TestCase):
    """normalize_program_data preserves stable day ids so completion records
    survive day reorder/rename on the coach side."""

    def setUp(self):
        self.coach = User.objects.create_user(
            username='didcoach', password='pw', user_type='coach'
        )
        self.athlete = User.objects.create_user(
            username='didathlete', password='pw', user_type='athlete'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.coach)

    def test_day_id_round_trips_on_create(self):
        program_data = {
            'week_start_date': '2026-04-21',
            'days': [
                {'id': 'dabc123', 'day': 'Monday', 'exercises': []},
                {'id': 'dxyz789', 'day': 'Tuesday', 'exercises': []},
            ],
        }
        response = self.client.post(
            reverse('program-list-create'),
            {
                'name': 'Block 1',
                'description': '',
                'athlete_id': self.athlete.id,
                'start_date': '2026-04-21',
                'end_date': None,
                'program_data': program_data,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        days = response.data['program_data']['days']
        self.assertEqual([d['id'] for d in days], ['dabc123', 'dxyz789'])

    def test_backfills_deterministic_id_for_days_without_one(self):
        program_data = {
            'week_start_date': '2026-04-21',
            'days': [
                {'day': 'Monday', 'exercises': []},
                {'day': 'Tuesday', 'exercises': []},
            ],
        }
        response = self.client.post(
            reverse('program-list-create'),
            {
                'name': 'Legacy block',
                'description': '',
                'athlete_id': self.athlete.id,
                'start_date': '2026-04-21',
                'end_date': None,
                'program_data': program_data,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        days = response.data['program_data']['days']
        self.assertEqual([d['id'] for d in days], ['d0', 'd1'])


class SettingsHardeningTests(TestCase):
    """Prod boot should refuse insecure SECRET_KEY defaults."""

    def test_debug_parsing_case_insensitive(self):
        import importlib
        import os

        original_debug = os.environ.get('DEBUG')
        original_key = os.environ.get('SECRET_KEY')
        try:
            os.environ['DEBUG'] = 'TRUE'
            os.environ['SECRET_KEY'] = 'test-ok-key'
            from config import settings as s
            importlib.reload(s)
            self.assertTrue(s.DEBUG)

            os.environ['DEBUG'] = 'false'
            importlib.reload(s)
            self.assertFalse(s.DEBUG)
        finally:
            if original_debug is None:
                os.environ.pop('DEBUG', None)
            else:
                os.environ['DEBUG'] = original_debug
            if original_key is None:
                os.environ.pop('SECRET_KEY', None)
            else:
                os.environ['SECRET_KEY'] = original_key
            from config import settings as s
            importlib.reload(s)

    def test_insecure_key_refused_when_debug_false(self):
        import importlib
        import os

        original_debug = os.environ.get('DEBUG')
        original_key = os.environ.get('SECRET_KEY')
        try:
            os.environ['DEBUG'] = 'False'
            os.environ['SECRET_KEY'] = 'django-insecure-change-this-in-production'
            with self.assertRaises(RuntimeError):
                from config import settings as s
                importlib.reload(s)
        finally:
            if original_debug is None:
                os.environ.pop('DEBUG', None)
            else:
                os.environ['DEBUG'] = original_debug
            if original_key is None:
                os.environ.pop('SECRET_KEY', None)
            else:
                os.environ['SECRET_KEY'] = original_key
            from config import settings as s
            importlib.reload(s)
