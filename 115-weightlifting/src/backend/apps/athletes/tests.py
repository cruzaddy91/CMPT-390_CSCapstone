from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.athletes.models import PersonalRecord, ProgramCompletion, WorkoutLog
from apps.programs.models import TrainingProgram

User = get_user_model()


class ProgramCompletionGetIsReadOnlyTests(TestCase):
    """GET must not upsert rows; only PATCH should."""

    def setUp(self):
        self.coach = User.objects.create_user(
            username='c_ro', password='longenoughpw1', user_type='coach'
        )
        self.athlete = User.objects.create_user(
            username='a_ro', password='longenoughpw1', user_type='athlete'
        )
        self.program = TrainingProgram.objects.create(
            coach=self.coach, athlete=self.athlete,
            name='RO Block', start_date=date(2026, 1, 1),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.athlete)
        self.url = reverse('program-completion-detail', kwargs={'program_id': self.program.id})

    def test_get_without_existing_record_returns_404_and_does_not_create(self):
        self.assertEqual(
            ProgramCompletion.objects.filter(program=self.program).count(), 0
        )
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            ProgramCompletion.objects.filter(program=self.program).count(),
            0,
            'GET silently created a ProgramCompletion row',
        )

    def test_patch_upserts_and_get_then_returns_200(self):
        patch_response = self.client.patch(
            self.url,
            {'completion_data': {'entries': {'0': {'0': {'completed': True}}}}},
            format='json',
        )
        self.assertEqual(patch_response.status_code, 200)

        get_response = self.client.get(self.url)
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(
            get_response.json()['completion_data']['entries']['0']['0']['completed'],
            True,
        )
        self.assertEqual(
            ProgramCompletion.objects.filter(program=self.program).count(), 1
        )

    def test_repeated_gets_do_not_mutate_row_count(self):
        self.client.patch(
            self.url,
            {'completion_data': {'entries': {}}},
            format='json',
        )
        for _ in range(5):
            self.client.get(self.url)
        self.assertEqual(
            ProgramCompletion.objects.filter(program=self.program).count(), 1
        )


class PersonalRecordValidationTests(TestCase):
    def setUp(self):
        self.athlete = User.objects.create_user(
            username='pr_athlete', password='longenoughpw1', user_type='athlete'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.athlete)
        self.url = reverse('personal-record-list-create')

    def _payload(self, **overrides):
        base = {'lift_type': 'snatch', 'weight': '120.0', 'date': str(date.today())}
        base.update(overrides)
        return base

    def test_valid_pr_accepted(self):
        response = self.client.post(self.url, self._payload(), format='json')
        self.assertEqual(response.status_code, 201)

    def test_future_date_rejected(self):
        future = (date.today() + timedelta(days=1)).isoformat()
        response = self.client.post(self.url, self._payload(date=future), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('date', response.json())
        self.assertEqual(PersonalRecord.objects.count(), 0)

    def test_zero_weight_rejected(self):
        response = self.client.post(self.url, self._payload(weight='0'), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('weight', response.json())

    def test_absurd_weight_rejected(self):
        response = self.client.post(self.url, self._payload(weight='999'), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('weight', response.json())
        self.assertEqual(PersonalRecord.objects.count(), 0)

    def test_ancient_date_rejected(self):
        response = self.client.post(
            self.url, self._payload(date='1999-12-31'), format='json'
        )
        self.assertEqual(response.status_code, 400)


class WorkoutLogValidationTests(TestCase):
    def setUp(self):
        self.athlete = User.objects.create_user(
            username='wl_athlete', password='longenoughpw1', user_type='athlete'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.athlete)
        self.url = reverse('workout-log-list-create')

    def test_future_dated_workout_rejected(self):
        future = (date.today() + timedelta(days=2)).isoformat()
        response = self.client.post(
            self.url, {'date': future, 'notes': 'bad date'}, format='json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(WorkoutLog.objects.count(), 0)
