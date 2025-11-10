from django.urls import path
from .views import (
    AuthView, home, dashboard, investigation_detail, create_investigation, join_investigation,
    investigation_timeline, investigation_graphe, investigation_fiches
)

urlpatterns = [
    path('', home, name='home'),
    path('auth/<str:action>/', AuthView.as_view(), name='auth'),
    path('dashboard/', dashboard, name='dashboard'),
    path('investigation/create/', create_investigation, name='create_investigation'),
    path('investigation/join/', join_investigation, name='join_investigation'),
    path('investigation/<uuid:investigation_id>/', investigation_detail, name='investigation_detail'),
    path('investigation/<uuid:investigation_id>/timeline/', investigation_timeline, name='investigation_timeline'),
    path('investigation/<uuid:investigation_id>/graphe/', investigation_graphe, name='investigation_graphe'),
    path('investigation/<uuid:investigation_id>/fiches/', investigation_fiches, name='investigation_fiches'),
]