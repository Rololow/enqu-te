from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views.generic import View
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
import json
from .models import User, Investigation, InvestigationMember, Entity, Link, Comment, Attachment
from .forms import UserRegistrationForm, InvestigationForm, EntityForm, LinkForm
from django.views.decorators.http import require_POST


class AuthView(View):
    """Authentication views"""
    
    def get(self, request, action):
        if action == 'login':
            return render(request, 'investigation/auth/login.html')
        elif action == 'register':
            return render(request, 'investigation/auth/register.html')
        elif action == 'logout':
            logout(request)
            return redirect('home')
        
        return redirect('home')
    
    def post(self, request, action):
        if action == 'login':
            return self.login_post(request)
        elif action == 'register':
            return self.register_post(request)
        
        return redirect('home')
    
    def login_post(self, request):
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            next_url = request.GET.get('next', 'dashboard')
            return redirect(next_url)
        else:
            messages.error(request, 'Identifiants invalides')
            return render(request, 'investigation/auth/login.html')
    
    def register_post(self, request):
        form = UserRegistrationForm(request.POST, request.FILES)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, 'Compte créé avec succès !')
            return redirect('dashboard')
        
        return render(request, 'investigation/auth/register.html', {'form': form})


@login_required
def home(request):
    """Home page with investigation management"""
    if request.user.is_authenticated:
        return redirect('dashboard')
    return render(request, 'investigation/home.html')


@login_required
def dashboard(request):
    """User dashboard with investigations"""
    user_investigations = Investigation.objects.filter(
        members=request.user
    ).select_related('created_by').order_by('-updated_at')
    
    context = {
        'investigations': user_investigations,
        'user_stats': {
            'total_investigations': user_investigations.count(),
            'owned_investigations': user_investigations.filter(created_by=request.user).count(),
            'recent_investigations': user_investigations.filter(updated_at__gte=timezone.now() - timezone.timedelta(days=7)).count()
        }
    }
    
    return render(request, 'investigation/dashboard.html', context)


@login_required
def investigation_detail(request, investigation_id):
    """Investigation detail view"""
    investigation = get_object_or_404(Investigation, id=investigation_id)
    
    # Check if user has access
    if not investigation.members.filter(id=request.user.id).exists():
        return HttpResponseForbidden("Vous n'avez pas accès à cette enquête")
    
    context = {
        'investigation': investigation,
        'entities': investigation.entities.all().order_by('-created_at'),
        'links': investigation.links.all().order_by('-created_at'),
        'user_role': investigation.investigationmember_set.get(user=request.user).role
    }
    
    return render(request, 'investigation/investigation_detail.html', context)


@login_required
def create_investigation(request):
    """Create new investigation"""
    if request.method == 'POST':
        form = InvestigationForm(request.POST)
        if form.is_valid():
            investigation = form.save(commit=False)
            investigation.created_by = request.user
            investigation.save()
            
            # Add creator as owner
            InvestigationMember.objects.create(
                investigation=investigation,
                user=request.user,
                role='owner'
            )
            
            messages.success(request, 'Enquête créée avec succès !')
            return redirect('investigation_detail', investigation_id=investigation.id)
    else:
        form = InvestigationForm()
    
    return render(request, 'investigation/create_investigation.html', {'form': form})


@login_required
def join_investigation(request):
    """Join existing investigation"""
    if request.method == 'POST':
        code = request.POST.get('code', '').upper()
        
        try:
            investigation = Investigation.objects.get(code=code)
            
            # Check if already member
            if investigation.members.filter(id=request.user.id).exists():
                messages.info(request, 'Vous êtes déjà membre de cette enquête')
                return redirect('investigation_detail', investigation_id=investigation.id)
            
            # Add as member
            InvestigationMember.objects.create(
                investigation=investigation,
                user=request.user,
                role='member'
            )
            
            messages.success(request, f'Bienvenue dans l\'enquête "{investigation.title}" !')
            return redirect('investigation_detail', investigation_id=investigation.id)
            
        except Investigation.DoesNotExist:
            messages.error(request, 'Code d\'enquête invalide')
    
    return redirect('dashboard')


# API Views
@login_required
@csrf_exempt
def api_entities(request, investigation_id):
    """API endpoint for entities"""
    investigation = get_object_or_404(Investigation, id=investigation_id)
    
    # Check access
    if not investigation.members.filter(id=request.user.id).exists():
        return JsonResponse({'error': 'Access denied'}, status=403)
    
    if request.method == 'GET':
        entities = investigation.entities.all()
        
        # Filter by type if specified
        entity_type = request.GET.get('type')
        if entity_type:
            entities = entities.filter(entity_type=entity_type)
        
        # Search
        search = request.GET.get('search')
        if search:
            entities = entities.filter(
                Q(title__icontains=search) | 
                Q(description__icontains=search)
            )
        
        return JsonResponse({
            'entities': [{
                'id': str(entity.id),
                'type': entity.entity_type,
                'title': entity.title,
                'description': entity.description,
                'role': entity.role,
                'location': entity.location,
                'address': entity.address,
                'event_date': entity.event_date.isoformat() if entity.event_date else None,
                'event_end_date': entity.event_end_date.isoformat() if entity.event_end_date else None,
                'is_timeslot': entity.is_timeslot,
                'evidence_type': entity.evidence_type,
                'created_at': entity.created_at.isoformat(),
                'updated_at': entity.updated_at.isoformat(),
                'created_by': entity.created_by.username,
                'comments_count': entity.comments.count(),
                'attachments_count': entity.attachments.count()
            } for entity in entities]
        })
    
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            entity = Entity.objects.create(
                investigation=investigation,
                entity_type=data['type'],
                title=data['title'],
                description=data.get('description', ''),
                role=data.get('role', ''),
                location=data.get('location', ''),
                address=data.get('address', ''),
                event_date=data.get('event_date'),
                event_end_date=data.get('event_end_date'),
                is_timeslot=bool(data.get('is_timeslot', False)),
                evidence_type=data.get('evidence_type', ''),
                created_by=request.user
            )
            
            return JsonResponse({
                'id': str(entity.id),
                'message': 'Entity created successfully'
            })
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)


@login_required
@csrf_exempt
def api_entity_detail(request, investigation_id, entity_id):
    """API endpoint for single entity operations"""
    investigation = get_object_or_404(Investigation, id=investigation_id)
    entity = get_object_or_404(Entity, id=entity_id, investigation=investigation)
    
    # Check access
    if not investigation.members.filter(id=request.user.id).exists():
        return JsonResponse({'error': 'Access denied'}, status=403)
    
    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
            
            entity.title = data.get('title', entity.title)
            entity.description = data.get('description', entity.description)
            entity.role = data.get('role', entity.role)
            entity.location = data.get('location', entity.location)
            entity.address = data.get('address', entity.address)
            entity.event_date = data.get('event_date', entity.event_date)
            entity.event_end_date = data.get('event_end_date', entity.event_end_date)
            entity.is_timeslot = bool(data.get('is_timeslot', entity.is_timeslot))
            entity.evidence_type = data.get('evidence_type', entity.evidence_type)
            entity.save()
            
            return JsonResponse({'message': 'Entity updated successfully'})
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    elif request.method == 'DELETE':
        entity.delete()
        return JsonResponse({'message': 'Entity deleted successfully'})


@login_required
@csrf_exempt
def api_links(request, investigation_id):
    """API endpoint for links"""
    investigation = get_object_or_404(Investigation, id=investigation_id)
    
    # Check access
    if not investigation.members.filter(id=request.user.id).exists():
        return JsonResponse({'error': 'Access denied'}, status=403)
    
    if request.method == 'GET':
        links = investigation.links.all()
        
        return JsonResponse({
            'links': [{
                'id': str(link.id),
                'from_entity': {
                    'id': str(link.from_entity.id),
                    'title': link.from_entity.title,
                    'type': link.from_entity.entity_type
                },
                'to_entity': {
                    'id': str(link.to_entity.id),
                    'title': link.to_entity.title,
                    'type': link.to_entity.entity_type
                },
                'title': link.title,
                'description': link.description,
                'created_at': link.created_at.isoformat(),
                'created_by': link.created_by.username
            } for link in links]
        })
    
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            from_entity = Entity.objects.get(id=data['from_entity_id'])
            to_entity = Entity.objects.get(id=data['to_entity_id'])
            
            # Check if reverse link exists
            if Link.objects.filter(
                investigation=investigation,
                from_entity=to_entity,
                to_entity=from_entity
            ).exists():
                return JsonResponse({'error': 'Un lien inverse existe déjà'}, status=400)
            
            link = Link.objects.create(
                investigation=investigation,
                from_entity=from_entity,
                to_entity=to_entity,
                title=data['title'],
                description=data.get('description', ''),
                created_by=request.user
            )
            
            return JsonResponse({
                'id': str(link.id),
                'message': 'Link created successfully'
            })
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)


@login_required
def api_investigation_members(request, investigation_id):
    """Get investigation members"""
    investigation = get_object_or_404(Investigation, id=investigation_id)
    
    # Check access
    if not investigation.members.filter(id=request.user.id).exists():
        return JsonResponse({'error': 'Access denied'}, status=403)
    
    members = investigation.investigationmember_set.all()
    
    return JsonResponse({
        'members': [{
            'id': str(member.user.id),
            'username': member.user.username,
            'email': member.user.email,
            'role': member.role,
            'joined_at': member.joined_at.isoformat()
        } for member in members]
    })


@login_required
def api_entity_links(request, investigation_id, entity_id):
    """Get links for a specific entity"""
    investigation = get_object_or_404(Investigation, id=investigation_id)
    entity = get_object_or_404(Entity, id=entity_id, investigation=investigation)
    
    # Check access
    if not investigation.members.filter(id=request.user.id).exists():
        return JsonResponse({'error': 'Access denied'}, status=403)
    
    # Get all entities except the current one
    available_entities = investigation.entities.exclude(id=entity.id)
    
    return JsonResponse({
        'available_entities': [{
            'id': str(e.id),
            'title': e.title,
            'type': e.entity_type
        } for e in available_entities],
        'current_links': [{
            'id': str(link.id),
            'to_entity': {
                'id': str(link.to_entity.id),
                'title': link.to_entity.title
            },
            'title': link.title,
            'description': link.description
        } for link in entity.outgoing_links.all()]
    })


@login_required
def api_investigation_presence(request, investigation_id):
    """Return presence info for investigation members"""
    investigation = get_object_or_404(Investigation, id=investigation_id)

    # Only members can see presence
    if not investigation.members.filter(id=request.user.id).exists():
        return JsonResponse({'error': 'Access denied'}, status=403)

    members = investigation.investigationmember_set.select_related('user').all()
    now = timezone.now()
    presence_threshold = timezone.timedelta(seconds=30)

    return JsonResponse({
        'members': [{
            'id': str(m.user.id),
            'username': m.user.username,
            'avatar': m.user.avatar.url if m.user.avatar else None,
            'role': m.role,
            'last_seen': m.last_seen.isoformat() if m.last_seen else None,
            'online': bool(m.last_seen and (now - m.last_seen) <= presence_threshold)
        } for m in members]
    })


@login_required
@require_POST
def api_investigation_presence_heartbeat(request, investigation_id):
    """Heartbeat endpoint to update member last_seen timestamp"""
    investigation = get_object_or_404(Investigation, id=investigation_id)

    try:
        member = InvestigationMember.objects.get(investigation=investigation, user=request.user)
    except InvestigationMember.DoesNotExist:
        return JsonResponse({'error': 'Not a member'}, status=403)

    member.last_seen = timezone.now()
    member.save(update_fields=['last_seen'])
    return JsonResponse({'status': 'ok', 'last_seen': member.last_seen.isoformat()})


@login_required
@require_POST
def api_investigation_delete(request, investigation_id):
    """Allow the investigation owner to delete the investigation."""
    investigation = get_object_or_404(Investigation, id=investigation_id)

    if investigation.created_by != request.user:
        return JsonResponse({'error': "Seul le créateur peut supprimer l'enquête."}, status=403)

    with transaction.atomic():
        messages.success(request, "L'enquête a été supprimée.")
        investigation.delete()

    return JsonResponse({'message': "Enquête supprimée", 'redirect': '/dashboard/'})


@login_required
@require_POST
def api_investigation_revoke_member(request, investigation_id, user_id):
    """Revoke a member's access and rotate the investigation code."""
    investigation = get_object_or_404(Investigation, id=investigation_id)

    if investigation.created_by != request.user:
        return JsonResponse({'error': "Seul le créateur peut gérer les accès."}, status=403)

    try:
        member = InvestigationMember.objects.select_related('user').get(
            investigation=investigation,
            user_id=user_id
        )
    except InvestigationMember.DoesNotExist:
        return JsonResponse({'error': 'Membre introuvable'}, status=404)

    if member.user_id == investigation.created_by_id or member.role == 'owner':
        return JsonResponse({'error': "Impossible de retirer le propriétaire de l'enquête."}, status=400)

    with transaction.atomic():
        member.delete()

        # Generate a fresh and unique code distinct from the previous one
        previous_code = investigation.code
        new_code = None
        for _ in range(10):
            candidate = investigation.generate_code()
            if candidate != previous_code and not Investigation.objects.filter(code=candidate).exists():
                new_code = candidate
                break

        if not new_code:
            return JsonResponse({'error': 'Impossible de générer un nouveau code pour le moment.'}, status=500)

        investigation.code = new_code
        investigation.save(update_fields=['code'])

        messages.info(request, "Le code de l'enquête a été régénéré et le membre a été retiré.")

    return JsonResponse({
        'message': "Accès retiré et code régénéré",
        'code': investigation.code,
        'removed_user_id': user_id
    })