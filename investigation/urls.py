from django.urls import path
from .views import AuthView, home, dashboard, investigation_detail, create_investigation, join_investigation

urlpatterns = [
    path('', home, name='home'),
    path('auth/<str:action>/', AuthView.as_view(), name='auth'),
    path('dashboard/', dashboard, name='dashboard'),
    path('investigation/create/', create_investigation, name='create_investigation'),
    path('investigation/join/', join_investigation, name='join_investigation'),
    path('investigation/<uuid:investigation_id>/', investigation_detail, name='investigation_detail'),
]