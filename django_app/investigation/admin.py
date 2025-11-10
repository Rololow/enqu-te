from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Investigation, InvestigationMember, Entity, Link, Comment, Attachment, Tag


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'first_name', 'last_name', 'is_active', 'date_joined']
    list_filter = ['is_active', 'is_staff', 'date_joined']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering = ['-date_joined']
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Informations supplémentaires', {
            'fields': ('avatar',)
        }),
    )


@admin.register(Investigation)
class InvestigationAdmin(admin.ModelAdmin):
    list_display = ['title', 'code', 'created_by', 'created_at', 'is_active']
    list_filter = ['is_active', 'created_at']
    search_fields = ['title', 'code', 'description']
    readonly_fields = ['id', 'code', 'created_at', 'updated_at']
    ordering = ['-created_at']
    
    fieldsets = (
        ('Informations générales', {
            'fields': ('title', 'code', 'description', 'is_active')
        }),
        ('Métadonnées', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(InvestigationMember)
class InvestigationMemberAdmin(admin.ModelAdmin):
    list_display = ['investigation', 'user', 'role', 'joined_at']
    list_filter = ['role', 'joined_at']
    search_fields = ['investigation__title', 'user__username']
    ordering = ['-joined_at']


@admin.register(Entity)
class EntityAdmin(admin.ModelAdmin):
    list_display = ['title', 'entity_type', 'investigation', 'created_by', 'created_at', 'has_photo']
    list_filter = ['entity_type', 'created_at', 'evidence_type']
    search_fields = ['title', 'description', 'role', 'location']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']
    
    fieldsets = (
        ('Informations générales', {
            'fields': ('investigation', 'entity_type', 'title', 'description', 'photo')
        }),
        ('Champs spécifiques', {
            'fields': ('role', 'location', 'event_date', 'evidence_type'),
            'classes': ('collapse',)
        }),
        ('Métadonnées', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    @admin.display(description='Photo', boolean=True)
    def has_photo(self, obj):
        return bool(obj.photo)


@admin.register(Link)
class LinkAdmin(admin.ModelAdmin):
    list_display = ['title', 'from_entity', 'to_entity', 'investigation', 'created_by', 'created_at']
    list_filter = ['created_at']
    search_fields = ['title', 'description', 'from_entity__title', 'to_entity__title']
    readonly_fields = ['id', 'created_at']
    ordering = ['-created_at']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('investigation', 'from_entity', 'to_entity', 'created_by')


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['entity', 'author', 'created_at', 'content_short']
    list_filter = ['created_at']
    search_fields = ['content', 'entity__title', 'author__username']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']
    
    def content_short(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_short.short_description = 'Contenu'


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ['filename', 'entity', 'file_type', 'uploaded_by', 'uploaded_at']
    list_filter = ['file_type', 'uploaded_at']
    search_fields = ['filename', 'entity__title', 'uploaded_by__username']
    readonly_fields = ['id', 'uploaded_at']
    ordering = ['-uploaded_at']


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'investigation', 'created_at']
    list_filter = ['investigation']
    search_fields = ['name', 'investigation__title']
    ordering = ['name']