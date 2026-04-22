from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.athletes.models import ProgramCompletion
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
