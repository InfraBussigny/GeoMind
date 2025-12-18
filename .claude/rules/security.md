---
paths: **/*
---

# Securite et Credentials

## Fichiers a proteger
- Chaines connexion base de donnees
- Cles API services web
- Tokens acces personnels (GitHub, etc)
- Cles SSH ou credentials

## Ne jamais commiter
- Fichiers .env ou .env.*
- Contenu repertoire secrets/
- Fichiers credentials avec mots de passe

## Bonnes pratiques
- Utiliser variables environnement pour secrets
- Referencer .env dans .gitignore
- Documenter ou obtenir credentials (wiki)
