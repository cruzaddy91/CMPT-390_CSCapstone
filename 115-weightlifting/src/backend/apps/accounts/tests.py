import os
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.weight_class import competitive_weight_class_label

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


class LogoutTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='logout_user', password='longenoughpw1', user_type='athlete'
        )
        self.client = APIClient()
        tokens = self.client.post(
            reverse('token_obtain_pair'),
            {'username': 'logout_user', 'password': 'longenoughpw1'},
            format='json',
        ).json()
        self.access = tokens['access']
        self.refresh = tokens['refresh']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access}')

    def test_logout_blacklists_refresh(self):
        response = self.client.post(reverse('logout'), {'refresh': self.refresh}, format='json')
        self.assertEqual(response.status_code, 205)

        replay = APIClient().post(
            reverse('token_refresh'), {'refresh': self.refresh}, format='json'
        )
        self.assertEqual(replay.status_code, 401)

    def test_logout_without_refresh_returns_400(self):
        self.client.cookies.clear()
        response = self.client.post(reverse('logout'), {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_logout_with_garbage_refresh_returns_400(self):
        self.client.cookies.clear()
        response = self.client.post(reverse('logout'), {'refresh': 'not-a-jwt'}, format='json')
        self.assertEqual(response.status_code, 400)


class RefreshCookieTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='cookie_user', password='longenoughpw1', user_type='athlete'
        )
        self.client = APIClient()

    def test_login_sets_httponly_refresh_cookie(self):
        response = self.client.post(
            reverse('token_obtain_pair'),
            {'username': 'cookie_user', 'password': 'longenoughpw1'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        cookie = response.cookies.get('wl_refresh')
        self.assertIsNotNone(cookie, 'expected wl_refresh cookie on login')
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['path'], '/api/auth/')

    def test_refresh_endpoint_accepts_cookie_only(self):
        login = self.client.post(
            reverse('token_obtain_pair'),
            {'username': 'cookie_user', 'password': 'longenoughpw1'},
            format='json',
        )
        self.client.cookies['wl_refresh'] = login.cookies['wl_refresh'].value

        response = self.client.post(reverse('token_refresh'), {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIsNotNone(response.cookies.get('wl_refresh'))

    def test_logout_accepts_cookie_only_and_clears_it(self):
        login = self.client.post(
            reverse('token_obtain_pair'),
            {'username': 'cookie_user', 'password': 'longenoughpw1'},
            format='json',
        )
        cookie_value = login.cookies['wl_refresh'].value
        self.client.cookies['wl_refresh'] = cookie_value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        response = self.client.post(reverse('logout'), {}, format='json')
        self.assertEqual(response.status_code, 205)
        cleared = response.cookies.get('wl_refresh')
        self.assertIsNotNone(cleared)
        self.assertEqual(cleared.value, '')


class AthleteListScopingTests(TestCase):
    def setUp(self):
        self.coach = User.objects.create_user(
            username='scope_coach', password='longenoughpw1', user_type='coach'
        )
        self.my_athlete = User.objects.create_user(
            username='my_athlete', password='longenoughpw1', user_type='athlete'
        )
        self.stranger = User.objects.create_user(
            username='stranger_athlete', password='longenoughpw1', user_type='athlete'
        )
        from datetime import date
        from apps.programs.models import TrainingProgram
        TrainingProgram.objects.create(
            coach=self.coach, athlete=self.my_athlete,
            name='scope block', start_date=date(2026, 1, 1),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.coach)

    def test_default_scope_mine_hides_unassigned_athletes(self):
        response = self.client.get(reverse('athlete-list'))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        usernames = {a['username'] for a in payload['results']}
        self.assertIn('my_athlete', usernames)
        self.assertNotIn('stranger_athlete', usernames)
        self.assertEqual(payload['scope'], 'mine')
        self.assertEqual(payload['page_size'], 50)

    def test_scope_all_returns_every_athlete(self):
        response = self.client.get(reverse('athlete-list'), {'scope': 'all'})
        payload = response.json()
        usernames = {a['username'] for a in payload['results']}
        self.assertIn('my_athlete', usernames)
        self.assertIn('stranger_athlete', usernames)

    def test_q_filter_narrows_results(self):
        response = self.client.get(reverse('athlete-list'), {'scope': 'all', 'q': 'stranger'})
        payload = response.json()
        self.assertEqual([a['username'] for a in payload['results']], ['stranger_athlete'])

    def test_athlete_cannot_list(self):
        self.client.force_authenticate(user=self.my_athlete)
        response = self.client.get(reverse('athlete-list'))
        self.assertEqual(response.status_code, 403)

    def test_athlete_list_includes_weight_class_fields(self):
        self.my_athlete.bodyweight_kg = Decimal('64.0')
        self.my_athlete.gender = 'F'
        self.my_athlete.save(update_fields=['bodyweight_kg', 'gender'])
        response = self.client.get(reverse('athlete-list'))
        self.assertEqual(response.status_code, 200)
        hit = next(a for a in response.json()['results'] if a['username'] == 'my_athlete')
        self.assertEqual(hit['bodyweight_kg'], 64.0)
        self.assertEqual(hit['gender'], 'F')
        self.assertEqual(hit['competitive_weight_class'], '71 kg')


class WeightClassLabelTests(TestCase):
    def test_men_superheavy(self):
        self.assertEqual(competitive_weight_class_label(Decimal('120'), 'M'), '+109 kg')

    def test_women_mid(self):
        self.assertEqual(competitive_weight_class_label(59, 'F'), '59 kg')

    def test_missing_gender(self):
        self.assertIsNone(competitive_weight_class_label(80, None))


class AthleteProfilePatchTests(TestCase):
    def setUp(self):
        self.athlete = User.objects.create_user(
            username='patch_athlete', password='longenoughpw1', user_type='athlete',
        )
        self.coach = User.objects.create_user(
            username='patch_coach', password='longenoughpw1', user_type='coach',
        )
        self.client = APIClient()

    def test_patch_me_updates_bodyweight(self):
        login = self.client.post(
            reverse('token_obtain_pair'),
            {'username': 'patch_athlete', 'password': 'longenoughpw1'},
            format='json',
        )
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")
        r = self.client.patch(
            reverse('current-user'),
            {'bodyweight_kg': '81.2', 'gender': 'M'},
            format='json',
        )
        self.assertEqual(r.status_code, 200, r.content)
        data = r.json()
        self.assertEqual(float(data['bodyweight_kg']), 81.2)
        self.assertEqual(data['gender'], 'M')
        self.assertEqual(data['competitive_weight_class'], '89 kg')

    def test_coach_patch_me_forbidden(self):
        login = self.client.post(
            reverse('token_obtain_pair'),
            {'username': 'patch_coach', 'password': 'longenoughpw1'},
            format='json',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")
        r = self.client.patch(reverse('current-user'), {'bodyweight_kg': '80'}, format='json')
        self.assertEqual(r.status_code, 403)
