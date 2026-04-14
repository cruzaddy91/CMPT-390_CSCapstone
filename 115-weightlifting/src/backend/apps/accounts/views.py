from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model
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


class AthleteListView(APIView):
    """List athlete users for coach assignment UI."""

    def get(self, request):
        if request.user.user_type != 'coach':
            return Response({'detail': 'Only coaches can list athletes.'}, status=status.HTTP_403_FORBIDDEN)

        athletes = User.objects.filter(user_type='athlete').order_by('username').values('id', 'username')
        return Response(list(athletes), status=status.HTTP_200_OK)
