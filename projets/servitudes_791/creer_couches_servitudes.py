"""
Script PyQGIS pour créer les couches de servitudes - Parcelle 791
Commune de Bussigny

Usage: Exécuter dans la console Python de QGIS ou via le menu Sketches
"""

from qgis.core import (
    QgsProject, QgsVectorLayer, QgsField, QgsFeature, QgsGeometry,
    QgsPointXY, QgsCoordinateReferenceSystem, QgsRasterLayer,
    QgsVectorFileWriter, QgsPalLayerSettings, QgsTextFormat,
    QgsVectorLayerSimpleLabeling, QgsFillSymbol, QgsLineSymbol,
    QgsSimpleFillSymbolLayer, QgsSimpleLineSymbolLayer,
    QgsRuleBasedRenderer, QgsCategorizedSymbolRenderer,
    QgsRendererCategory, QgsMarkerSymbol
)
from qgis.PyQt.QtCore import QVariant
from qgis.PyQt.QtGui import QColor, QFont
import os

# Configuration
PROJECT_DIR = r"C:\Users\zema\GeoBrain\projets\servitudes_791"
CRS = QgsCoordinateReferenceSystem("EPSG:2056")

# Coordonnées approximatives de la parcelle 791 (Chemin du Cèdre 35)
# Centre estimé basé sur les plans de servitudes
CENTRE_X = 2533100  # Coordonnée E (MN95)
CENTRE_Y = 1155450  # Coordonnée N (MN95)

# Emprise pour la vue
EXTENT_XMIN = 2532800
EXTENT_XMAX = 2533500
EXTENT_YMIN = 1155100
EXTENT_YMAX = 1155800

def creer_couche_parcelles():
    """Crée la couche des parcelles concernées par les servitudes"""

    # Créer une couche mémoire pour les parcelles
    uri = "Polygon?crs=EPSG:2056"
    layer = QgsVectorLayer(uri, "Parcelles", "memory")
    provider = layer.dataProvider()

    # Ajouter les champs
    provider.addAttributes([
        QgsField("numero", QVariant.Int),
        QgsField("role", QVariant.String),  # 'sujet', 'servant', 'dominant', 'voisin'
        QgsField("surface_m2", QVariant.Double),
        QgsField("adresse", QVariant.String)
    ])
    layer.updateFields()

    # Liste des parcelles (à compléter avec les vraies géométries du cadastre)
    parcelles_info = [
        {"numero": 791, "role": "sujet", "adresse": "Chemin du Cèdre 35"},
        {"numero": 757, "role": "dominant", "adresse": ""},
        {"numero": 760, "role": "voisin", "adresse": ""},
        {"numero": 761, "role": "voisin", "adresse": ""},
        {"numero": 764, "role": "voisin", "adresse": ""},
        {"numero": 767, "role": "voisin", "adresse": ""},
        {"numero": 768, "role": "voisin", "adresse": ""},
        {"numero": 792, "role": "voisin", "adresse": ""},
        {"numero": 805, "role": "voisin", "adresse": ""},
        {"numero": 1615, "role": "servant", "adresse": ""},
        {"numero": 3417, "role": "dominant", "adresse": ""},
    ]

    print(f"Couche parcelles créée avec {len(parcelles_info)} entrées")
    return layer


def creer_couche_servitudes_passage():
    """Crée la couche des servitudes de passage"""

    uri = "Polygon?crs=EPSG:2056"
    layer = QgsVectorLayer(uri, "Servitudes de passage", "memory")
    provider = layer.dataProvider()

    # Ajouter les champs
    provider.addAttributes([
        QgsField("id_servitude", QVariant.String),
        QgsField("type", QVariant.String),
        QgsField("date_creation", QVariant.String),
        QgsField("role_791", QVariant.String),  # 'servant' ou 'beneficiaire'
        QgsField("fonds_servant", QVariant.String),
        QgsField("fonds_dominant", QVariant.String),
        QgsField("description", QVariant.String),
        QgsField("couleur_plan", QVariant.String)
    ])
    layer.updateFields()

    # Définir les servitudes de passage
    servitudes = [
        {
            "id_servitude": "010-2001/003598",
            "type": "Passage pied, véhicules, canalisations",
            "date_creation": "31.10.1940",
            "role_791": "beneficiaire",
            "fonds_servant": "753, 762, 763, 790, etc.",
            "fonds_dominant": "Réciproque quartier Lavanchy",
            "description": "Passage quartier En Lavanchy",
            "couleur_plan": "jaune"
        },
        {
            "id_servitude": "010-2003/001959",
            "type": "Passage pied et char",
            "date_creation": "29.06.1912",
            "role_791": "servant",
            "fonds_servant": "791, 1615",
            "fonds_dominant": "757",
            "description": "Accès depuis parcelle 757",
            "couleur_plan": "jaune"
        },
        {
            "id_servitude": "010-2003/003622",
            "type": "Passage à pied",
            "date_creation": "14.07.1934",
            "role_791": "beneficiaire",
            "fonds_servant": "1615",
            "fonds_dominant": "791",
            "description": "Sur toute la surface du BF 1615",
            "couleur_plan": "surface"
        },
        {
            "id_servitude": "007-2013/002286",
            "type": "Passage pied et véhicules",
            "date_creation": "30.07.2013",
            "role_791": "servant",
            "fonds_servant": "791, 1615",
            "fonds_dominant": "3417",
            "description": "Tracé en bleu sur plan annexé",
            "couleur_plan": "bleu"
        }
    ]

    # Ajouter les entités (sans géométrie pour l'instant - à digitaliser)
    for s in servitudes:
        feat = QgsFeature(layer.fields())
        for key, value in s.items():
            feat.setAttribute(key, value)
        provider.addFeature(feat)

    layer.updateExtents()

    # Style: catégorisé par rôle
    categories = []

    # Servant (791 est grevé) - Rouge hachuré
    symbol_servant = QgsFillSymbol.createSimple({
        'color': '255,100,100,100',
        'outline_color': '255,0,0,255',
        'outline_width': '0.5',
        'style': 'diagonal_x'
    })
    categories.append(QgsRendererCategory('servant', symbol_servant, '791 est servant (grevé)'))

    # Bénéficiaire (791 a le droit) - Vert hachuré
    symbol_benef = QgsFillSymbol.createSimple({
        'color': '100,255,100,100',
        'outline_color': '0,150,0,255',
        'outline_width': '0.5',
        'style': 'b_diagonal'
    })
    categories.append(QgsRendererCategory('beneficiaire', symbol_benef, '791 est bénéficiaire'))

    renderer = QgsCategorizedSymbolRenderer('role_791', categories)
    layer.setRenderer(renderer)

    print(f"Couche servitudes de passage créée avec {len(servitudes)} entrées")
    return layer


def creer_couche_servitudes_canalisations():
    """Crée la couche des servitudes de canalisations"""

    uri = "LineString?crs=EPSG:2056"
    layer = QgsVectorLayer(uri, "Servitudes de canalisations", "memory")
    provider = layer.dataProvider()

    # Ajouter les champs
    provider.addAttributes([
        QgsField("id_servitude", QVariant.String),
        QgsField("type", QVariant.String),
        QgsField("date_creation", QVariant.String),
        QgsField("role_791", QVariant.String),
        QgsField("fonds_servant", QVariant.String),
        QgsField("fonds_dominant", QVariant.String),
        QgsField("description", QVariant.String),
        QgsField("type_cana", QVariant.String)  # eau, egout, mixte
    ])
    layer.updateFields()

    # Définir les servitudes de canalisations
    servitudes = [
        {
            "id_servitude": "010-2002/004259",
            "type": "Canalisations eau/égout",
            "date_creation": "16.06.1955",
            "role_791": "servant",
            "fonds_servant": "791, 746, 747, 792, 807, etc.",
            "fonds_dominant": "Commune de Bussigny",
            "description": "Eau 10cm, Égout 40cm",
            "type_cana": "mixte"
        },
        {
            "id_servitude": "007-2013/002287",
            "type": "Canalisations quelconques",
            "date_creation": "30.07.2013",
            "role_791": "servant",
            "fonds_servant": "791",
            "fonds_dominant": "3417",
            "description": "Assiette non encore définie",
            "type_cana": "non_defini"
        }
    ]

    for s in servitudes:
        feat = QgsFeature(layer.fields())
        for key, value in s.items():
            feat.setAttribute(key, value)
        provider.addFeature(feat)

    layer.updateExtents()

    # Style: lignes tiretées colorées
    categories = []

    # Eau - Bleu
    symbol_eau = QgsLineSymbol.createSimple({
        'color': '0,100,255,255',
        'width': '1',
        'line_style': 'dash'
    })

    # Égout - Rouge
    symbol_egout = QgsLineSymbol.createSimple({
        'color': '180,0,0,255',
        'width': '1',
        'line_style': 'dash'
    })

    # Mixte - Violet
    symbol_mixte = QgsLineSymbol.createSimple({
        'color': '150,0,150,255',
        'width': '1.2',
        'line_style': 'dash_dot'
    })

    # Non défini - Gris pointillé
    symbol_nd = QgsLineSymbol.createSimple({
        'color': '128,128,128,200',
        'width': '0.8',
        'line_style': 'dot'
    })

    categories.append(QgsRendererCategory('eau', symbol_eau, 'Eau'))
    categories.append(QgsRendererCategory('egout', symbol_egout, 'Égout'))
    categories.append(QgsRendererCategory('mixte', symbol_mixte, 'Eau + Égout'))
    categories.append(QgsRendererCategory('non_defini', symbol_nd, 'Non défini'))

    renderer = QgsCategorizedSymbolRenderer('type_cana', categories)
    layer.setRenderer(renderer)

    print(f"Couche servitudes canalisations créée avec {len(servitudes)} entrées")
    return layer


def charger_wms_cadastre():
    """Charge les couches WMS du cadastre vaudois"""

    # WMS Cadastre VD
    uri_cadastre = (
        "contextualWMSLegend=0&"
        "crs=EPSG:2056&"
        "dpiMode=7&"
        "featureCount=10&"
        "format=image/png&"
        "layers=cadastre_wms&"
        "styles=&"
        "url=https://wms.geo.vd.ch/wms"
    )

    layer_cadastre = QgsRasterLayer(uri_cadastre, "Cadastre VD (WMS)", "wms")

    if layer_cadastre.isValid():
        print("Couche WMS Cadastre chargée avec succès")
        return layer_cadastre
    else:
        print("Erreur chargement WMS Cadastre - utiliser Swisstopo comme alternative")

        # Alternative: Swisstopo
        uri_swisstopo = (
            "contextualWMSLegend=0&"
            "crs=EPSG:2056&"
            "dpiMode=7&"
            "featureCount=10&"
            "format=image/png&"
            "layers=ch.swisstopo.pixelkarte-farbe&"
            "styles=&"
            "url=https://wms.geo.admin.ch/"
        )
        layer_swisstopo = QgsRasterLayer(uri_swisstopo, "Swisstopo (WMS)", "wms")
        return layer_swisstopo


def sauvegarder_couche_gpkg(layer, filename):
    """Sauvegarde une couche en GeoPackage"""

    filepath = os.path.join(PROJECT_DIR, filename)

    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GPKG"
    options.fileEncoding = "UTF-8"

    error = QgsVectorFileWriter.writeAsVectorFormatV3(
        layer,
        filepath,
        QgsProject.instance().transformContext(),
        options
    )

    if error[0] == QgsVectorFileWriter.NoError:
        print(f"Couche sauvegardée: {filepath}")
        return filepath
    else:
        print(f"Erreur sauvegarde: {error}")
        return None


def main():
    """Fonction principale"""

    print("=" * 60)
    print("Création du projet servitudes - Parcelle 791")
    print("=" * 60)

    # Créer le répertoire si nécessaire
    os.makedirs(PROJECT_DIR, exist_ok=True)

    # Obtenir le projet actuel
    project = QgsProject.instance()
    project.setCrs(CRS)

    # 1. Charger le fond de plan WMS
    print("\n1. Chargement du fond de plan WMS...")
    wms_layer = charger_wms_cadastre()
    if wms_layer and wms_layer.isValid():
        project.addMapLayer(wms_layer)

    # 2. Créer les couches de servitudes
    print("\n2. Création des couches de servitudes...")

    layer_passage = creer_couche_servitudes_passage()
    project.addMapLayer(layer_passage)

    layer_cana = creer_couche_servitudes_canalisations()
    project.addMapLayer(layer_cana)

    # 3. Créer la couche parcelles
    print("\n3. Création de la couche parcelles...")
    layer_parcelles = creer_couche_parcelles()
    project.addMapLayer(layer_parcelles)

    # 4. Zoomer sur l'emprise
    print("\n4. Définition de l'emprise...")
    from qgis.core import QgsRectangle
    canvas = iface.mapCanvas()
    canvas.setExtent(QgsRectangle(EXTENT_XMIN, EXTENT_YMIN, EXTENT_XMAX, EXTENT_YMAX))
    canvas.refresh()

    print("\n" + "=" * 60)
    print("PROJET CRÉÉ AVEC SUCCÈS!")
    print("=" * 60)
    print("""
PROCHAINES ÉTAPES:

1. GÉORÉFÉRENCER les plans PDF:
   - Menu Sketches > Sketches de géoréférencement
   - Ouvrir chaque plan PDF (2001_003598.pdf, etc.)
   - Placer au moins 4 points de contrôle sur des sommets de parcelles
   - Utiliser la transformation polynomiale

2. DIGITALISER les servitudes:
   - Sélectionner la couche "Servitudes de passage"
   - Basculer en édition (crayon)
   - Dessiner les polygones selon les tracés colorés des plans
   - Remplir les attributs pour chaque entité

3. EXPORTER le plan:
   - Menu Sketches > Sketches > Plan de situation - Servitudes parcelle 791
   - Exporter en PDF à l'échelle 1:500
    """)

    return True


# Exécution
if __name__ == "__main__" or True:
    main()
