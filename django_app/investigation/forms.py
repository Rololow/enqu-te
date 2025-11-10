from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import User, Investigation, Entity, Link


class UserRegistrationForm(UserCreationForm):
    """Custom user registration form"""
    email = forms.EmailField(required=True)
    avatar = forms.ImageField(required=False)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2', 'avatar')
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field_name, field in self.fields.items():
            field.widget.attrs['class'] = 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none'
            if field_name == 'avatar':
                field.widget.attrs['class'] = 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700'


class InvestigationForm(forms.ModelForm):
    """Form for creating investigations"""
    class Meta:
        model = Investigation
        fields = ['title', 'description']
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none',
                'placeholder': 'Titre de l\'enquête'
            }),
            'description': forms.Textarea(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none',
                'rows': 4,
                'placeholder': 'Description de l\'enquête (optionnelle)'
            })
        }


class EntityForm(forms.ModelForm):
    """Form for creating and editing entities"""
    class Meta:
        model = Entity
        fields = ['entity_type', 'title', 'description', 'role', 'location', 'address', 'event_date', 'event_end_date', 'is_timeslot', 'evidence_type']
        widgets = {
            'entity_type': forms.Select(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none'
            }),
            'title': forms.TextInput(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none',
                'placeholder': 'Titre ou nom'
            }),
            'description': forms.Textarea(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none',
                'rows': 3,
                'placeholder': 'Description détaillée'
            }),
            'role': forms.TextInput(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none',
                'placeholder': 'Rôle (pour les personnes)'
            }),
            'location': forms.TextInput(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none',
                'placeholder': 'Zone / Ville (pour les lieux)'
            }),
            'address': forms.TextInput(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none',
                'placeholder': 'Adresse complète (pour les lieux)'
            }),
            'event_date': forms.DateTimeInput(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none',
                'type': 'datetime-local'
            }),
            'event_end_date': forms.DateTimeInput(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none',
                'type': 'datetime-local'
            }),
            'is_timeslot': forms.CheckboxInput(attrs={
                'class': 'h-4 w-4 text-blue-500 rounded border border-slate-500'
            }),
            'evidence_type': forms.Select(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none'
            })
        }
    
    def __init__(self, *args, **kwargs):
        investigation = kwargs.pop('investigation', None)
        super().__init__(*args, **kwargs)
        
        # Set evidence type choices
        self.fields['evidence_type'].choices = [
            ('', '---------'),
            ('document', 'Document'),
            ('photo', 'Photo'),
            ('video', 'Vidéo'),
            ('audio', 'Audio'),
            ('other', 'Autre')
        ]


class LinkForm(forms.ModelForm):
    """Form for creating links between entities"""
    class Meta:
        model = Link
        fields = ['from_entity', 'to_entity', 'title', 'description']
        widgets = {
            'from_entity': forms.Select(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none'
            }),
            'to_entity': forms.Select(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none'
            }),
            'title': forms.TextInput(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none',
                'placeholder': 'Type de lien (ex: a vu, travaille à, propriétaire de)'
            }),
            'description': forms.Textarea(attrs={
                'class': 'w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none',
                'rows': 2,
                'placeholder': 'Description du lien (optionnelle)'
            })
        }
    
    def __init__(self, *args, **kwargs):
        investigation = kwargs.pop('investigation', None)
        from_entity = kwargs.pop('from_entity', None)
        super().__init__(*args, **kwargs)
        
        if investigation:
            entities = investigation.entities.all()
            self.fields['from_entity'].queryset = entities
            self.fields['to_entity'].queryset = entities
            
            if from_entity:
                self.fields['from_entity'].initial = from_entity
                # Exclude the from_entity from to_entity choices
                self.fields['to_entity'].queryset = entities.exclude(id=from_entity.id)