# GeoMind - Spatial Intelligence

Application desktop personnalisée pour le SIT de la commune de Bussigny.

## Technologies

- **Frontend** : SvelteKit 5 + TypeScript
- **Backend** : Tauri 2 (Rust)
- **Style** : CSS personnalisé - Charte graphique Bussigny

## Fonctionnalités

### 💬 Assistant Chat
- Interface de conversation avec l'IA
- Suggestions contextuelles
- Historique des messages

### 🗺️ Visualisation Carte
- Affichage de couches WMS/WFS
- Outils de mesure et dessin
- Gestion des couches

### 📝 Éditeur de Code
- Coloration syntaxique SQL/Python
- Exécution de requêtes
- Panneau de résultats

### 📄 Génération de Documents
- Templates PDF (PV, notes, rapports)
- Charte graphique Bussigny automatique
- Documents récents

### 📧 Communications
Module intégré pour la productivité bureautique :

**Microsoft 365 (Outlook)**
- Emails : lecture, envoi, marquer lu/non-lu
- Calendrier : événements, création de rendez-vous
- Teams : création de réunions en ligne

**3CX Téléphonie**
- Appels : émettre, terminer, hold, transfert
- Historique des appels
- Statut de l'extension (disponible, occupé, absent)

**Google Workspace**
- Google Calendar : événements, création
- Google Meet : création de réunions

**WhatsApp**
- Mode webview intégré pour WhatsApp Web personnel

**Notifications**
- Agrégation des notifications de toutes les sources
- Badge de notifications non lues

## Installation

```bash
# Installer les dépendances
npm install

# Lancer en mode développement
npm run tauri:dev

# Compiler l'application
npm run tauri:build
```

## Structure

```
geomind-app/
├── src/
│   ├── lib/
│   │   ├── components/     # Composants Svelte
│   │   │   ├── Chat/
│   │   │   ├── Canvas/
│   │   │   ├── Editor/
│   │   │   ├── DocGen/
│   │   │   └── CommunicationsPanel.svelte
│   │   ├── services/       # Services API
│   │   │   └── communications.ts
│   │   ├── stores/         # État global (Svelte stores)
│   │   └── styles/         # CSS (theme.css)
│   └── routes/             # Pages SvelteKit
├── server/                 # Backend Node.js
│   ├── index.js            # Serveur Express principal
│   ├── microsoft-graph.js  # API Microsoft Graph (Outlook/Teams)
│   ├── threecx-api.js      # API 3CX téléphonie
│   ├── google-calendar.js  # API Google Calendar/Meet
│   └── communications-routes.js
├── src-tauri/              # Backend Rust (Tauri)
└── static/                 # Assets statiques
```

## Charte graphique

| Élément | Couleur |
|---------|---------|
| Bleu Bussigny | #366092 |
| Gris foncé | #444444 |
| Gris moyen | #666666 |
| Succès | #27ae60 |
| Alerte | #e67e22 |
| Erreur | #c0392b |

## Développement

- **Port dev** : http://localhost:5173
- **Build output** : `src-tauri/target/release/`

---

*Développé pour le Service des Infrastructures - Commune de Bussigny*
