# Requêtes SDOL - Rapport Migration Bussigny

**Objectif**: Répondre aux questions du rapport de migration sur la structure et les données SDOL

---

## Situation

- **Base cible**: SDOL (postgres.hkd-geomatique.com)
- **Schéma**: `back_hkd_databy` (données Bussigny)
- **Problème**: Connexion uniquement depuis srv-fme (IP whitelist)
- **Solution**: Exécuter les requêtes depuis srv-fme

---

## 3 Questions à résoudre

### Question 1: Structure des tables EU (assainissement)

**Objectif**: Comprendre la structure exacte des tables SDOL pour mapper correctement depuis Oracle

**Tables concernées**:
- `eu_chambre` (chambres/regards)
- `eu_collecteur` (canalisations)
- `eu_grille` (avaloirs)

**Requête SQL**:
```sql
SELECT table_name, column_name, data_type, 
       character_maximum_length, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'back_hkd_databy' 
AND table_name IN ('eu_chambre', 'eu_collecteur', 'eu_grille')
ORDER BY table_name, ordinal_position;
```

**Informations recherchées**:
- Noms exacts des colonnes
- Types de données (integer, varchar, geometry, etc.)
- Longueurs maximales (VARCHAR(50) vs VARCHAR(255))
- Colonnes obligatoires (NOT NULL) vs optionnelles

**Utilisation**:
- Adapter les transformations FME
- Valider la compatibilité des types de données
- Identifier les conversions nécessaires

---

### Question 2: Valeurs de domaines existantes

**Objectif**: Vérifier les valeurs autorisées dans les champs à liste de valeurs (domaines)

**Champs à analyser**:

#### eu_chambre
- `contenu` (EU, EC, EP, MIXTE, etc.)
- `proprio` (Commune, Canton, Privé, etc.)
- `etat_constr` (En service, Hors service, Projet, etc.)
- `accessibilite` (Accessible, Non accessible, etc.)

#### eu_collecteur
- `contenu` (EU, EC, EP, MIXTE, etc.)
- `materiau` (PVC, Béton, Grès, etc.)
- `fonction` (Canalisation, Conduite, etc.)

**Requêtes SQL**:
```sql
-- eu_chambre domaines
SELECT DISTINCT contenu FROM back_hkd_databy.eu_chambre 
WHERE contenu IS NOT NULL ORDER BY contenu LIMIT 20;

SELECT DISTINCT proprio FROM back_hkd_databy.eu_chambre 
WHERE proprio IS NOT NULL ORDER BY proprio LIMIT 20;

SELECT DISTINCT etat_constr FROM back_hkd_databy.eu_chambre 
WHERE etat_constr IS NOT NULL ORDER BY etat_constr LIMIT 20;

SELECT DISTINCT accessibilite FROM back_hkd_databy.eu_chambre 
WHERE accessibilite IS NOT NULL ORDER BY accessibilite LIMIT 20;

-- eu_collecteur domaines
SELECT DISTINCT contenu FROM back_hkd_databy.eu_collecteur 
WHERE contenu IS NOT NULL ORDER BY contenu LIMIT 20;

SELECT DISTINCT materiau FROM back_hkd_databy.eu_collecteur 
WHERE materiau IS NOT NULL ORDER BY materiau LIMIT 20;

SELECT DISTINCT fonction FROM back_hkd_databy.eu_collecteur 
WHERE fonction IS NOT NULL ORDER BY fonction LIMIT 20;
```

**Utilisation**:
- Mapper les valeurs Oracle → SDOL (ex: "Eau usée" → "EU")
- Identifier les valeurs manquantes à créer
- Valider les listes de choix dans FME

---

### Question 3: Valeur data_owner utilisée

**Objectif**: Identifier le code commune utilisé dans SDOL pour Bussigny

**Hypothèses**:
- Code OFS: `5707`
- Code court: `VD0157` ou `BY`
- Nom complet: `Commune de Bussigny` ou `Bussigny`

**Tables à vérifier**:
- `eu_chambre` (assainissement)
- `eu_collecteur` (assainissement)
- `tp_bus_s` (transports publics)
- `mo_par` (mobilité - parcage)

**Requêtes SQL**:
```sql
SELECT DISTINCT data_owner FROM back_hkd_databy.eu_chambre LIMIT 10;
SELECT DISTINCT data_owner FROM back_hkd_databy.eu_collecteur LIMIT 10;
SELECT DISTINCT data_owner FROM back_hkd_databy.tp_bus_s LIMIT 10;
SELECT DISTINCT data_owner FROM back_hkd_databy.mo_par LIMIT 10;
```

**Utilisation**:
- Définir la valeur à insérer dans le champ `data_owner` lors de la migration
- S'assurer de la cohérence avec les autres tables SDOL
- Vérifier si plusieurs valeurs coexistent (communes multiples?)

---

## Procédure d'exécution

### Méthode 1: Script Python automatique (recommandé)

1. **Copier le script sur srv-fme**:
   ```
   C:\Users\zema\GeoBrain\temp\query_sdol_srv_fme.py
   → \srv-fme\c$\temp\query_sdol.py
   ```

2. **Exécuter depuis srv-fme** (PowerShell):
   ```powershell
   python C:\temp\query_sdol.py > C:\temp\resultats_sdol.txt
   ```

3. **Récupérer les résultats**:
   ```
   \srv-fme\c$\temp\resultats_sdol.txt
   → C:\Users\zema\GeoBrain\temp\resultats_sdol.txt
   ```

### Méthode 2: Requêtes manuelles via DBeaver

1. **Ouvrir DBeaver sur srv-fme**
2. **Connexion SDOL**:
   - Host: `postgres.hkd-geomatique.com`
   - Port: `5432`
   - Database: `sdol`
   - Schema: `back_hkd_databy`
   - User: `by_fme_w`
   - Password: `dsg#6hY95!`
3. **Copier-coller les requêtes SQL** ci-dessus
4. **Exporter les résultats** en CSV ou copier-coller

---

## Exploitation des résultats

Une fois les données récupérées, je pourrai:

1. **Compléter le rapport de migration** avec:
   - Structure exacte des tables cibles
   - Mapping précis des domaines Oracle → SDOL
   - Valeur `data_owner` à utiliser

2. **Identifier les points de blocage**:
   - Colonnes manquantes dans SDOL
   - Valeurs de domaine non supportées
   - Contraintes NOT NULL problématiques

3. **Préparer les questions pour HKD**:
   - Demandes de création de colonnes
   - Ajout de valeurs dans les domaines
   - Validation de la structure proposée

---

**Prochaine étape**: Exécuter les requêtes sur srv-fme et me transmettre les résultats.
