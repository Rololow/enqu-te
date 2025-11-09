from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import uuid


class User(AbstractUser):
    """Custom user model with additional fields"""
    email = models.EmailField(unique=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return self.username


class Investigation(models.Model):
    """Investigation model"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=8, unique=True, db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_investigations')
    members = models.ManyToManyField(User, through='InvestigationMember', related_name='investigations')
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} ({self.code})"
    
    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self.generate_code()
        super().save(*args, **kwargs)
    
    def generate_code(self):
        import random
        import string
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


class InvestigationMember(models.Model):
    """Membership model for investigation participants"""
    ROLE_CHOICES = [
        ('owner', 'Propriétaire'),
        ('admin', 'Administrateur'),
        ('member', 'Membre'),
        ('viewer', 'Observateur'),
    ]
    
    investigation = models.ForeignKey(Investigation, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(default=timezone.now)
    # Last seen timestamp for presence indication (updated by client heartbeats)
    last_seen = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ['investigation', 'user']
    
    def __str__(self):
        return f"{self.user.username} - {self.investigation.title} ({self.role})"


class Entity(models.Model):
    """Base entity model for people, evidence, and events"""
    ENTITY_TYPES = [
        ('person', 'Personne'),
        ('location', 'Lieu'),
        ('evidence', 'Preuve'),
        ('event', 'Événement'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    investigation = models.ForeignKey(Investigation, on_delete=models.CASCADE, related_name='entities')
    entity_type = models.CharField(max_length=10, choices=ENTITY_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # Common fields
    role = models.CharField(max_length=100, blank=True)  # For persons
    location = models.CharField(max_length=200, blank=True)  # For events and places
    address = models.CharField(max_length=255, blank=True)  # Detailed address for places
    event_date = models.DateTimeField(null=True, blank=True)  # For events
    event_end_date = models.DateTimeField(null=True, blank=True)  # Optional end for events
    is_timeslot = models.BooleanField(default=False)  # Approximate timeframe indicator
    evidence_type = models.CharField(max_length=20, blank=True)  # For evidence
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} ({self.get_entity_type_display()})"
    
    @property
    def display_name(self):
        """Property to get consistent display name"""
        return self.title


class Link(models.Model):
    """Bidirectional link between entities"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    investigation = models.ForeignKey(Investigation, on_delete=models.CASCADE, related_name='links')
    from_entity = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='outgoing_links')
    to_entity = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='incoming_links')
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    
    class Meta:
        unique_together = ['investigation', 'from_entity', 'to_entity']
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.from_entity.title} → {self.to_entity.title} ({self.title})"
    
    def save(self, *args, **kwargs):
        # Ensure bidirectional uniqueness
        if Link.objects.filter(
            investigation=self.investigation,
            from_entity=self.to_entity,
            to_entity=self.from_entity
        ).exists():
            raise ValueError("Un lien inverse existe déjà")
        super().save(*args, **kwargs)


class Comment(models.Model):
    """Comments on entities"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Comment by {self.author.username} on {self.entity.title}"


class Attachment(models.Model):
    """File attachments for entities"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='attachments/')
    filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=50, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE)
    uploaded_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.filename} ({self.entity.title})"
    
    def save(self, *args, **kwargs):
        if not self.filename and self.file:
            self.filename = self.file.name
        if not self.file_type and self.file:
            import mimetypes
            self.file_type = mimetypes.guess_type(self.file.name)[0] or 'unknown'
        super().save(*args, **kwargs)