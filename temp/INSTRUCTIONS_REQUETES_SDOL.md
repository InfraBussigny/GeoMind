# Instructions - Requêtes SDOL pour rapport migration

**Date**: 18 décembre 2025  
**Contexte**: Analyse de la structure SDOL pour compléter le rapport de migration

## Connexion impossible depuis ce poste

La base SDOL (`postgres.hkd-geomatique.com`) n'accepte les connexions que depuis l'IP de **srv-fme** (whitelist).

## Solution: Exécuter le script sur srv-fme

### Étape 1: Copier le script sur srv-fme

Le script est disponible ici:
```
C:\Users\zema\GeoBrain\temp\query_sdol_srv_fme.py
```

**Copie vers srv-fme:**
- Via réseau: `\srv-fme\c$\temp\query_sdol.py`
- Ou via RDP si nécessaire

### Étape 2: Exécuter sur srv-fme

Ouvrir une session PowerShell sur srv-fme et exécuter:

```powershell
python C:\temp\query_sdol.py > C:\temp\resultats_sdol.txt
```

Ou si Python 3 explicitement:
```powershell
python3 C:\temp\query_sdol.py > C:\temp\resultats_sdol.txt
```

### Étape 3: Récupérer les résultats

Copier le fichier résultat:
```
\srv-fme\c$\temp\resultats_sdol.txt
```

Vers:
```
C:\Users\zema\GeoBrain\temp\resultats_sdol.txt
```

## Contenu des requêtes

### Question 1: Structure tables EU (assainissement)
- Liste colonnes de `eu_chambre`, `eu_collecteur`, `eu_grille`
- Types de données, longueur max, nullable

### Question 2: Valeurs de domaines existantes
- `eu_chambre`: contenu, proprio, etat_constr, accessibilite
- `eu_collecteur`: contenu, materiau, fonction
- Limite 20 valeurs distinctes par champ

### Question 3: Valeur data_owner utilisée
- Dans `eu_chambre`, `eu_collecteur`, `tp_bus_s`, `mo_par`
- Permet de valider quel code commune est utilisé

## Alternative: Connexion manuelle via DBeaver

Si besoin de requêtes supplémentaires:

1. Ouvrir DBeaver sur srv-fme
2. Se connecter à SDOL:
   - Host: `postgres.hkd-geomatique.com`
   - Port: `5432`
   - Database: `sdol`
   - Schema: `back_hkd_databy`
   - User: `by_fme_w`
   - Password: `dsg#6hY95!`
3. Exécuter les requêtes SQL manuellement

## Requêtes SQL brutes

### Question 1
```sql
SELECT table_name, column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'back_hkd_databy' 
AND table_name IN ('eu_chambre', 'eu_collecteur', 'eu_grille')
ORDER BY table_name, ordinal_position;
```

### Question 2
```sql
-- eu_chambre domaines
SELECT DISTINCT contenu FROM back_hkd_databy.eu_chambre WHERE contenu IS NOT NULL ORDER BY contenu LIMIT 20;
SELECT DISTINCT proprio FROM back_hkd_databy.eu_chambre WHERE proprio IS NOT NULL ORDER BY proprio LIMIT 20;
SELECT DISTINCT etat_constr FROM back_hkd_databy.eu_chambre WHERE etat_constr IS NOT NULL ORDER BY etat_constr LIMIT 20;
SELECT DISTINCT accessibilite FROM back_hkd_databy.eu_chambre WHERE accessibilite IS NOT NULL ORDER BY accessibilite LIMIT 20;

-- eu_collecteur domaines
SELECT DISTINCT contenu FROM back_hkd_databy.eu_collecteur WHERE contenu IS NOT NULL ORDER BY contenu LIMIT 20;
SELECT DISTINCT materiau FROM back_hkd_databy.eu_collecteur WHERE materiau IS NOT NULL ORDER BY materiau LIMIT 20;
SELECT DISTINCT fonction FROM back_hkd_databy.eu_collecteur WHERE fonction IS NOT NULL ORDER BY fonction LIMIT 20;
```

### Question 3
```sql
SELECT DISTINCT data_owner FROM back_hkd_databy.eu_chambre LIMIT 10;
SELECT DISTINCT data_owner FROM back_hkd_databy.eu_collecteur LIMIT 10;
SELECT DISTINCT data_owner FROM back_hkd_databy.tp_bus_s LIMIT 10;
SELECT DISTINCT data_owner FROM back_hkd_databy.mo_par LIMIT 10;
```

---

**Note**: Une fois les résultats obtenus, je pourrai les analyser et compléter le rapport de migration.
