# RoroEnquête - Application Django

Une application web complète pour la gestion collaborative d'enquêtes, développée avec Django et PostgreSQL.

## ✨ Fonctionnalités

### 🔐 Authentification et Gestion des Utilisateurs
- Système d'inscription et de connexion sécurisé
- Profils utilisateurs avec avatars
- Rôles et permissions dans les enquêtes (Propriétaire, Admin, Membre, Observateur)

### 🕵️ Gestion des Enquêtes
- Création d'enquêtes avec codes uniques
- Système de collaboration multi-utilisateur
- Rejoindre des enquêtes existantes avec un code

### 📋 Gestion des Éléments
- **Personnes** : Nom, rôle, description
- **Preuves** : Titre, type (document, photo, vidéo, audio, autre), description
- **Événements** : Date, lieu, description

### 🔗 Système de Liens
- Liens bidirectionnels entre éléments
- Types de liens personnalisables
- Visualisation des connexions

### 📊 Visualisations
- **Timeline horizontale** : Événements chronologiques de gauche à droite
- **Graphe de liens** : Visualisation interactive des connexions
- **Vue fiches** : Cartes de présentation pour chaque élément

### 🔍 Fonctionnalités Avancées
- Filtres par type et recherche textuelle
- Export des données en JSON
- Interface moderne avec animations
- Mode sombre/clair

## 🛠️ Technologies Utilisées

### Backend
- **Django 4.2** : Framework web Python
- **PostgreSQL** : Base de données relationnelle
- **Django REST Framework** : API REST
- **Django CORS Headers** : Gestion CORS

### Frontend
- **HTML5/CSS3** : Structure et styles
- **Tailwind CSS** : Framework CSS utilitaire
- **JavaScript ES6+** : Logique client
- **ECharts.js** : Visualisations de graphes
- **Anime.js** : Animations
- **Font Awesome** : Icônes

## 📦 Installation

### Prérequis
- Python 3.8+
- PostgreSQL 12+
- pip (gestionnaire de packages Python)

### Étapes d'Installation

1. **Cloner le projet**
   ```bash
   cd django_investigation
   ```

2. **Créer un environnement virtuel**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Sur Windows: venv\Scripts\activate
   ```

3. **Installer les dépendances**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configurer la base de données**
   ```bash
   # Créer la base de données PostgreSQL
   createdb investigation_db
   
   # Copier et modifier le fichier d'environnement
   cp .env.example .env
   # Éditer .env avec vos informations de connexion PostgreSQL
   ```

5. **Exécuter le script de configuration**
   ```bash
   python setup.py
   ```

6. **Lancer le serveur de développement**
   ```bash
   python manage.py runserver
   ```

7. **Accéder à l'application**
   - Application : http://127.0.0.1:8000
   - Admin Django : http://127.0.0.1:8000/admin

## 🎯 Utilisation

### Créer une Enquête
1. Inscrivez-vous ou connectez-vous
2. Cliquez sur "Nouvelle enquête"
3. Remplissez le formulaire avec le titre et la description
4. Un code unique sera généré automatiquement

### Rejoindre une Enquête
1. Sur la page d'accueil, entrez le code d'une enquête existante
2. Vous serez ajouté comme membre de l'enquête

### Ajouter des Éléments
1. Dans une enquête, utilisez les boutons "Ajouter"
2. Remplissez le formulaire selon le type d'élément
3. Les éléments apparaissent immédiatement dans les vues

### Créer des Liens
1. Cliquez sur le bouton "Lien" sur une carte d'élément
2. Sélectionnez l'élément de destination
3. Définissez le type et la description du lien
4. Le lien est créé dans les deux sens

### Naviguer entre les Vues
- **Timeline** : Vue chronologique horizontale des événements
- **Graphe** : Visualisation des connexions entre éléments
- **Fiches** : Vue en grille de toutes les fiches

## 📁 Structure du Projet

```
django_investigation/
├── investigation/              # Application principale
│   ├── models.py              # Modèles de base de données
│   ├── views.py               # Vues Django et API
│   ├── forms.py               # Formulaires
│   ├── admin.py               # Configuration admin
│   ├── urls.py                # URLs principales
│   ├── api_urls.py            # URLs de l'API
│   └── templates/             # Templates HTML
├── investigation_project/     # Configuration Django
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── templates/                 # Templates de base
├── static/                    # Fichiers statiques
├── media/                     # Fichiers uploadés
├── requirements.txt           # Dépendances Python
├── setup.py                   # Script d'installation
├── .env.example              # Exemple de configuration
└── README.md                 # Ce fichier
```

## 🔧 Configuration

### Variables d'Environnement

Créez un fichier `.env` basé sur `.env.example` :

```env
# Django Configuration
SECRET_KEY=your-secret-key-here-change-in-production
DEBUG=True

# Database Configuration
DB_NAME=investigation_db
DB_USER=postgres
DB_PASSWORD=your-password-here
DB_HOST=localhost
DB_PORT=5432
```

### Base de données

La configuration par défaut utilise PostgreSQL. Pour une base de données différente, modifiez `DATABASES` dans `settings.py`.

## 🚀 Déploiement

### Production

1. **Sécurité**
   - Changez `SECRET_KEY` et `DEBUG=False`
   - Utilisez un serveur WSGI comme Gunicorn
   - Configurez un reverse proxy (Nginx)

2. **Base de données**
   - Utilisez PostgreSQL en production
   - Effectuez des sauvegardes régulières

3. **Static files**
   ```bash
   python manage.py collectstatic --noinput
   ```

### Docker (Optionnel)

Un fichier `Dockerfile` peut être ajouté pour un déploiement containerisé :

```dockerfile
FROM python:3.11
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

## 📝 API Endpoints

### Enquêtes
- `GET /api/investigation/{id}/entities/` : Liste des éléments
- `POST /api/investigation/{id}/entities/` : Créer un élément
- `PUT /api/investigation/{id}/entity/{entity_id}/` : Modifier un élément
- `DELETE /api/investigation/{id}/entity/{entity_id}/` : Supprimer un élément

### Liens
- `GET /api/investigation/{id}/links/` : Liste des liens
- `POST /api/investigation/{id}/links/` : Créer un lien

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Fork le projet
2. Créez une branche pour votre fonctionnalité
3. Commitez vos changements
4. Poussez vers la branche
5. Créez une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.

## 🆘 Support

Pour toute question ou problème :

1. Vérifiez la documentation
2. Créez une issue sur le dépôt
3. Contactez l'équipe de développement

## 🔄 Mises à jour

Pour mettre à jour l'application :

1. Sauvegardez votre base de données
2. Mettez à jour le code source
3. Exécutez les migrations :
   ```bash
   python manage.py migrate
   ```
4. Redémarrez le serveur

---

**RoroEnquête** - Simplifiez vos enquêtes avec la puissance du collaboratif ! 🔍