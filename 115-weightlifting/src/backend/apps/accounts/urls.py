from django.urls import path
from .views import (
    AthleteListView,
    CurrentUserView,
    LogoutView,
    RegisterView,
    TokenObtainPairViewAllowAny,
    TokenRefreshViewAllowAny,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('token/', TokenObtainPairViewAllowAny.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshViewAllowAny.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('athletes/', AthleteListView.as_view(), name='athlete-list'),
]
