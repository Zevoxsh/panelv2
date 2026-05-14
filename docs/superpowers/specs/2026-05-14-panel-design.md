# Panel — Spec de design
Date : 2026-05-14

## Vue d'ensemble

Panel de gestion de serveurs de jeux inspiré de Pterodactyl, construit from scratch. Compatible avec l'API Wings. Pas de register public — les comptes sont créés par les administrateurs ou via des clés API admin.

Deux zones distinctes dans une seule application :
- **Panel admin** (`/admin/*`) — gestion des utilisateurs, nodes, serveurs, clés API
- **Panel client** (`/client/*`) — accès d'un utilisateur à ses propres serveurs

---

## Stack technique

| Couche | Technologie |
|---|---|
| Base de données | PostgreSQL |
| ORM + migrations | Drizzle ORM |
| Sessions | Redis (token opaque HttpOnly) |
| Backend | Node.js + Fastify |
| Frontend | React 18 + TypeScript + Vite |
| Déploiement | Docker + Docker Compose |

---

## Architecture

```
panel/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/         # login, logout, middleware session
│   │   │   ├── users/        # CRUD utilisateurs (admin only)
│   │   │   └── api-keys/     # génération et révocation de clés
│   │   ├── db/
│   │   │   ├── schema.ts     # définitions Drizzle
│   │   │   └── migrations/
│   │   └── plugins/
│   │       ├── redis.ts      # connexion Redis via @fastify/redis
│   │       ├── db.ts         # connexion PostgreSQL via postgres.js + Drizzle
│   │       └── auth.ts       # hook preHandler vérification session
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── login/        # page split screen
│   │   │   ├── admin/        # dashboard admin, users, api-keys
│   │   │   └── client/       # liste serveurs client
│   │   ├── components/
│   │   │   ├── layout/       # Sidebar, Topbar, Layout wrapper
│   │   │   └── ui/           # boutons, inputs, badges, cards
│   │   ├── stores/           # Zustand : auth store, ui store
│   │   ├── hooks/            # useAuth, useSession
│   │   └── lib/
│   │       └── api.ts        # client fetch centralisé
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml
```

---

## Base de données

### Table `users`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
username      VARCHAR(255) UNIQUE NOT NULL
email         VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL          -- bcrypt, cost 12
role          ENUM('admin', 'user') NOT NULL DEFAULT 'user'
is_active     BOOLEAN NOT NULL DEFAULT true
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

### Table `api_keys`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
key_hash      VARCHAR(255) UNIQUE NOT NULL   -- SHA-256 du token brut
name          VARCHAR(255) NOT NULL           -- label lisible
type          ENUM('admin', 'user') NOT NULL
last_used_at  TIMESTAMPTZ NULL
expires_at    TIMESTAMPTZ NULL                -- NULL = jamais expire
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

### Sessions Redis
```
CLE   session:{uuid_v4}
VALEUR JSON { userId, role, ip, userAgent, createdAt }
TTL   86400 secondes (24h), renouvelé à chaque requête authentifiée
```

---

## Authentification

### Login par formulaire
1. `POST /api/auth/login` — body : `{ email, password }`
2. Vérification email en DB → comparaison bcrypt du mot de passe
3. Création d'un UUID session → stockage Redis avec TTL 24h
4. Réponse : cookie `session_id` HttpOnly, Secure, SameSite=Strict
5. Redirection frontend selon `role` : admin → `/admin`, user → `/client`

### Middleware session (preHandler Fastify)
- Lecture cookie `session_id`
- Lookup Redis → si absent ou expiré : 401
- Renouvellement TTL Redis
- Injection `req.user = { id, role }` pour les handlers

### Logout
- `POST /api/auth/logout` → suppression clé Redis → clear cookie

### Authentification par clé API
- Header `Authorization: Bearer <token_brut>`
- Hash SHA-256 du token → lookup dans `api_keys` → vérification `expires_at`
- Mise à jour `last_used_at`
- Injection `req.user` identique au flow session

### Autorisation
- Clé/session `role=admin` → accès total
- Clé/session `role=user` → accès limité à ses propres ressources
- Middleware `requireAdmin` sur toutes les routes `/api/admin/*`

---

## API REST — Endpoints MVP

### Auth (public)
```
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Admin — Utilisateurs (admin only)
```
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/users/:id
PATCH  /api/admin/users/:id
DELETE /api/admin/users/:id
```

### Clés API
```
GET    /api/api-keys              -- ses propres clés (user) ou toutes (admin)
POST   /api/api-keys              -- créer une clé (retourne le token brut une seule fois)
DELETE /api/api-keys/:id          -- révoquer
```

---

## Frontend

### Thème visuel
- Palette : Dark Violet (`#0f1117` fond, `#1a1d2e` surfaces, `#7c3aed` accent)
- Typographie : Inter ou Geist
- Icônes : Lucide React

### Page Login (`/login`)
- Layout **split screen** : moitié gauche (gradient violet, logo, tagline), moitié droite (formulaire)
- Champs : email + mot de passe
- Gestion d'erreur inline (mauvais identifiants, compte désactivé)
- Redirection automatique si déjà connecté

### Layout principal (post-login)
- **Topbar** : logo, nom du panel, avatar utilisateur + dropdown (profil, logout)
- **Sidebar collapsible** : navigation verticale, rétractable en icônes seulement via un toggle
- **Zone contenu** : occupe le reste de l'écran

### Routing
```
/login                  → page login (publique)
/admin                  → dashboard admin (role=admin requis)
/admin/users            → gestion utilisateurs
/admin/api-keys         → gestion clés API admin
/client                 → liste serveurs (role=user)
/client/api-keys        → clés API utilisateur
*                       → redirect /login si non authentifié
```

### State management
- **Zustand** : `authStore` (user courant, rôle), `uiStore` (sidebar ouverte/fermée)
- **React Query** : toutes les données serveur (users, clés API…)
- `lib/api.ts` : client fetch centralisé avec gestion 401 (redirect /login)

---

## Docker Compose (dev)

Services :
- `backend` — Node.js Fastify, port 3000, hot-reload avec tsx watch
- `frontend` — Vite dev server, port 5173
- `postgres` — PostgreSQL 16, volume persistant
- `redis` — Redis 7, volume persistant

Variables d'environnement backend :
```
DATABASE_URL=postgresql://panel:panel@postgres:5432/panel
REDIS_URL=redis://redis:6379
SESSION_SECRET=<secret_fort>
BCRYPT_ROUNDS=12
NODE_ENV=development
```

---

## Périmètre MVP (cette itération)

- Système de login complet (formulaire + clés API)
- CRUD utilisateurs côté admin
- Génération et révocation de clés API
- Structure de base du projet (Docker, DB, routing frontend)

**Hors scope MVP :**
- Gestion Wings (serveurs, nodes, allocations)
- Console WebSocket
- Backups, schedules, databases de serveurs
- Emails transactionnels
- 2FA
