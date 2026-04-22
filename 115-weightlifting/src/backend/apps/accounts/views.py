from rest_framework import status
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings as dj_settings
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .serializers import CurrentUserSerializer, RegisterSerializer


REFRESH_COOKIE_NAME = 'wl_refresh'
REFRESH_COOKIE_PATH = '/api/auth/'


def _refresh_cookie_kwargs():
    secure = not dj_settings.DEBUG
    return {
        'httponly': True,
        'secure': secure,
        'samesite': 'Lax',
        'path': REFRESH_COOKIE_PATH,
        'max_age': int(dj_settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
    }


def _set_refresh_cookie(response, refresh_token):
    response.set_cookie(REFRESH_COOKIE_NAME, refresh_token, **_refresh_cookie_kwargs())


def _clear_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'

User = get_user_model()


class TokenObtainPairViewAllowAny(TokenObtainPairView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200 and 'refresh' in response.data:
            _set_refresh_cookie(response, response.data['refresh'])
        return response


class TokenRefreshViewAllowAny(TokenRefreshView):
    """Accepts the refresh token from request body OR from the httpOnly cookie.

    On successful rotation the new refresh token is written back to the cookie,
    so clients that use cookie-only auth never expose the refresh token to JS.
    """

    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        if not request.data.get('refresh'):
            cookie_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME)
            if cookie_refresh:
                mutable = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
                mutable['refresh'] = cookie_refresh
                request._full_data = mutable
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200 and 'refresh' in response.data:
            _set_refresh_cookie(response, response.data['refresh'])
        return response


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'message': 'User created. Use /api/auth/token/ to log in.'},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(APIView):
    def get(self, request):
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Blacklist the supplied refresh token so it cannot be reused.

    Accepts the refresh token in the request body OR the httpOnly cookie.
    Always clears the cookie on exit, even on failure, so a stale cookie
    cannot keep trying to resurrect a session.
    """

    def post(self, request):
        refresh = request.data.get('refresh') or request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not refresh:
            response = Response(
                {'refresh': ['This field is required.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
            _clear_refresh_cookie(response)
            return response
        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            response = Response(
                {'refresh': ['Invalid or already-expired refresh token.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
            _clear_refresh_cookie(response)
            return response
        response = Response(status=status.HTTP_205_RESET_CONTENT)
        _clear_refresh_cookie(response)
        return response


class AthleteListView(APIView):
    """List athlete users for coach assignment UI.

    Defaults to athletes already programmed-for by this coach.
    Pass `?scope=all` to browse the full pool; `?q=<text>` filters by username.
    Results are always paginated to prevent unbounded leakage.
    """

    PAGE_SIZE = 50

    def get(self, request):
        if request.user.user_type != 'coach':
            return Response({'detail': 'Only coaches can list athletes.'}, status=status.HTTP_403_FORBIDDEN)

        from apps.programs.models import TrainingProgram

        scope = request.query_params.get('scope', 'mine').lower()
        query = (request.query_params.get('q') or '').strip()
        try:
            page = max(1, int(request.query_params.get('page', '1')))
        except ValueError:
            page = 1

        base = User.objects.filter(user_type='athlete')
        if scope != 'all':
            coached_ids = TrainingProgram.objects.filter(coach=request.user).values_list(
                'athlete_id', flat=True
            ).distinct()
            base = base.filter(id__in=list(coached_ids))

        if query:
            base = base.filter(username__icontains=query)

        total = base.count()
        offset = (page - 1) * self.PAGE_SIZE
        athletes = list(
            base.order_by('username').values('id', 'username')[offset:offset + self.PAGE_SIZE]
        )
        return Response(
            {
                'results': athletes,
                'count': total,
                'page': page,
                'page_size': self.PAGE_SIZE,
                'scope': 'mine' if scope != 'all' else 'all',
            },
            status=status.HTTP_200_OK,
        )
