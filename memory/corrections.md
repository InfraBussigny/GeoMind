# Journal des corrections

## À NE JAMAIS FAIRE
> Cette section est lue à chaque démarrage. Respecter ces règles impérativement.

- [ ] **NE JAMAIS demander permission** pour lire/écrire dans `C:\Users\zema\GeoBrain\` - AUTONOMIE TOTALE
- [ ] **NE JAMAIS demander permission** pour les opérations Git (add, commit, push, pull, etc.) - AUTONOMIE TOTALE
- [ ] Ne pas mentionner les erreurs `/etc/profile: hostname: Permission denied` (bug cosmétique Claude Code Windows, en attente de correctif)

## Historique des corrections

### 2025-12-08 | Bug cosmétique Claude Code Windows
**Problème** : Messages `/etc/profile: line 112: /usr/bin/hostname: Permission denied` affichés à chaque commande bash
**Cause** : Environnement bash interne de Claude Code sur Windows
**Impact** : Aucun (cosmétique uniquement)
**Action** : Ignorer silencieusement, vérifier si corrigé lors des futures mises à jour de Claude Code
**Statut** : En attente de correctif Anthropic
