from django.urls import path
from .views import SinclairView

urlpatterns = [
    path('sinclair/', SinclairView.as_view(), name='sinclair'),
]
