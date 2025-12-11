"""
Script de géoréférencement automatique des plans de servitudes
Parcelle 791 - Chemin du Cèdre 35, Bussigny

Ce script:
1. Convertit les PDF en images PNG
2. Crée des fichiers world (.pgw) pour le géoréférencement
3. Génère des GeoJSON avec les emprises vectorisées des servitudes
"""

import os
import json
import fitz  # PyMuPDF
from PIL import Image

# Configuration du projet
PROJECT_DIR = r"C:\Users\zema\GeoBrain\projets\servitudes_791"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "georef")

# Coordonnées de référence MN95 (EPSG:2056)
# Basées sur l'analyse des plans et la position connue de la parcelle 791
# Chemin du Cèdre 35 est approximativement à:
# Centre parcelle 791: E 2533100, N 1155450

# Points de calage estimés pour chaque plan
PLANS_CALAGE = {
    "2001_003598": {
        # Plan 3 pages, échelle 1:500 et 1:1000
        # Page 2 montre bien la parcelle 791
        "echelle": 500,
        "centre_x": 2533100,
        "centre_y": 1155480,
        "rotation": 0,
        "pages": [1, 2, 3],  # 0-indexed: pages 2 et 3 sont les plus utiles
        "description": "Passage Lavanchy - tracé jaune"
    },
    "2002_004259": {
        # Plan échelle 1:500, canalisations eau/égout
        "echelle": 500,
        "centre_x": 2533050,
        "centre_y": 1155420,
        "rotation": 180,  # Plan orienté au sud
        "pages": [0],
        "description": "Canalisations - tracé bleu/rouge"
    },
    "2003_001959": {
        # Plan échelle 1:500, passage vers 757
        "echelle": 500,
        "centre_x": 2533080,
        "centre_y": 1155450,
        "rotation": 0,
        "pages": [0],
        "description": "Passage pied/char vers 757 - tracé jaune"
    },
    "2003_003622": {
        # Plan échelle 1:500, passage à pied sur 1615
        "echelle": 500,
        "centre_x": 2533100,
        "centre_y": 1155430,
        "rotation": 0,
        "pages": [0],
        "description": "Passage à pied sur 1615"
    },
    "2013_002286": {
        # Plan cadastral moderne, échelle 1:500
        "echelle": 500,
        "centre_x": 2533150,
        "centre_y": 1155500,
        "rotation": 0,
        "pages": [0],
        "description": "Passage vers 3417 - tracé bleu"
    }
}

# Emprises des servitudes vectorisées (GeoJSON)
# Coordonnées MN95 approximatives basées sur l'analyse visuelle des plans
SERVITUDES_GEOJSON = {
    "type": "FeatureCollection",
    "name": "servitudes_791",
    "crs": {
        "type": "name",
        "properties": {"name": "urn:ogc:def:crs:EPSG::2056"}
    },
    "features": [
        # Servitude 010-2001/003598 - Passage Lavanchy (jaune)
        # Chemin principal traversant le quartier
        {
            "type": "Feature",
            "properties": {
                "id_servitude": "010-2001/003598",
                "type": "Passage pied, véhicules, canalisations",
                "date_creation": "1940-10-31",
                "role_791": "beneficiaire",
                "fonds_servant": "753, 762, 763, 790, 791, 792, 793, 795, 805, 856, 1671, 1672, 1673, 1799, 1936",
                "fonds_dominant": "Réciproque quartier Lavanchy",
                "couleur_plan": "jaune"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    # Tracé approximatif du passage jaune (chemin Lavanchy)
                    [2532950, 1155350],
                    [2532960, 1155350],
                    [2533000, 1155400],
                    [2533050, 1155450],
                    [2533100, 1155500],
                    [2533150, 1155550],
                    [2533200, 1155600],
                    [2533250, 1155650],
                    [2533240, 1155660],
                    [2533190, 1155610],
                    [2533140, 1155560],
                    [2533090, 1155510],
                    [2533040, 1155460],
                    [2532990, 1155410],
                    [2532950, 1155360],
                    [2532950, 1155350]
                ]]
            }
        },
        # Servitude 010-2002/004259 - Canalisations eau/égout
        {
            "type": "Feature",
            "properties": {
                "id_servitude": "010-2002/004259",
                "type": "Canalisations eau/égout",
                "date_creation": "1955-06-16",
                "role_791": "servant",
                "fonds_servant": "746, 747, 791, 792, 807, 809, 810, 1615, 1626, 1757",
                "fonds_dominant": "Commune de Bussigny",
                "couleur_plan": "bleu/rouge",
                "type_cana": "mixte"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    # Tracé des canalisations traversant la parcelle 791
                    [2532900, 1155380],
                    [2532950, 1155400],
                    [2533000, 1155420],
                    [2533050, 1155440],
                    [2533100, 1155450],
                    [2533150, 1155460],
                    [2533200, 1155480]
                ]
            }
        },
        # Servitude 010-2003/001959 - Passage vers 757
        {
            "type": "Feature",
            "properties": {
                "id_servitude": "010-2003/001959",
                "type": "Passage pied et char",
                "date_creation": "1912-06-29",
                "role_791": "servant",
                "fonds_servant": "791, 1615",
                "fonds_dominant": "757",
                "couleur_plan": "jaune"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    # Accès depuis le nord-ouest vers parcelle 757
                    [2533020, 1155480],
                    [2533030, 1155480],
                    [2533030, 1155520],
                    [2533050, 1155540],
                    [2533040, 1155550],
                    [2533020, 1155530],
                    [2533020, 1155480]
                ]]
            }
        },
        # Servitude 010-2003/003622 - Passage à pied sur 1615
        {
            "type": "Feature",
            "properties": {
                "id_servitude": "010-2003/003622",
                "type": "Passage à pied",
                "date_creation": "1934-07-14",
                "role_791": "beneficiaire",
                "fonds_servant": "1615",
                "fonds_dominant": "791",
                "couleur_plan": "surface entière",
                "note": "S'exerce sur toute la surface du fonds servant 1615"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    # Emprise parcelle 1615 (approximative)
                    [2533040, 1155340],
                    [2533180, 1155340],
                    [2533180, 1155380],
                    [2533040, 1155380],
                    [2533040, 1155340]
                ]]
            }
        },
        # Servitude 007-2013/002286 - Passage vers 3417
        {
            "type": "Feature",
            "properties": {
                "id_servitude": "007-2013/002286",
                "type": "Passage pied et véhicules",
                "date_creation": "2013-07-30",
                "role_791": "servant",
                "fonds_servant": "791, 1615",
                "fonds_dominant": "3417",
                "couleur_plan": "bleu"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    # Tracé bleu vers parcelle 3417 (visible sur plan 2013)
                    [2533060, 1155460],
                    [2533080, 1155460],
                    [2533100, 1155500],
                    [2533120, 1155540],
                    [2533100, 1155550],
                    [2533080, 1155510],
                    [2533060, 1155470],
                    [2533060, 1155460]
                ]]
            }
        },
        # Servitude 007-2013/002287 - Canalisations vers 3417 (non définie)
        {
            "type": "Feature",
            "properties": {
                "id_servitude": "007-2013/002287",
                "type": "Canalisations quelconques",
                "date_creation": "2013-07-30",
                "role_791": "servant",
                "fonds_servant": "791",
                "fonds_dominant": "3417",
                "couleur_plan": "non défini",
                "note": "Assiette non encore définie selon extrait RF"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    # Tracé indicatif (à définir)
                    [2533080, 1155460],
                    [2533110, 1155520]
                ]
            }
        }
    ]
}

# Parcelle 791 elle-même (approximative)
PARCELLE_791 = {
    "type": "Feature",
    "properties": {
        "numero": 791,
        "adresse": "Chemin du Cèdre 35",
        "commune": "Bussigny",
        "type": "parcelle_sujet"
    },
    "geometry": {
        "type": "Polygon",
        "coordinates": [[
            [2533040, 1155400],
            [2533160, 1155400],
            [2533160, 1155480],
            [2533040, 1155480],
            [2533040, 1155400]
        ]]
    }
}


def pdf_to_png(pdf_path, output_dir, dpi=150):
    """Convertit un PDF en images PNG"""

    doc = fitz.open(pdf_path)
    images = []

    basename = os.path.splitext(os.path.basename(pdf_path))[0]

    for page_num in range(len(doc)):
        page = doc[page_num]

        # Matrice de zoom pour la résolution
        zoom = dpi / 72
        mat = fitz.Matrix(zoom, zoom)

        # Rendu de la page
        pix = page.get_pixmap(matrix=mat)

        # Nom du fichier de sortie
        if len(doc) > 1:
            output_path = os.path.join(output_dir, f"{basename}_page{page_num + 1}.png")
        else:
            output_path = os.path.join(output_dir, f"{basename}.png")

        pix.save(output_path)
        images.append({
            "path": output_path,
            "width": pix.width,
            "height": pix.height,
            "page": page_num
        })

        print(f"  Créé: {os.path.basename(output_path)} ({pix.width}x{pix.height})")

    doc.close()
    return images


def create_world_file(image_info, plan_config, output_path):
    """
    Crée un fichier world (.pgw) pour géoréférencer l'image

    Format du fichier world:
    - Ligne 1: taille du pixel en X (échelle)
    - Ligne 2: rotation Y
    - Ligne 3: rotation X
    - Ligne 4: taille du pixel en Y (négatif car Y va vers le bas)
    - Ligne 5: coordonnée X du centre du pixel en haut à gauche
    - Ligne 6: coordonnée Y du centre du pixel en haut à gauche
    """

    width = image_info["width"]
    height = image_info["height"]

    # Calculer la taille du pixel en mètres
    # Pour un plan 1:500, 1 cm sur le plan = 5 m sur le terrain
    # À 150 DPI, 1 pixel = 25.4/150 = 0.169 mm
    # Donc 1 pixel = 0.169 * (echelle/1000) mètres

    echelle = plan_config["echelle"]
    dpi = 150
    pixel_size_mm = 25.4 / dpi
    pixel_size_m = pixel_size_mm * echelle / 1000

    # Coordonnées du centre de l'image
    centre_x = plan_config["centre_x"]
    centre_y = plan_config["centre_y"]

    # Calculer le coin supérieur gauche
    # (en tenant compte que Y est inversé dans les images)
    top_left_x = centre_x - (width / 2) * pixel_size_m
    top_left_y = centre_y + (height / 2) * pixel_size_m

    # Gérer la rotation si nécessaire
    rotation = plan_config.get("rotation", 0)

    if rotation == 0:
        # Pas de rotation
        world_content = f"""{pixel_size_m:.10f}
0.0000000000
0.0000000000
{-pixel_size_m:.10f}
{top_left_x:.4f}
{top_left_y:.4f}
"""
    elif rotation == 180:
        # Rotation 180° (plan orienté au sud)
        world_content = f"""{-pixel_size_m:.10f}
0.0000000000
0.0000000000
{pixel_size_m:.10f}
{centre_x + (width / 2) * pixel_size_m:.4f}
{centre_y - (height / 2) * pixel_size_m:.4f}
"""
    else:
        # Rotation quelconque (à implémenter si nécessaire)
        import math
        rad = math.radians(rotation)
        cos_r = math.cos(rad)
        sin_r = math.sin(rad)

        world_content = f"""{pixel_size_m * cos_r:.10f}
{pixel_size_m * sin_r:.10f}
{-pixel_size_m * sin_r:.10f}
{-pixel_size_m * cos_r:.10f}
{top_left_x:.4f}
{top_left_y:.4f}
"""

    with open(output_path, 'w') as f:
        f.write(world_content)

    print(f"  World file: {os.path.basename(output_path)}")
    print(f"    Échelle: 1:{echelle}, Pixel: {pixel_size_m:.4f}m")
    print(f"    Centre: E {centre_x}, N {centre_y}")


def create_prj_file(output_path):
    """Crée un fichier .prj avec la définition du CRS MN95"""

    prj_content = """PROJCS["CH1903+_LV95",GEOGCS["GCS_CH1903+",DATUM["D_CH1903+",SPHEROID["Bessel_1841",6377397.155,299.1528128]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Hotine_Oblique_Mercator_Azimuth_Center"],PARAMETER["False_Easting",2600000.0],PARAMETER["False_Northing",1200000.0],PARAMETER["Scale_Factor",1.0],PARAMETER["Azimuth",90.0],PARAMETER["Longitude_Of_Center",7.439583333333333],PARAMETER["Latitude_Of_Center",46.95240555555556],UNIT["Meter",1.0]]"""

    with open(output_path, 'w') as f:
        f.write(prj_content)


def save_geojson(data, filepath):
    """Sauvegarde un GeoJSON"""

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"GeoJSON sauvegardé: {os.path.basename(filepath)}")


def main():
    """Fonction principale"""

    print("=" * 70)
    print("GÉORÉFÉRENCEMENT AUTOMATIQUE DES PLANS DE SERVITUDES")
    print("Parcelle 791 - Chemin du Cèdre 35, Bussigny")
    print("=" * 70)

    # Créer le répertoire de sortie
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Convertir les PDF en PNG et créer les fichiers world
    print("\n1. CONVERSION DES PLANS PDF EN IMAGES GÉORÉFÉRENCÉES")
    print("-" * 50)

    for plan_name, config in PLANS_CALAGE.items():
        pdf_path = os.path.join(PROJECT_DIR, f"{plan_name}.pdf")

        if not os.path.exists(pdf_path):
            print(f"\n[!] Plan non trouve: {plan_name}.pdf")
            continue

        print(f"\n[PLAN] {plan_name}.pdf - {config['description']}")

        # Convertir en PNG
        images = pdf_to_png(pdf_path, OUTPUT_DIR, dpi=150)

        # Créer les fichiers world pour les pages pertinentes
        for img in images:
            page_num = img["page"]

            # Fichier world (.pgw pour PNG)
            world_path = img["path"].replace('.png', '.pgw')
            create_world_file(img, config, world_path)

            # Fichier PRJ
            prj_path = img["path"].replace('.png', '.prj')
            create_prj_file(prj_path)

    # 2. Sauvegarder les servitudes vectorisées
    print("\n2. CRÉATION DES COUCHES VECTORIELLES")
    print("-" * 50)

    # GeoJSON des servitudes
    servitudes_path = os.path.join(OUTPUT_DIR, "servitudes_791.geojson")
    save_geojson(SERVITUDES_GEOJSON, servitudes_path)

    # GeoJSON de la parcelle 791
    parcelle_geojson = {
        "type": "FeatureCollection",
        "name": "parcelle_791",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:EPSG::2056"}
        },
        "features": [PARCELLE_791]
    }
    parcelle_path = os.path.join(OUTPUT_DIR, "parcelle_791.geojson")
    save_geojson(parcelle_geojson, parcelle_path)

    # Séparer les servitudes par type
    passages = [f for f in SERVITUDES_GEOJSON["features"]
                if "Passage" in f["properties"]["type"] or "passage" in f["properties"]["type"].lower()]
    canalisations = [f for f in SERVITUDES_GEOJSON["features"]
                     if "Canalisation" in f["properties"]["type"]]

    passages_geojson = {
        "type": "FeatureCollection",
        "name": "servitudes_passage",
        "crs": SERVITUDES_GEOJSON["crs"],
        "features": passages
    }
    save_geojson(passages_geojson, os.path.join(OUTPUT_DIR, "servitudes_passage.geojson"))

    cana_geojson = {
        "type": "FeatureCollection",
        "name": "servitudes_canalisations",
        "crs": SERVITUDES_GEOJSON["crs"],
        "features": canalisations
    }
    save_geojson(cana_geojson, os.path.join(OUTPUT_DIR, "servitudes_canalisations.geojson"))

    # 3. Résumé
    print("\n" + "=" * 70)
    print("RÉSUMÉ")
    print("=" * 70)
    print(f"""
Fichiers créés dans: {OUTPUT_DIR}

📷 IMAGES GÉORÉFÉRENCÉES:
   - Plans PNG avec fichiers .pgw (world) et .prj (CRS)
   - Peuvent être chargés directement dans QGIS

📍 COUCHES VECTORIELLES (GeoJSON):
   - servitudes_791.geojson (toutes les servitudes)
   - servitudes_passage.geojson (4 servitudes de passage)
   - servitudes_canalisations.geojson (2 servitudes de canalisations)
   - parcelle_791.geojson (emprise de la parcelle sujet)

⚠️ IMPORTANT:
   Les coordonnées sont APPROXIMATIVES basées sur l'analyse visuelle.
   Pour un plan officiel, il faudra:
   1. Affiner le calage des images dans QGIS
   2. Ajuster les géométries des servitudes selon les plans originaux
   3. Valider avec le cadastre officiel
    """)

    return True


if __name__ == "__main__":
    main()
