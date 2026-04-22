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


class CrossTenantAuthorizationTests(TestCase):
    """Every boundary the authz-probe tool exercises, pinned as a unit test.

    The probe runs against a live server; these tests keep the same
    invariants locked in CI so a regression on any of them fails the
    backend smoke rather than waiting for a manual probe run.
    """

    @classmethod
    def setUpTestData(cls):
        cls.coach_a = User.objects.create_user(
            username='coach_a', password='longenoughpw1', user_type='coach',
        )
        cls.coach_b = User.objects.create_user(
            username='coach_b', password='longenoughpw1', user_type='coach',
        )
        cls.athlete_x = User.objects.create_user(
            username='athlete_x', password='longenoughpw1', user_type='athlete',
        )
        cls.athlete_y = User.objects.create_user(
            username='athlete_y', password='longenoughpw1', user_type='athlete',
        )
        # coach_a coaches athlete_x via at least one program; coach_b has none.
        cls.program_ax = TrainingProgram.objects.create(
            coach=cls.coach_a, athlete=cls.athlete_x,
            name='Block AX', start_date=date(2026, 1, 1),
        )
        # Seed one workout log + one PR for athlete_x so GETs have content.
        WorkoutLog.objects.create(athlete=cls.athlete_x, date=date(2026, 4, 1), notes='')
        PersonalRecord.objects.create(
            athlete=cls.athlete_x, lift_type='snatch', weight=170, date=date(2026, 4, 1),
        )

    def _as(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    # -- Anonymous access ---------------------------------------------------

    def test_unauthenticated_requests_are_rejected(self):
        anon = APIClient()
        for path in [
            '/api/programs/',
            '/api/athletes/prs/',
            '/api/athletes/workouts/',
            f'/api/athletes/program-completion/{self.program_ax.id}/',
            '/api/auth/athletes/?scope=mine',
        ]:
            self.assertEqual(anon.get(path).status_code, 401, msg=path)

    # -- Cross-coach boundary ----------------------------------------------

    def test_coach_b_cannot_read_athlete_x_workouts(self):
        resp = self._as(self.coach_b).get(f'/api/athletes/workouts/?athlete_id={self.athlete_x.id}')
        self.assertEqual(resp.status_code, 403)

    def test_coach_b_cannot_read_athlete_x_prs(self):
        resp = self._as(self.coach_b).get(f'/api/athletes/prs/?athlete_id={self.athlete_x.id}')
        self.assertEqual(resp.status_code, 403)

    def test_coach_b_cannot_read_program_completion(self):
        resp = self._as(self.coach_b).get(f'/api/athletes/program-completion/{self.program_ax.id}/')
        self.assertEqual(resp.status_code, 403)

    def test_coach_b_cannot_patch_coach_a_program(self):
        resp = self._as(self.coach_b).patch(
            f'/api/programs/{self.program_ax.id}/',
            {'name': 'hijacked'}, format='json',
        )
        self.assertEqual(resp.status_code, 404)

    def test_coach_b_cannot_reassign_coach_a_program(self):
        resp = self._as(self.coach_b).patch(
            f'/api/programs/{self.program_ax.id}/assign/',
            {'athlete_id': self.athlete_y.id}, format='json',
        )
        self.assertEqual(resp.status_code, 404)

    # -- Cross-athlete boundary --------------------------------------------

    def test_athlete_y_cannot_read_athlete_x_completion(self):
        resp = self._as(self.athlete_y).get(f'/api/athletes/program-completion/{self.program_ax.id}/')
        self.assertEqual(resp.status_code, 403)

    def test_athlete_y_cannot_patch_athlete_x_completion(self):
        resp = self._as(self.athlete_y).patch(
            f'/api/athletes/program-completion/{self.program_ax.id}/',
            {'completion_data': {'entries': {'d0': {'0': {'completed': True}}}}},
            format='json',
        )
        self.assertEqual(resp.status_code, 404)

    def test_athlete_y_get_prs_does_not_leak_other_athletes_data(self):
        # The ?athlete_id= param is a coach affordance; if an athlete sends it,
        # the endpoint must still scope to the requester only.
        resp = self._as(self.athlete_y).get(f'/api/athletes/prs/?athlete_id={self.athlete_x.id}')
        self.assertEqual(resp.status_code, 200)
        for pr in resp.json():
            self.assertEqual(pr['athlete'], self.athlete_y.id)

    # -- Coach input validation --------------------------------------------

    def test_coach_missing_athlete_id_rejected(self):
        resp = self._as(self.coach_a).get('/api/athletes/workouts/')
        self.assertEqual(resp.status_code, 400)
        resp = self._as(self.coach_a).get('/api/athletes/prs/')
        self.assertEqual(resp.status_code, 400)

    def test_coach_malformed_athlete_id_rejected(self):
        resp = self._as(self.coach_a).get('/api/athletes/workouts/?athlete_id=notanumber')
        self.assertEqual(resp.status_code, 400)

    # -- Coach-a happy path (sanity check, not a boundary) -----------------

    def test_coach_a_can_read_their_own_athletes_data(self):
        c = self._as(self.coach_a)
        self.assertEqual(c.get(f'/api/athletes/workouts/?athlete_id={self.athlete_x.id}').status_code, 200)
        self.assertEqual(c.get(f'/api/athletes/prs/?athlete_id={self.athlete_x.id}').status_code, 200)
        self.assertEqual(c.get(f'/api/athletes/program-completion/{self.program_ax.id}/').status_code, 404)  # no completion yet
        # After the athlete logs one entry, the coach's GET succeeds.
        self._as(self.athlete_x).patch(
            f'/api/athletes/program-completion/{self.program_ax.id}/',
            {'completion_data': {'entries': {'d0': {'0': {'completed': True}}}}},
            format='json',
        )
        self.assertEqual(c.get(f'/api/athletes/program-completion/{self.program_ax.id}/').status_code, 200)
