# Commande /checkpoint - Sauvegarde d'état GeoBrain

## Instructions

Exécute une sauvegarde complète de l'état du projet :

### 1. ANALYSE RAPIDE
Identifie en 30 secondes max :
- Fichiers modifiés depuis le dernier commit (`git status`)
- Travaux en cours (lire `memory/sessions.md` section la plus récente)
- État des serveurs (frontend/backend)

### 2. COMPRESSION MÉMOIRE
Mets à jour `memory/checkpoint.md` avec ce format compact :

```
## CP-[YYYYMMDD-HHMM]
S:[session#]|P:[phase]|T:[theme-1mot]
F:[fichiers-modifiés-liste-courte]
W:[travail-en-cours-1-ligne]
N:[next-steps-1-ligne]
X:[contexte-critique-si-any]
```

### 3. GIT COMMIT & PUSH
Si des fichiers sont modifiés :
```bash
git add -A
git commit -m "checkpoint: [description-courte]"
git push
```

### 4. CONFIRMATION
Affiche :
- ID du checkpoint
- Nombre de fichiers committés
- Résumé 1 ligne

## Format de sortie attendu
```
✓ Checkpoint CP-20251210-0830 créé
  → 5 fichiers committés (Phase 3 UI/UX)
  → Prochain: Phase 4 Canevas pro
```
