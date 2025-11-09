from django.urls import path
from .views import (
    api_entities, api_entity_detail, api_links, api_investigation_members,
    api_entity_links, api_investigation_presence, api_investigation_presence_heartbeat,
    api_investigation_delete, api_investigation_revoke_member
)

urlpatterns = [
    path('investigation/<uuid:investigation_id>/entities/', api_entities, name='api_entities'),
    path('investigation/<uuid:investigation_id>/entity/<uuid:entity_id>/', api_entity_detail, name='api_entity_detail'),
    path('investigation/<uuid:investigation_id>/links/', api_links, name='api_links'),
    path('investigation/<uuid:investigation_id>/members/', api_investigation_members, name='api_investigation_members'),
    path('investigation/<uuid:investigation_id>/presence/', api_investigation_presence, name='api_investigation_presence'),
    path('investigation/<uuid:investigation_id>/presence/heartbeat/', api_investigation_presence_heartbeat, name='api_investigation_presence_heartbeat'),
    path('investigation/<uuid:investigation_id>/members/<int:user_id>/revoke/', api_investigation_revoke_member, name='api_investigation_revoke_member'),
    path('investigation/<uuid:investigation_id>/delete/', api_investigation_delete, name='api_investigation_delete'),
    path('investigation/<uuid:investigation_id>/entity/<uuid:entity_id>/links/', api_entity_links, name='api_entity_links'),
]