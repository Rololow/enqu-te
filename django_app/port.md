# Portage vers Rust + WASM

## Objectifs
- Offrir des performances backend accrues via un service web Rust.
- Réimplémenter l'API REST et les flux temps réel avec un framework Rust moderne.
- Conserver la compatibilité avec le schéma de données existant ou prévoir une migration.
- Moderniser le front en tirant parti de WebAssembly pour les vues interactives (timeline, graphe, cartes).
- ✅ **COMPLÉTÉ**: Séparer les vues timeline, graphe et fiches sur des pages dédiées (`/investigation/<uuid>/timeline/`, `/investigation/<uuid>/graphe/`, `/investigation/<uuid>/fiches/`).

## Changements Complétés

### Séparation des Vues (Phase 1 - Django)
- ✅ **Structure URL**: Création de trois routes distinctes :
  - `/investigation/<uuid>/timeline/` pour la vue chronologique
  - `/investigation/<uuid>/graphe/` pour la vue réseau de liens
  - `/investigation/<uuid>/fiches/` pour la vue cartes
- ✅ **Templates**: Création d'une architecture modulaire avec :
  - `investigation_base.html` : template de base contenant les éléments communs (header, navigation, filtres)
  - `investigation_timeline.html` : template spécifique pour la timeline
  - `investigation_graphe.html` : template spécifique pour le graphe
  - `investigation_fiches.html` : template spécifique pour les fiches
  - `modals.html` : composants modaux réutilisables
- ✅ **Views Django**: Trois fonctions de vue séparées avec contexte partagé
- ✅ **Navigation**: Liens directs entre les pages au lieu de basculement JavaScript
- ✅ **JavaScript**: Adaptation pour gérer le rendu basé sur la page actuelle

**Impact**: Les utilisateurs peuvent désormais naviguer directement vers une vue spécifique via URL et partager des liens vers des vues particulières.

## TODO

### Audit & Préparation
- [ ] Cartographier les endpoints Django (auth, investigations, entités, liens, présence) et les dépendances front (Tailwind, ECharts, Anime.js).
- [ ] Extraire le schéma de données PostgreSQL (tables, contraintes, index) et valider l'étendue des migrations à effectuer.
- [ ] Inventorier les fonctionnalités temps réel (polling, heartbeats, rafraîchissement auto) pour planifier des flux WebSocket/SSE.
- [ ] Documenter les besoins en fichiers statiques (uploads avatars, photos, pièces jointes) et les contraintes de stockage.

### Architecture Rust
- [ ] Choisir le framework backend (ex : Actix Web ou Axum) et fixer la structure du projet (monorepo ou workspace multi-crates).
- [ ] Sélectionner l'ORM/sql layer (Diesel, SeaORM, SQLx) et générer les migrations gérées par Rust.
- [ ] Configurer l'authentification (sessions signées, JWT ou autre stratégie) compatible avec les besoins actuels.
- [ ] Définir un plan de sécurité (CSRF, CORS, rate limiting) équivalent à Django.

### Couche API & Modèles
- [ ] Recréer les modèles Rust correspondant aux entités User, Investigation, Tag, Entity, Link, Comment, Attachment.
- [ ] Implémenter les routes REST/JSON équivalentes (CRUD entités, gestion des liens, membres, présence, uploads).
- [ ] Ajouter des tests d'intégration Rust couvrant les principaux parcours (création d'enquête, ajout d'entité, création de lien).
- [ ] Mettre en place la documentation d'API (OpenAPI/Swagger) pour les nouveaux endpoints.

### Front WebAssembly
- [ ] Choisir le framework WASM (Yew, Leptos, Sycamore) ou un toolkit JS + modules Rust compilés.
- [ ] Porter la timeline, le graphe et les fiches dans des composants Rust/WASM dédiés à chaque page.
- [ ] Assurer la navigation entre les pages `/investigation/timeline`, `/investigation/graphe`, `/investigation/fiches` et conserver les filtres partagés.
- [ ] Intégrer la logique de filtre, tri, auto-sync dans la nouvelle couche front.
- [ ] Mettre en place le tooling (Trunk, wasm-pack, Vite + wasm-bindgen) et la CI pour génération des assets.

### Gestion des fichiers & services annexes
- [ ] Réimplémenter l'upload de fichiers (avatars, photos, pièces jointes) avec stockage local ou objet (S3/MinIO).
- [ ] Gérer la génération et la régénération des codes d'enquête en Rust.
- [ ] Remplacer les tâches programmées/polling par des services asynchrones (Tokio) ou des jobs programmés.

### Migration & Coexistence
- [ ] Planifier une phase de migration progressive (backend Rust derrière un reverse proxy, front hybride le temps de la transition).
- [ ] Écrire des scripts de migration de données pour passer du schéma Django aux migrations Rust.
- [ ] Mettre en place des tests de régression comparant les réponses JSON Django vs Rust pendant la phase de double run.

### Observabilité & Déploiement
- [ ] Instrumenter le service Rust (tracing, metrics Prometheus, logs structurés).
- [ ] Créer la chaîne CI/CD (GitHub Actions/Cargo + build wasm) et scripts de déploiement.
- [ ] Mettre en place la surveillance de performance (temps de réponse API, taille wasm) et des alertes.

### Documentation & Formation
- [ ] Mettre à jour la documentation d'installation (Rust toolchain, wasm32 target, env vars).
- [ ] Préparer des notes de formation pour l'équipe (Rust patterns, debug wasm, workflows).
- [ ] Archiver l'ancienne architecture Django et pointer vers la nouvelle documentation Rust/WASM.
