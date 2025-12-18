# Optimisation Claude Code pour GeoBrain

**Date** : 2025-12-18
**Objectif** : Maximiser l'efficacité de Claude Code (contexte, parallélisation, agents, MCP)

---

## 1. MAXIMISATION DU CONTEXTE

### 1.1 Fenêtre de contexte disponible

| Modèle | Contexte standard | Contexte étendu (beta) |
|--------|-------------------|------------------------|
| Claude Opus 4.5 | 200K tokens | - |
| Claude Sonnet 4 | 200K tokens | **1M tokens** (tier 4+) |
| Claude Haiku | 200K tokens | - |

**Source** : [Claude Sonnet 4 1M Context](https://www.infoq.com/news/2025/08/claude-sonnet-4/)

### 1.2 Stratégies d'optimisation du contexte

#### A. Context Editing (automatique)
Claude Code supprime automatiquement les résultats d'outils obsolètes quand le contexte se remplit.
- **Gain** : 84% de réduction des tokens
- **Performance** : +29% à +39% selon les tests

**Source** : [Managing context - Anthropic](https://anthropic.com/news/context-management)

#### B. CLAUDE.md optimisé
```markdown
## Fichiers à ignorer (réduire pollution contexte)
- node_modules/
- .git/
- *.log
- dist/
- build/

## Fichiers prioritaires (charger en premier)
- memory/*.md
- scripts/sql/*.sql (requêtes actives)
```

#### C. Désactiver MCP servers inutilisés
Chaque MCP server ajoute ~500-2000 tokens de définitions d'outils au contexte.

```bash
# Vérifier consommation contexte
/context

# Désactiver temporairement un MCP
claude mcp disable postgres
```

#### D. Délégation aux sub-agents
Les sub-agents ont leur **propre contexte isolé**. Déléguer = libérer le contexte principal.

| Tâche | Action | Gain contexte |
|-------|--------|---------------|
| Recherche fichiers | → Agent Explore | ~5-10K tokens |
| Analyse codebase | → Agent Explore | ~10-50K tokens |
| Tâche complexe | → Agent general-purpose | Variable |

**Source** : [Claude Code Best Practices - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)

#### E. Compression proactive
Après chaque grosse recherche, demander un résumé compact :

```
> Résume les résultats en 5 points clés maximum
```

#### F. Checkpoints réguliers
Sauvegarder l'état dans `memory/checkpoint.md` permet de :
- Redémarrer une session sans perte
- Libérer le contexte des détails passés
- Garder uniquement l'essentiel

---

## 2. PARALLÉLISATION ET AGENTS

### 2.1 Types d'agents disponibles

| Agent | Modèle | Usage | Outils |
|-------|--------|-------|--------|
| **Explore** | Haiku (rapide) | Recherche codebase | Glob, Grep, Read |
| **Plan** | Sonnet | Planification | Read, Glob, Grep |
| **general-purpose** | Sonnet | Tâches complexes | Tous |
| **claude-code-guide** | - | Documentation Claude Code | Web, Read |

### 2.2 Parallélisation multi-agents

**Technique 1 : Git Worktrees**
Permet de lancer plusieurs Claude Code sur le même repo.

```bash
# Créer un worktree
git worktree add ../geobrain-task1 -b feature/task1
git worktree add ../geobrain-task2 -b feature/task2

# Lancer Claude Code dans chaque worktree
cd ../geobrain-task1 && claude
cd ../geobrain-task2 && claude
```

**Technique 2 : Background agents**
```
> Use Task tool with run_in_background=true to analyze the database schema
```

**Technique 3 : Appels parallèles dans un seul message**
Envoyer plusieurs `Task` tool calls dans un seul message = exécution parallèle.

**Source** : [Parallelizing AI Coding Agents](https://ainativedev.io/news/how-to-parallelize-ai-coding-agents)

### 2.3 Agents personnalisés recommandés pour GeoBrain

Créer `.claude/agents/` avec :

**spatial-analyst.md** - Requêtes PostGIS/géospatiales
```markdown
---
name: spatial-analyst
description: Expert PostGIS et géodonnées. Utilise pour requêtes SQL spatiales, transformations SRID, validations géométriques.
tools: Read, Grep, Bash, Edit
model: sonnet
---

Expert SIG pour Bussigny. Standards : LV95 (SRID:2056), ASIT-VD.
Toujours valider ST_IsValid() et vérifier SRID avant transformation.
```

**fme-specialist.md** - ETL et workbenches
```markdown
---
name: fme-specialist
description: Expert FME. Utilise pour créer/modifier workbenches, pipelines ETL.
tools: Read, Write, Edit, Bash, Grep
model: sonnet
---

Expert FME pour transformations de données géospatiales.
Naming : INPUT_*, ACT_*, OUTPUT_*
```

**qgis-automation.md** - Scripts PyQGIS
```markdown
---
name: qgis-automation
description: Expert PyQGIS. Utilise pour scripts d'automatisation QGIS.
tools: Read, Write, Edit, Bash, Grep
model: sonnet
---

Expert PyQGIS. Code commenté et robuste.
```

---

## 3. MCP (MODEL CONTEXT PROTOCOL)

### 3.1 Qu'est-ce que MCP ?
Protocole standard permettant à Claude d'accéder à des outils externes (BDD, fichiers, APIs).

**Source** : [Claude Code MCP Docs](https://docs.claude.com/en/docs/claude-code/mcp)

### 3.2 MCP Servers recommandés

| Serveur | Usage | Installation |
|---------|-------|--------------|
| **PostgreSQL** | Requêtes BDD directes | `npx @modelcontextprotocol/server-postgres` |
| **Filesystem** | Navigation fichiers avancée | `npx @modelcontextprotocol/server-filesystem` |
| **Git** | Gestion Git enrichie | `npx @modelcontextprotocol/server-git` |
| **GitHub** | PRs, issues, reviews | HTTP server |

### 3.3 Configuration MCP pour GeoBrain

**Installation PostgreSQL MCP** :
```bash
claude mcp add postgres -s user -e DATABASE_URL="postgresql://user:pass@srv-fme:5432/Prod" -- npx -y @modelcontextprotocol/server-postgres
```

**Installation Filesystem MCP** :
```bash
claude mcp add filesystem -s user -- npx -y @modelcontextprotocol/server-filesystem "C:\Users\zema\GeoBrain" "C:\Users\zema\GeoBrain\scripts"
```

**Fichier `.mcp.json`** (racine projet) :
```json
{
  "mcpServers": {
    "postgres-bussigny": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@srv-fme:5432/Prod"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\Users\\zema\\GeoBrain"]
    }
  }
}
```

**Vérification** :
```bash
claude mcp list
/mcp  # Dans Claude Code
```

**Source** : [Docker MCP Toolkit](https://www.docker.com/blog/add-mcp-servers-to-claude-code-with-mcp-toolkit/)

---

## 4. HOOKS ET AUTOMATISATION

### 4.1 Hooks disponibles

| Hook | Timing | Usage |
|------|--------|-------|
| PreToolUse | Avant outil | Validation, logging, blocage |
| PostToolUse | Après outil | Formatage, notifications |
| SessionStart | Démarrage | Setup environnement |
| SessionEnd | Fermeture | Cleanup, sauvegarde |

### 4.2 Hooks recommandés

**`.claude/settings.json`** :
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "python -c \"import sys,json; d=json.load(sys.stdin); p=d.get('tool_input',{}).get('file_path',''); sys.exit(2 if '.env' in p or 'secret' in p else 0)\""
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [{
          "type": "command",
          "command": "echo 'File edited: %FILE_PATH%' >> .claude/audit.log"
        }]
      }
    ]
  }
}
```

---

## 5. CONFIGURATION COMPLÈTE RECOMMANDÉE

### 5.1 Structure de dossiers

```
C:\Users\zema\GeoBrain\
├── CLAUDE.md                    # Instructions principales
├── .mcp.json                    # Config MCP (partagée équipe)
├── .claude/
│   ├── settings.json            # Config projet
│   ├── settings.local.json      # Config locale (ignoré git)
│   ├── agents/
│   │   ├── spatial-analyst.md
│   │   ├── fme-specialist.md
│   │   └── qgis-automation.md
│   ├── commands/
│   │   ├── checkpoint.md        # /checkpoint
│   │   ├── memorise.md          # /memorise
│   │   └── recap.md             # /recap
│   └── rules/
│       ├── postgis-standards.md
│       └── security.md
└── memory/
    ├── context.md
    ├── personality.md
    ├── sessions.md
    ├── corrections.md
    └── checkpoint.md
```

### 5.2 `.claude/settings.json` complet

```json
{
  "model": "claude-opus-4-5-20251101",
  "permissions": {
    "allow": [
      "Bash(git:*)",
      "Bash(python:*)",
      "Bash(pip:*)",
      "Read(scripts/**)",
      "Read(memory/**)",
      "Edit(scripts/**)",
      "Edit(memory/**)",
      "Edit(projets/**)"
    ],
    "deny": [
      "Read(.env*)",
      "Read(**/secrets/**)",
      "Bash(rm -rf:*)"
    ]
  },
  "env": {
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "16000",
    "MAX_MCP_OUTPUT_TOKENS": "100000",
    "GDAL_DATA": "C:\\OSGeo4W\\share\\gdal",
    "QGIS_PREFIX_PATH": "C:\\Program Files\\QGIS 3.34"
  }
}
```

### 5.3 Variables d'environnement clés

| Variable | Valeur | Effet |
|----------|--------|-------|
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | 16000 | Limite réponses (évite contexte surchargé) |
| `MAX_MCP_OUTPUT_TOKENS` | 100000 | Augmente limite MCP pour grosses requêtes |
| `ANTHROPIC_MODEL` | claude-opus-4-5-20251101 | Modèle par défaut |

---

## 6. BONNES PRATIQUES QUOTIDIENNES

### 6.1 Début de session
1. Claude lit automatiquement `memory/*.md`
2. Vérifier `/mcp` que les serveurs sont connectés
3. Utiliser `/context` pour voir l'état du contexte

### 6.2 Pendant la session
- **Tâche simple** → Exécution directe
- **Recherche codebase** → `Task` avec `Explore` agent
- **Tâche complexe multi-fichiers** → `Task` avec `Plan` agent d'abord
- **Toutes les 30min** → `/checkpoint` pour sauvegarder

### 6.3 Optimisation contexte en cours de session
```
> Résume les 10 derniers échanges en 5 points clés
> Compresse le contexte des recherches précédentes
```

### 6.4 Fin de session
```
/checkpoint  # Sauvegarde état
```

---

## 7. CHECKLIST D'IMPLÉMENTATION

### Phase 1 - Structure (10 min)
- [ ] Créer `.claude/agents/` avec 3 agents
- [ ] Créer `.claude/commands/` pour slash commands
- [ ] Créer `.claude/rules/` pour standards

### Phase 2 - Configuration (10 min)
- [ ] Créer `.claude/settings.json`
- [ ] Créer `.mcp.json`

### Phase 3 - MCP Servers (15 min)
- [ ] Installer PostgreSQL MCP
- [ ] Installer Filesystem MCP
- [ ] Tester avec `/mcp`

### Phase 4 - Test (10 min)
- [ ] Tester agent Explore sur recherche
- [ ] Tester agent personnalisé
- [ ] Vérifier contexte avec `/context`

---

## 8. SOURCES

- [Claude Code Best Practices - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Parallelizing AI Coding Agents](https://ainativedev.io/news/how-to-parallelize-ai-coding-agents)
- [Claude Code MCP Docs](https://docs.claude.com/en/docs/claude-code/mcp)
- [Docker MCP Toolkit](https://www.docker.com/blog/add-mcp-servers-to-claude-code-with-mcp-toolkit/)
- [Managing Context - Anthropic](https://anthropic.com/news/context-management)
- [How to Optimize Token Usage](https://claudelog.com/faqs/how-to-optimize-claude-code-token-usage/)
- [Simon Willison - Parallel Coding Agents](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- [Complete Claude Code Setup Guide](https://www.maxzilla.nl/blog/claude-code-environment-best-practices)
