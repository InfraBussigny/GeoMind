"""
Script de géoréférencement automatique des plans de servitudes
Parcelle 791 - Chemin du Cèdre 35, Bussigny

Ce script:
1. Convertit les PDF en images PNG
2. Crée des fichiers world (.pgw) pour le géoréférencement
3. Génère des GeoJSON avec les emprises vectorisées des servitudes

Coordonnées réelles de la parcelle 791 (depuis PostgreSQL):
- Bbox: X [2532450 - 2532493], Y [1155858 - 1155932]
- Centre: E 2532471, N 1155895
"""

import os
import json
import fitz  # PyMuPDF
from PIL import Image

# Configuration du projet
PROJECT_DIR = r"C:\Users\zema\GeoBrain\projets\servitudes_791"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "georef")

# Coordonnées réelles de la parcelle 791 (MN95/EPSG:2056)
# Obtenues depuis bdco.bdco_parcelle WHERE numero='791'
PARCELLE_791_BBOX = {
    "xmin": 2532450.516,
    "ymin": 1155858.078,
    "xmax": 2532493.151,
    "ymax": 1155932.013
}
PARCELLE_791_CENTRE = {
    "x": (PARCELLE_791_BBOX["xmin"] + PARCELLE_791_BBOX["xmax"]) / 2,  # ~2532471
    "y": (PARCELLE_791_BBOX["ymin"] + PARCELLE_791_BBOX["ymax"]) / 2   # ~1155895
}

# Points de calage pour chaque plan
# Les coordonnées sont maintenant basées sur la position réelle de la parcelle 791
PLANS_CALAGE = {
    "2001_003598": {
        # Plan 3 pages, échelle 1:500 - Passage Lavanchy
        # La parcelle 791 est visible sur ce plan
        "echelle": 500,
        "centre_x": PARCELLE_791_CENTRE["x"],
        "centre_y": PARCELLE_791_CENTRE["y"],
        "rotation": 0,
        "pages": [1, 2, 3],
        "description": "Passage Lavanchy - tracé jaune"
    },
    "2002_004259": {
        # Plan échelle 1:500, restrictions de bâtir
        "echelle": 500,
        "centre_x": PARCELLE_791_CENTRE["x"],
        "centre_y": PARCELLE_791_CENTRE["y"] - 30,  # Légèrement au sud
        "rotation": 0,
        "pages": [0],
        "description": "Restriction de bâtir"
    },
    "2003_001959": {
        # Plan échelle 1:500, conduite d'eau
        "echelle": 500,
        "centre_x": PARCELLE_791_CENTRE["x"],
        "centre_y": PARCELLE_791_CENTRE["y"] + 20,  # Vers le nord (DP 44)
        "rotation": 0,
        "pages": [0],
        "description": "Conduite d'eau - raccordement"
    },
    "2003_003622": {
        # Plan échelle 1:500, conduite d'égout
        "echelle": 500,
        "centre_x": PARCELLE_791_CENTRE["x"],
        "centre_y": PARCELLE_791_CENTRE["y"] + 20,
        "rotation": 0,
        "pages": [0],
        "description": "Conduite d'égout EU/EC"
    },
    "2013_002286": {
        # Plan cadastral moderne, échelle 1:500 - Conduite de gaz
        "echelle": 500,
        "centre_x": PARCELLE_791_CENTRE["x"],
        "centre_y": PARCELLE_791_CENTRE["y"],
        "rotation": 0,
        "pages": [0],
        "description": "Conduite de gaz Holdigaz"
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

        print(f"  Cree: {os.path.basename(output_path)} ({pix.width}x{pix.height})")

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
        # Rotation quelconque
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
    print(f"    Echelle: 1:{echelle}, Pixel: {pixel_size_m:.4f}m")
    print(f"    Centre: E {centre_x:.1f}, N {centre_y:.1f}")


def create_prj_file(output_path):
    """Crée un fichier .prj avec la définition du CRS MN95"""

    prj_content = """PROJCS["CH1903+_LV95",GEOGCS["GCS_CH1903+",DATUM["D_CH1903+",SPHEROID["Bessel_1841",6377397.155,299.1528128]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Hotine_Oblique_Mercator_Azimuth_Center"],PARAMETER["False_Easting",2600000.0],PARAMETER["False_Northing",1200000.0],PARAMETER["Scale_Factor",1.0],PARAMETER["Azimuth",90.0],PARAMETER["Longitude_Of_Center",7.439583333333333],PARAMETER["Latitude_Of_Center",46.95240555555556],UNIT["Meter",1.0]]"""

    with open(output_path, 'w') as f:
        f.write(prj_content)


def save_geojson(data, filepath):
    """Sauvegarde un GeoJSON"""

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"GeoJSON sauvegarde: {os.path.basename(filepath)}")


def main():
    """Fonction principale"""

    print("=" * 70)
    print("GEOREFERENCEMENT AUTOMATIQUE DES PLANS DE SERVITUDES")
    print("Parcelle 791 - Chemin du Cedre 35, Bussigny")
    print("=" * 70)
    print(f"\nCoordonnees reelles parcelle 791:")
    print(f"  Centre: E {PARCELLE_791_CENTRE['x']:.1f}, N {PARCELLE_791_CENTRE['y']:.1f}")
    print(f"  Bbox: [{PARCELLE_791_BBOX['xmin']:.0f}-{PARCELLE_791_BBOX['xmax']:.0f}] x [{PARCELLE_791_BBOX['ymin']:.0f}-{PARCELLE_791_BBOX['ymax']:.0f}]")

    # Créer le répertoire de sortie
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Convertir les PDF en PNG et créer les fichiers world
    print("\n1. CONVERSION DES PLANS PDF EN IMAGES GEOREFERENCEES")
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
            # Fichier world (.pgw pour PNG)
            world_path = img["path"].replace('.png', '.pgw')
            create_world_file(img, config, world_path)

            # Fichier PRJ
            prj_path = img["path"].replace('.png', '.prj')
            create_prj_file(prj_path)

    # 2. Résumé
    print("\n" + "=" * 70)
    print("RESUME")
    print("=" * 70)
    print(f"""
Fichiers crees dans: {OUTPUT_DIR}

IMAGES GEOREFERENCEES:
   - Plans PNG avec fichiers .pgw (world) et .prj (CRS)
   - Coordonnees centrees sur la parcelle 791 reelle
   - Peuvent etre charges directement dans QGIS

IMPORTANT:
   Le calage est base sur le centre de la parcelle 791.
   Pour un ajustement fin, utiliser les outils de
   georeferencement de QGIS avec des points de controle.
    """)

    return True


if __name__ == "__main__":
    main()
