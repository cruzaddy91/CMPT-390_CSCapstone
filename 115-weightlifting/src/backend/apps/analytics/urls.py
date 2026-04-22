from django.urls import path
from .views import RobiView, SinclairView

urlpatterns = [
    path('sinclair/', SinclairView.as_view(), name='sinclair'),
    path('robi/', RobiView.as_view(), name='robi'),
]
