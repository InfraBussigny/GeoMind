# -*- coding: utf-8 -*-
"""
Modification du projet QGIS pour utiliser la vue v_ass_collecteur_inspection
et simplifier la symbologie basée sur les années d'inspection.
"""
import re

INPUT_FILE = r"C:\Users\zema\GeoBrain\temp\qgis_inspection\Ass_Collecteurs_Inspection.qgs"
OUTPUT_FILE = r"C:\Users\zema\GeoBrain\temp\qgis_inspection\Ass_Collecteurs_Inspection_v2.qgs"

# Lire le fichier
with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Fichier lu: {len(content)} caractères")

# 1. Remplacer la table par la vue pour les couches collecteur
# Pattern: table="assainissement"."by_ass_collecteur"
old_table = 'table=&quot;assainissement&quot;.&quot;by_ass_collecteur&quot;'
new_table = 'table=&quot;assainissement&quot;.&quot;v_ass_collecteur_inspection&quot;'

count_table = content.count(old_table)
content = content.replace(old_table, new_table)
print(f"Remplacement table: {count_table} occurrences")

# 2. Simplifier les règles de symbologie
# Ancienne logique complexe:
# if("date_inspection_2" Is not null, year("date_inspection_2") = '2023', year("date_inspection_1") = '2023')
# Nouvelle logique simple:
# "annee_derniere_inspection" = 2023

# Pattern pour les années
years = ['2013', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025']

for year in years:
    old_filter = f'if(  &quot;date_inspection_2&quot;  Is not null, year( &quot;date_inspection_2&quot; ) = \'{year}\', year( &quot;date_inspection_1&quot; ) = \'{year}\')'
    new_filter = f'&quot;annee_derniere_inspection&quot; = {year}'

    count = content.count(old_filter)
    if count > 0:
        content = content.replace(old_filter, new_filter)
        print(f"  Année {year}: {count} remplacements")

# 3. Simplifier la règle "Non inspecté"
# Ancienne: "date_inspection_1" IS NULL
# Nouvelle: "nb_inspections" = 0
old_non_inspecte = '&quot;date_inspection_1&quot;  IS NULL'
new_non_inspecte = '&quot;nb_inspections&quot; = 0'
count_ni = content.count(old_non_inspecte)
content = content.replace(old_non_inspecte, new_non_inspecte)
print(f"Règle 'Non inspecté': {count_ni} remplacements")

# 4. Mettre à jour le nom du projet dans les métadonnées
content = content.replace(
    'saveUserFull="FRETZ Jennifer"',
    'saveUserFull="GeoBrain (modifié)"'
)

# Écrire le fichier modifié
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nFichier modifié sauvegardé: {OUTPUT_FILE}")
print("Modifications appliquées:")
print("  - Source de données: by_ass_collecteur → v_ass_collecteur_inspection")
print("  - Symbologie: utilise annee_derniere_inspection au lieu de la logique if/else")
print("  - Règle 'Non inspecté': utilise nb_inspections = 0")
