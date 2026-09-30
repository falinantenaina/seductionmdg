# Seduction — Application de gestion commerciale, stock, facturation et livraison

Application web full-stack : **React + TypeScript + Vite + Tailwind/shadcn** côté frontend, **Node.js + Express + Prisma + PostgreSQL** côté backend.

## Prérequis

- Node.js ≥ 20 (testé avec Node 24)
- PostgreSQL ≥ 14 (aucun client nécessaire : les migrations sont appliquées par Prisma)

## Installation

### 1. Base de données

```bash
# Créer la base en UTF-8 (une seule fois)
psql -U postgres -c "CREATE DATABASE seduction ENCODING 'UTF8' TEMPLATE template0;"
```

> L'encodage **UTF8** est obligatoire (sinon les accents français échouent).

### 2. Backend

```bash
cd backend
cp .env.example .env          # adapter DATABASE_URL / JWT_SECRET / PORT
npm install
npx prisma migrate deploy     # applique les migrations
npm run seed                  # comptes de démo + données de test
npm run dev                   # API sur http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxy /api → :4000)
```

## Comptes de démonstration

Mot de passe commun : **`Demo1234!`**

| Rôle | Email |
|---|---|
| Administrateur | `admin@seduction.cd` |
| Commercial | `commercial@seduction.cd` |
| Facturier | `facturier@seduction.cd` |
| Magasinier | `magasinier@seduction.cd` |
| Dispatcher | `dispatcher@seduction.cd` |
| Livreur | `livreur@seduction.cd` |

Jeu de démonstration (`npm run seed`) : **6 utilisateurs, 4 catégories (Vêtements, Sacs, Bracelets, Accessoires), 12 articles** (même famille : robes, t-shirts, jeans, sacs, bracelets — SKUs `ART-001` à `ART-012`), **5 clients** à Madagascar et **2 livreurs**.
Montants exprimés en **ariary (MGA)** — l'interface et les PDF affichent « Ar », format `1 234 567 Ar` sans décimale. Émetteur : *SEDUCTION SARL, Analakely, Antananarivo* (`backend/src/config/company.ts`).

## Structure du projet

```text
backend/
  prisma/schema.prisma       # modèle de données complet
  prisma/migrations/         # migrations PostgreSQL
  prisma/seed.ts             # jeu de données de démonstration
  src/config/                # variables d'environnement validées (Zod)
  src/middleware/            # auth JWT, RBAC, validation Zod, erreurs centralisées
  src/modules/<module>/      # routes + controller + service + schemas
  src/utils/                 # audit, notifications, séquences, transactions stock
frontend/
  src/lib/                   # api.ts (Axios), utils, constantes, query keys
  src/stores/                # Zustand : authStore, uiStore
  src/components/ui/         # primitives shadcn/ui
  src/components/layout/     # sidebar, header, layout applicatif
  src/components/shared/     # data-table, pagination, badges de statut...
  src/features/<page>/       # une page par domaine
```

## Règles de stock (cœur du système)

```text
Stock disponible = Stock physique - Stock réservé
```

| Événement | Physique | Réservé | Mouvement |
|---|---|---|---|
| Validation d'une commande | inchangé | +quantité | `RESERVATION` |
| Sortie magasin validée | -quantité | -quantité | `SORTIE` |
| Annulation avant sortie | inchangé | -quantité | `ANNULATION_RESERVATION` |
| Entrée / ajustement / retour | ±quantité | — | `ENTREE` / `AJUSTEMENT` / `RETOUR` |

- Toutes les écritures passent par `stock.service.ts` (verrous `SELECT ... FOR UPDATE`, transaction Prisma).
- Chaque écriture crée un `StockMovement` avec ancien et nouvel état → page **Mouvements**.
- Aucune suppression physique d'une commande ayant engendré des opérations : uniquement des statuts.

## Workflow commande

| Route | Page | Rôle |
|---|---|---|
| `/customers` | Clients (CRUD) | Commercial, Facturier, Admin |
| `/orders` | Liste + filtres statut/recherche | Commercial, Facturier, Magasinier, Dispatcher, Admin |
| `/orders/new` | Catalogue + panier + client | Commercial, Admin |
| `/orders/:id` | Détail, articles, mouvements, annulation | Commercial, Facturier, Magasinier, Dispatcher, Admin |

- Le panier est conservé dans `stores/order.store.ts` (Zustand + localStorage) jusqu'à la validation.
- Création de client **inline** : bouton « Nouveau client » dans le formulaire de commande → `POST /api/customers`, puis le client est sélectionné automatiquement.
- `POST /api/orders` réserve les quantités dans la même transaction (blocage possible → `422`).
- `saveAsDraft: true` crée un brouillon **sans** réservation ; `POST /api/orders/:id/submit` le valide.
- `POST /api/orders/:id/cancel` (motif obligatoire) libère la réservation, interdit avant la sortie magasin.
- Le commercial ne voit que ses propres commandes et ne peut pas consulter les mouvements globaux.

## Workflow facturation

| Route | Page | Rôle |
|---|---|---|
| `/invoices` | Liste + création depuis une commande | Facturier (écriture), Commercial (lecture) |
| `/invoices/:id` | Détail, émission, encaissement, annulation, PDF | Facturier (écriture), Commercial (lecture) |

Cycle de vie : `BROUILLON → EMISE → PAYEE` (ou `ANNULEE` avec motif).

| Action | Endpoint | Effet sur la commande |
|---|---|---|
| Créer (brouillon) | `POST /api/invoices` (`saveAsDraft: true`) | `COMMANDE → EN_FACTURATION` |
| Créer / émettre | `POST /api/invoices`, `POST /api/invoices/:id/issue` | `→ FACTUREE` |
| Encaisser | `POST /api/invoices/:id/pay` | `FACTUREE → A_PREPARER` (magasin) ; **inchangé** si la commande est déjà sortie (paiement à la livraison) |
| Annuler (motif) | `POST /api/invoices/:id/cancel` | revient à `COMMANDE` |
| Modifier la livraison | `PATCH /api/orders/:id/delivery` | met à jour les 4 champs livraison (audit `ORDER_DELIVERY_UPDATE`) |
| PDF | `GET /api/invoices/:id/pdf` | inchangé |

- **Lieu de livraison et contacts saisis à la facturation** : le facturier renseigne `deliveryAddress`, `deliveryPlace`, `recipientName`, `recipientPhone` dans le formulaire de création de facture ; ils sont stockés sur la commande, alimentent la facture PDF (carte *Références*), la fiche de livraison et sont modifiables ensuite depuis la fiche de commande (`PATCH /api/orders/:id/delivery`).
- Le `PATCH` n'envoie **que les champs modifiés** (absent = inchangé) et exige au moins un champ (`400` sinon) ; commande `ANNULEE` → `422` ; rôles : facturier, commercial, admin.
- Une seule facture par commande (`orderId` unique) ; numéro séquentiel `FAC-####`.
- Une facture **payée** ne peut pas être annulée (422) ; brouillon et émise uniquement.
- Génération PDF via **pdfmake** (polices Roboto embarquées, en-tête émetteur dans `src/config/company.ts`, URL externes bloquées).
- Téléchargement côté client via `lib/pdf.ts` (l'Authorization passe dans l'en-tête, pas dans l'URL).

## Workflow magasin

| Route | Page | Rôle |
|---|---|---|
| `/warehouse` | File « À préparer » + historique des sorties | Magasinier, Admin |
| `/stocks/movements` | Historique complet des mouvements de stock | Admin, Magasinier |

| Action | Endpoint | Effet |
|---|---|---|
| File d'attente | `GET /api/orders?status=FACTUREE,A_PREPARER` | commandes **facturées** : payées ou à encaisser à la livraison |
| Valider la sortie | `POST /api/warehouse/orders/:id/exit` | commande → `SORTIE_MAGASIN`, `releasedAt` renseigné, **-physique et -réservé**, mouvement `SORTIE` |
| Historique | `GET /api/warehouse/exits` | statuts `SORTIE_MAGASIN` / `EN_LIVRAISON` / `LIVREE`, triés sur la date de sortie |

- **Paiement à la livraison** : la sortie n'exige **plus** l'encaissement — une commande `FACTUREE` (facture émise, non payée) sort du magasin comme une commande `A_PREPARER`. Le facturier encaisse ensuite (`POST /api/invoices/:id/pay`) : si la commande a déjà quitté le magasin, seul l'état de la facture change (`PAYEE`), le statut commande reste `SORTIE_MAGASIN`/`EN_LIVRAISON`/`LIVREE`.
- Le filtre `status` de `GET /api/orders` accepte une **liste séparée par des virgules** (ex. `FACTUREE,A_PREPARER`) ; statut inconnu → `400`.
- Seul le magasinier (ou l'admin) valide une sortie : `403` sinon ; commande non facturée (`COMMANDE`, brouillon...) → `422` ; déjà sortie → `409`.
- La sortie **consomme la réservation** : le stock disponible ne bouge pas, le stock physique diminue.
- Observation de contrôle facultative → historique du mouvement ; audit `ORDER_EXIT` ; notification au dispatcher.
- Aucune annulation après la sortie : les retours se traiteront en réception (Phase 6).

## Workflow livraisons

| Route | Page | Rôle |
|---|---|---|
| `/deliveries` | Liste des fiches (statut, recherche ; « mes livraisons » pour le livreur) | Dispatcher, Livreur, Admin |
| `/deliveries/:id` | Fiche : affectation, départ, validation avec quantités, échec, PDF | Dispatcher (affectation), Livreur (exécution), Admin |
| `/delivery-persons` | Profils livreurs : création, rattachement d'un compte, activation | Dispatcher, Admin |

| Action | Endpoint | Effet |
|---|---|---|
| Créer la fiche | `POST /api/deliveries` (`orderId`) | fiche `LIV-####` en `A_LIVRER`, lignes copiées depuis la commande |
| Affecter | `POST /api/deliveries/:id/assign` | `A_LIVRER` / `ECHEC` → `AFFECTEE`, commande → `EN_LIVRAISON`, notification du livreur |
| Désaffecter | `POST /api/deliveries/:id/unassign` | `AFFECTEE` → `A_LIVRER`, commande → `SORTIE_MAGASIN` |
| Démarrer | `POST /api/deliveries/:id/start` (livreur) | `AFFECTEE` → `EN_COURS` |
| Valider | `POST /api/deliveries/:id/complete` (livreur) | `EN_COURS` → `LIVREE`, `quantityDelivered` par ligne, commande → `LIVREE` |
| Échec | `POST /api/deliveries/:id/fail` (livreur, motif) | `EN_COURS` → `ECHEC`, commande → `SORTIE_MAGASIN` (réexpédition) |
| PDF | `GET /api/deliveries/:id/pdf` | fiche imprimable (destinataire, livreur, quantités, signatures) |

- **Une fiche par commande** (`orderId` unique) : on réaffecte au lieu de recréer, y compris après un échec.
- Le livreur n'agit que sur ses propres fiches (`404` sinon) ; seul un profil **actif** peut être affecté.
- Quantité livrée supérieure à la quantité prévue → `422` ; total livré à 0 → `422` (utiliser l'échec).
- **Aucun mouvement de stock à la livraison** : le stock est déjà sorti au magasin ; un retour physique se saisit
  en entrée/retour au magasin.
- Livreurs seedés : *Hery Livraison* (rattaché au compte `livreur@`) et *Nina Express* (sans compte).

## Tableau de bord, statistiques et notifications

| Route | Page | Rôle |
|---|---|---|
| `/dashboard` | KPIs du rôle, tendance 14 jours, alertes stock, dernières commandes | Tous |
| `/notifications` | Centre de notifications (filtre « non lues », marquage lu) | Tous |
| `/statistics` | Onglets *Indicateurs* (période) et *Journal d'audit* | Admin |

| Action | Endpoint | Effet |
|---|---|---|
| Tableau de bord | `GET /api/stats/dashboard?days=7..90` | KPIs cadrés au rôle + séries journalières (commandes, encaissements) |
| Rapport | `GET /api/stats/report?from&to` | CA, panier moyen, top articles, catégories, statuts, mouvements (Admin) |
| Liste | `GET /api/notifications` (`unreadOnly`, `type`, pagination) | notifications de l'utilisateur connecté |
| Compteur | `GET /api/notifications/count` | `{ unread }` (cloche de l'en-tête, rafraîchie toutes les minutes) |
| Marquer lu | `POST /api/notifications/:id/read` | notification personnelle uniquement (`404` si elle appartient à un autre utilisateur) |
| Tout lire | `POST /api/notifications/read-all` | marque toutes ses notifications comme lues |
| Journal | `GET /api/audit` (filtres `action`, `entity`, `userId`, `search`, `from`, `to`) | traces horodatées avec utilisateur et avant/après (Admin) |
| Facettes | `GET /api/audit/facets` | actions et entités déjà journalisées (filtres de l'interface) |

- Les KPIs sont **cadrés au rôle** : le commercial ne voit que ses commandes et son CA, le livreur ses fiches.
- Cloche dans l'en-tête : badge rouge = non lues, aperçu des 6 dernières, « tout marquer comme lu ».
- Alertes de stock envoyées automatiquement au franchissement du seuil (`STOCK_FAIBLE` → Admin + Magasinier).
- Chaque écriture métier est journalisée dans `AuditLog` (création, validation, sortie magasin, affectation...).

## Tests automatisés

### Backend (Vitest + Supertest)

```bash
cd backend
npm test           # recrée la base seduction_test, rejoue les migrations, seed, puis lance les tests
npm run test:watch # mode veille
```

| Fichier | Couverture |
|---|---|
| `tests/smoke.test.ts` | santé de l'API, 404 inconnu |
| `tests/security.test.ts` | en-têtes HTTP, CORS, 401/400/413, rate-limit login, matrice RBAC (403) |
| `tests/auth.test.ts` | 6 comptes de démo, anti-énumération, `/me`, validation, compte désactivé, création utilisateur + doublon |
| `tests/order-flow.test.ts` | cycle complet : réservation → facture (brouillon/émise/payée, PDF) → sortie magasin → livraison, notifications, audit, KPIs |
| `tests/stocks.test.ts` | course concurrente (2 écritures, aucun dépassement), entrée, ajustement sous seuil → `STOCK_FAIBLE`, refus sous réservé (422) |
| `tests/platform.test.ts` | notifications (scoping, filtres, lu/non-lu), dashboard par rôle, rapport ADMIN, journal d'audit + facettes |
| `tests/invoice-delivery.test.ts` | création de client par le commercial, infos livraison saisies à la facturation, `PATCH /orders/:id/delivery` (RBAC, 400 vide, 404, 422 commande annulée) |
| `tests/warehouse-cod.test.ts` | paiement à la livraison : file `FACTUREE,A_PREPARER`, sortie sans encaissement (stock décrémenté), encaissement après sortie sans régression de statut, 409 double sortie, 422 commande non facturée |

- Base dédiée **`seduction_test`** : la base de démonstration `seduction` n'est jamais touchée.
- Les suites s'exécutent séquentiellement (une seule base) — ordre : `auth → invoice-delivery → order-flow → platform → security → smoke → stocks → warehouse-cod` (57 tests).

### Frontend (Vitest + jsdom + Testing Library)

```bash
cd frontend
npm test           # exécution unique
npm run test:watch # mode veille
```

`src/lib/utils.test.ts` (formats monnaie/dates, Decimals), `src/components/layout/nav.test.ts` (visibilité et contrôle d'accès par rôle, chemin le plus long), `status-badge.test.tsx` (libellés FR de tous les statuts), `charts.test.tsx` (histogramme, répartition, états vides), `button.test.tsx` (variants, spinner de chargement, rendu `asChild` — régression page blanche), `data-table.test.tsx` (cartes mobiles, colonne actions, squelette, vide, erreur), `ui.store.test.ts` et `header.test.tsx` (repli / masquage de la sidebar) — **49 tests**.

## Sécurité

- **Transports & en-têtes** : Helmet complet (CSP, HSTS, `X-Frame-Options`, `nosniff`, `no-referrer-policy`), `x-powered-by` désactivé, `Cache-Control: no-store` sur toutes les réponses `/api`.
- **Authentification** : JWT HS256 (secret ≥ 32 caractères validé par Zod au démarrage, `JWT_EXPIRES_IN`), mots de passe bcrypt `SALT_ROUNDS = 10`, ré-authentification de l'utilisateur **actif** en base à chaque requête protégée.
- **Autorisations** : `authorize(...roles)` avec bypass ADMIN sur toutes les routes (sauf dashboards/notifications qui sont par utilisateur) ; `403` normalisé hors rôle.
- **Validation** : schémas Zod sur params, query et body partout ; erreurs centralisées `{ success: false, message, code, details? }`.
- **Anti force brute** : limiteur sur `POST /api/auth/login` (prod 10 / dev 200 / test 10 000 par fenêtre glissante de 15 min) → `429`.
- **Anti-énumération** : message identique pour « mot de passe incorrect » et « compte inconnu ».
- **CORS** : origine du front uniquement ; une origine étrangère reçoit **aucun** en-tête `Access-Control-Allow-Origin`.
- **Corps de requête** : taille limitée (`413 PAYLOAD_TOO_LARGE`) ; CSRF non nécessaire (API JSON + header `Authorization`, cookies non utilisés).
- **Traçabilité** : `AuditLog` (utilisateur, action, entité, avant/après) + notifications métier ; PDF générés côté serveur sans chargement d'URL externes.

## Optimisation

- **Responsive mobile** : sous `md`, les 17 tableaux (13 listes paginées + 4 tableaux de détail) basculent automatiquement en **cartes compactes** — ligne de titre + actions à droite, puis paires `libellé : valeur` en petit texte (`src/components/shared/data-table.tsx`, double rendu CSS sans JS). Les barres de filtres, `PageHeader` et `Pagination` sont déjà mobile-first ; notifications et dashboards sont déjà en cartes.
- **Sidebar en grand écran** : 3 états persistés — dépliée (256 px), repliée en rail (68 px), masquée (bouton du bandeau).

- **Index PostgreSQL** (migration `phase8_indexes`) : `Order(createdAt)`, `Invoice(status, paidAt)`, `AuditLog(createdAt)`, `AuditLog(action, createdAt)` — utilisés par les rapports et le journal triés par date.
- **Code splitting frontend** : chaque page est chargée en `React.lazy` (fallback de chargement global) et les bibliothèques tierces sont extraites en vendor chunks (`vendor-react` 300 ko, `vendor-data` 174 ko, `vendor-radix` 108 ko) → bundle initial **838 ko → 110 ko**, plus aucun chunk > 500 ko.
- **Cache HTTP** : `no-store` sur l'API (données privées) ; **React Query** côté client (cache, déduplication, invalidation).
- **Stock** : verrous `SELECT ... FOR UPDATE` et écritures groupées dans une transaction unique (débit maximal, aucun dépassement).

## Scripts utiles

| Commande | Description |
|---|---|
| `npm run dev` | démarrage en mode développement (reload) |
| `npm run typecheck` | vérification TypeScript stricte |
| `npm run lint` | analyse ESLint (backend) / oxlint (frontend) |
| `npm run build` | compilation de production |
| `npm test` | tests automatisés (base `seduction_test` côté backend) |
| `npm run seed` | (re)jeu de données de démonstration |
| `npx prisma migrate dev --name <nom>` | nouvelle migration |

## État d'avancement

- [x] Phase 1 — Architecture, authentification, rôles, PostgreSQL, Prisma
- [x] Phase 2 — Articles, catégories, stocks physique/réservé, mouvements
- [x] Phase 3 — Commandes, workflow commercial, réservation du stock
- [x] Phase 4 — Facturation, PDF
- [x] Phase 5 — Magasin, sortie physique, historique
- [x] Phase 6 — Dispatcher, fiches de livraison, livreurs
- [x] Phase 7 — Dashboards, notifications, statistiques, audit
- [x] Phase 8 — Tests, sécurité, optimisation, documentation finale
