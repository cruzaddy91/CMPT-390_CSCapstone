import os
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

User = get_user_model()


class CoachRegistrationGateTests(TestCase):
    url = reverse('register')

    def setUp(self):
        self.client = APIClient()

    def test_coach_signup_rejected_without_env_configured(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('COACH_SIGNUP_CODE', None)
            response = self.client.post(
                self.url,
                {'username': 'u1', 'password': 'longenoughpw1', 'user_type': 'coach'},
                format='json',
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn('user_type', response.json())

    def test_coach_signup_rejected_with_wrong_code(self):
        with mock.patch.dict(os.environ, {'COACH_SIGNUP_CODE': 'secret-2026'}):
            response = self.client.post(
                self.url,
                {
                    'username': 'u2',
                    'password': 'longenoughpw1',
                    'user_type': 'coach',
                    'coach_signup_code': 'nope',
                },
                format='json',
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn('coach_signup_code', response.json())
        self.assertFalse(User.objects.filter(username='u2').exists())

    def test_coach_signup_succeeds_with_correct_code(self):
        with mock.patch.dict(os.environ, {'COACH_SIGNUP_CODE': 'secret-2026'}):
            response = self.client.post(
                self.url,
                {
                    'username': 'u3',
                    'password': 'longenoughpw1',
                    'user_type': 'coach',
                    'coach_signup_code': 'secret-2026',
                },
                format='json',
            )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username='u3', user_type='coach').exists())

    def test_athlete_signup_never_requires_code(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('COACH_SIGNUP_CODE', None)
            response = self.client.post(
                self.url,
                {'username': 'a1', 'password': 'longenoughpw1', 'user_type': 'athlete'},
                format='json',
            )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username='a1', user_type='athlete').exists())


class RefreshTokenBlacklistTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='blacklist_user', password='longenoughpw1', user_type='athlete'
        )
        self.client = APIClient()

    def test_old_refresh_token_rejected_after_rotation(self):
        login = self.client.post(
            reverse('token_obtain_pair'),
            {'username': 'blacklist_user', 'password': 'longenoughpw1'},
            format='json',
        )
        self.assertEqual(login.status_code, 200)
        original_refresh = login.json()['refresh']

        first = self.client.post(
            reverse('token_refresh'), {'refresh': original_refresh}, format='json'
        )
        self.assertEqual(first.status_code, 200)

        replay = self.client.post(
            reverse('token_refresh'), {'refresh': original_refresh}, format='json'
        )
        self.assertEqual(
            replay.status_code,
            401,
            f'expected 401 on blacklisted refresh, got {replay.status_code}: {replay.content}',
        )
