from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .serializers import CurrentUserSerializer, RegisterSerializer

User = get_user_model()


class TokenObtainPairViewAllowAny(TokenObtainPairView):
    permission_classes = [AllowAny]


class TokenRefreshViewAllowAny(TokenRefreshView):
    permission_classes = [AllowAny]


class RegisterView(APIView):
    permission_classes = [AllowAny]

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
    """Blacklist the supplied refresh token so it cannot be reused."""

    def post(self, request):
        refresh = request.data.get('refresh')
        if not refresh:
            return Response({'refresh': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            return Response({'refresh': ['Invalid or already-expired refresh token.']}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_205_RESET_CONTENT)


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
