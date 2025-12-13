"""
Script PyQGIS pour generer le plan de situation avec servitudes
Parcelle 791 - Bussigny

USAGE:
======
Option 1 - Dans QGIS:
    1. Ouvrir QGIS
    2. Menu Extensions > Console Python
    3. Cliquer sur "Afficher l'editeur"
    4. Ouvrir ce script et l'executer

Option 2 - En ligne de commande (mode standalone):
    Executer run_qgis_standalone.bat

Option 3 - Via OSGeo4W Shell:
    python-qgis generer_plan_servitudes.py
"""

import os
import sys

# ============================================================
# INITIALISATION STANDALONE QGIS
# ============================================================
# Detecter si on est dans QGIS ou en standalone
try:
    from qgis.core import QgsApplication
    QGIS_AVAILABLE = True
except ImportError:
    QGIS_AVAILABLE = False

if not QGIS_AVAILABLE:
    # Configuration pour standalone
    QGIS_PREFIX = r"C:\Program Files\QGIS 3.34.12\apps\qgis-ltr"

    # Ajouter les chemins QGIS
    qgis_python = os.path.join(os.path.dirname(QGIS_PREFIX), "Python312")
    sys.path.insert(0, os.path.join(qgis_python, "Lib", "site-packages"))
    sys.path.insert(0, os.path.join(QGIS_PREFIX, "python"))
    sys.path.insert(0, os.path.join(QGIS_PREFIX, "python", "plugins"))

    # Variables d'environnement
    os.environ["QT_QPA_PLATFORM_PLUGIN_PATH"] = os.path.join(QGIS_PREFIX, "qtplugins")
    os.environ["PATH"] = os.path.join(QGIS_PREFIX, "bin") + ";" + os.environ.get("PATH", "")

    from qgis.core import QgsApplication

    # Initialiser QGIS en mode standalone (sans GUI)
    QgsApplication.setPrefixPath(QGIS_PREFIX, True)
    qgs = QgsApplication([], False)
    qgs.initQgis()
    print("QGIS initialise en mode standalone")
else:
    qgs = None
    print("Execution dans QGIS")

from qgis.core import (
    QgsProject, QgsVectorLayer, QgsRasterLayer,
    QgsCoordinateReferenceSystem, QgsRectangle,
    QgsPrintLayout, QgsLayoutItemMap, QgsLayoutItemLabel,
    QgsLayoutItemLegend, QgsLayoutItemScaleBar, QgsLayoutItemPicture,
    QgsLayoutItemShape, QgsLayoutExporter, QgsLayoutPoint, QgsLayoutSize,
    QgsUnitTypes, QgsFillSymbol, QgsLineSymbol, QgsSimpleFillSymbolLayer,
    QgsSimpleLineSymbolLayer, QgsSingleSymbolRenderer,
    QgsCategorizedSymbolRenderer, QgsRendererCategory,
    QgsLayerTreeLayer, QgsLegendStyle, QgsTextFormat
)
from qgis.PyQt.QtCore import QSize, Qt
from qgis.PyQt.QtGui import QColor, QFont
import os

# ============================================================
# CONFIGURATION
# ============================================================
BASE_DIR = r"C:\Users\zema\GeoBrain\projets\servitudes_791"
GEOJSON_PATH = os.path.join(BASE_DIR, "georef", "servitudes_791_complet.geojson")
OUTPUT_PDF = os.path.join(BASE_DIR, "Plan_situation_servitudes_791.pdf")
OUTPUT_PROJECT = os.path.join(BASE_DIR, "plan_servitudes_791.qgz")

# Logo Bussigny
LOGO_PATH = r"M:\7-Infra\0-Gest\2-Mod\7024_Logos\Logo_By.jpg"
NORD_SVG = r"Z:\01_QGIS\02-Projet\SVG\Nord.svg"

# Fond cadastral WMTS/WMS
WMS_CADASTRE = "contextualWMSLegend=0&crs=EPSG:2056&dpiMode=7&featureCount=10&format=image/png&layers=OrthophotosPlanCad2023_2024Jpeg&styles&url=https://wms.asit-asso.ch/wmts"

# Couleurs par type de servitude
COULEURS_SERVITUDES = {
    "Droit de passage": "#FF6B6B",      # Rouge-corail
    "Restriction de bâtir": "#4ECDC4",   # Cyan
    "Conduite d'eau": "#45B7D1",         # Bleu clair
    "Conduite d'égout": "#96CEB4",       # Vert clair
    "Conduite de gaz": "#FFD93D",        # Jaune
    "Zone de protection": "#DDA0DD",     # Violet clair
}

def hex_to_qcolor(hex_color):
    """Convertit une couleur hex en QColor"""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return QColor(r, g, b)

def creer_projet():
    """Cree le projet QGIS avec les couches"""
    project = QgsProject.instance()
    project.clear()

    # Definir le CRS
    crs = QgsCoordinateReferenceSystem("EPSG:2056")
    project.setCrs(crs)

    # Charger le GeoJSON
    layer = QgsVectorLayer(GEOJSON_PATH, "Servitudes_791", "ogr")
    if not layer.isValid():
        print(f"ERREUR: Impossible de charger {GEOJSON_PATH}")
        return None

    project.addMapLayer(layer)

    # Ajouter le fond cadastral WMS si disponible
    try:
        wms_layer = QgsRasterLayer(WMS_CADASTRE, "Fond cadastral", "wms")
        if wms_layer.isValid():
            project.addMapLayer(wms_layer)
            # Mettre le fond en dessous
            root = project.layerTreeRoot()
            wms_node = root.findLayer(wms_layer.id())
            clone = wms_node.clone()
            root.insertChildNode(-1, clone)
            root.removeChildNode(wms_node)
    except Exception as e:
        print(f"Fond WMS non disponible: {e}")

    # Appliquer un style categorise par type de servitude
    appliquer_style(layer)

    # Sauvegarder le projet
    project.write(OUTPUT_PROJECT)
    print(f"Projet sauvegarde: {OUTPUT_PROJECT}")

    return project, layer

def appliquer_style(layer):
    """Applique un style categorise selon le type d'entite"""
    categories = []

    # Parcelle principale - contour noir epais, remplissage transparent
    symbol_parcelle = QgsFillSymbol.createSimple({
        'color': '255,255,255,0',
        'outline_color': '0,0,0,255',
        'outline_width': '0.8'
    })
    categories.append(QgsRendererCategory("parcelle_principale", symbol_parcelle, "Parcelle 791"))

    # Parcelle voisine - contour gris, remplissage transparent
    symbol_voisine = QgsFillSymbol.createSimple({
        'color': '255,255,255,0',
        'outline_color': '128,128,128,255',
        'outline_width': '0.4'
    })
    categories.append(QgsRendererCategory("parcelle_voisine", symbol_voisine, "Parcelle voisine"))

    # Domaine public - hachures
    symbol_dp = QgsFillSymbol.createSimple({
        'color': '200,200,200,100',
        'outline_color': '100,100,100,255',
        'outline_width': '0.3'
    })
    categories.append(QgsRendererCategory("domaine_public", symbol_dp, "Domaine public"))

    # Servitudes - on va les styliser individuellement
    symbol_serv = QgsLineSymbol.createSimple({
        'color': '255,0,0,255',
        'width': '1.5'
    })
    categories.append(QgsRendererCategory("servitude", symbol_serv, "Servitude"))

    renderer = QgsCategorizedSymbolRenderer("type", categories)
    layer.setRenderer(renderer)
    layer.triggerRepaint()

def creer_mise_en_page(project, layer):
    """Cree la mise en page A3 paysage"""
    manager = project.layoutManager()

    # Supprimer l'ancienne mise en page si elle existe
    for layout in manager.layouts():
        if layout.name() == "Plan_Servitudes_791":
            manager.removeLayout(layout)

    # Creer la mise en page
    layout = QgsPrintLayout(project)
    layout.initializeDefaults()
    layout.setName("Plan_Servitudes_791")

    # Taille A3 paysage (420 x 297 mm)
    pc = layout.pageCollection()
    page = pc.page(0)
    page.setPageSize(QgsLayoutSize(420, 297, QgsUnitTypes.LayoutMillimeters))

    # =========================================
    # CARTE PRINCIPALE
    # =========================================
    map_item = QgsLayoutItemMap(layout)
    map_item.setRect(20, 20, 200, 150)
    map_item.attemptMove(QgsLayoutPoint(65, 45, QgsUnitTypes.LayoutMillimeters))
    map_item.attemptResize(QgsLayoutSize(350, 245, QgsUnitTypes.LayoutMillimeters))
    map_item.setFrameEnabled(True)
    map_item.setBackgroundEnabled(True)

    # Centrer sur la parcelle 791
    extent = layer.extent()
    extent.scale(1.3)  # Zoom out un peu
    map_item.setExtent(extent)

    layout.addLayoutItem(map_item)

    # =========================================
    # CARTOUCHE (haut gauche)
    # =========================================
    # Cadre du cartouche
    cartouche = QgsLayoutItemShape(layout)
    cartouche.setShapeType(QgsLayoutItemShape.Rectangle)
    cartouche.attemptMove(QgsLayoutPoint(5, 5, QgsUnitTypes.LayoutMillimeters))
    cartouche.attemptResize(QgsLayoutSize(58, 38, QgsUnitTypes.LayoutMillimeters))
    cartouche.setFrameEnabled(True)
    symbol = QgsFillSymbol.createSimple({'color': '255,255,255,255', 'outline_color': '0,0,0,255', 'outline_width': '0.3'})
    cartouche.setSymbol(symbol)
    layout.addLayoutItem(cartouche)

    # Logo Bussigny
    if os.path.exists(LOGO_PATH):
        logo = QgsLayoutItemPicture(layout)
        logo.setPicturePath(LOGO_PATH)
        logo.attemptMove(QgsLayoutPoint(7, 7, QgsUnitTypes.LayoutMillimeters))
        logo.attemptResize(QgsLayoutSize(14, 14, QgsUnitTypes.LayoutMillimeters))
        layout.addLayoutItem(logo)

    # Titre
    titre = QgsLayoutItemLabel(layout)
    titre.setText("Commune de Bussigny\nPlan de situation\nServitudes\n1:500\nParcelle 791")
    titre.attemptMove(QgsLayoutPoint(22, 7, QgsUnitTypes.LayoutMillimeters))
    titre.attemptResize(QgsLayoutSize(40, 35, QgsUnitTypes.LayoutMillimeters))
    font = QFont("Arial", 9)
    titre.setFont(font)
    layout.addLayoutItem(titre)

    # =========================================
    # LEGENDE (sous le cartouche)
    # =========================================
    # Cadre de la legende
    legende_cadre = QgsLayoutItemShape(layout)
    legende_cadre.setShapeType(QgsLayoutItemShape.Rectangle)
    legende_cadre.attemptMove(QgsLayoutPoint(5, 45, QgsUnitTypes.LayoutMillimeters))
    legende_cadre.attemptResize(QgsLayoutSize(58, 100, QgsUnitTypes.LayoutMillimeters))
    legende_cadre.setFrameEnabled(True)
    symbol = QgsFillSymbol.createSimple({'color': '255,255,255,255', 'outline_color': '0,0,0,255', 'outline_width': '0.3'})
    legende_cadre.setSymbol(symbol)
    layout.addLayoutItem(legende_cadre)

    # Titre legende
    titre_leg = QgsLayoutItemLabel(layout)
    titre_leg.setText("Servitudes")
    titre_leg.attemptMove(QgsLayoutPoint(7, 47, QgsUnitTypes.LayoutMillimeters))
    titre_leg.attemptResize(QgsLayoutSize(54, 8, QgsUnitTypes.LayoutMillimeters))
    font_bold = QFont("Arial", 11, QFont.Bold)
    titre_leg.setFont(font_bold)
    layout.addLayoutItem(titre_leg)

    # Entrees de legende manuelles
    servitudes_legende = [
        ("Droit de passage (vehicules)", "#FF6B6B"),
        ("Restriction de batir", "#4ECDC4"),
        ("Conduite d'eau", "#45B7D1"),
        ("Conduite d'egout EU/EC", "#96CEB4"),
        ("Conduite de gaz", "#FFD93D"),
        ("Zone protection gaz", "#DDA0DD"),
    ]

    y_pos = 58
    for nom, couleur in servitudes_legende:
        # Rectangle de couleur
        rect = QgsLayoutItemShape(layout)
        rect.setShapeType(QgsLayoutItemShape.Rectangle)
        rect.attemptMove(QgsLayoutPoint(8, y_pos, QgsUnitTypes.LayoutMillimeters))
        rect.attemptResize(QgsLayoutSize(8, 4, QgsUnitTypes.LayoutMillimeters))
        symbol = QgsFillSymbol.createSimple({
            'color': f'{hex_to_qcolor(couleur).red()},{hex_to_qcolor(couleur).green()},{hex_to_qcolor(couleur).blue()},255',
            'outline_color': '0,0,0,255',
            'outline_width': '0.2'
        })
        rect.setSymbol(symbol)
        layout.addLayoutItem(rect)

        # Texte
        label = QgsLayoutItemLabel(layout)
        label.setText(nom)
        label.attemptMove(QgsLayoutPoint(18, y_pos, QgsUnitTypes.LayoutMillimeters))
        label.attemptResize(QgsLayoutSize(42, 6, QgsUnitTypes.LayoutMillimeters))
        font_small = QFont("Arial", 7)
        label.setFont(font_small)
        layout.addLayoutItem(label)

        y_pos += 8

    # =========================================
    # BARRE D'ECHELLE
    # =========================================
    scalebar = QgsLayoutItemScaleBar(layout)
    scalebar.setLinkedMap(map_item)
    scalebar.setStyle('Single Box')
    scalebar.setUnits(QgsUnitTypes.DistanceMeters)
    scalebar.setNumberOfSegments(4)
    scalebar.setUnitsPerSegment(10)
    scalebar.setUnitLabel('m')
    scalebar.attemptMove(QgsLayoutPoint(10, 280, QgsUnitTypes.LayoutMillimeters))
    layout.addLayoutItem(scalebar)

    # =========================================
    # FLECHE DU NORD
    # =========================================
    if os.path.exists(NORD_SVG):
        nord = QgsLayoutItemPicture(layout)
        nord.setPicturePath(NORD_SVG)
        nord.attemptMove(QgsLayoutPoint(380, 250, QgsUnitTypes.LayoutMillimeters))
        nord.attemptResize(QgsLayoutSize(25, 25, QgsUnitTypes.LayoutMillimeters))
        layout.addLayoutItem(nord)

    # =========================================
    # DATE ET COPYRIGHT
    # =========================================
    from datetime import datetime
    date_label = QgsLayoutItemLabel(layout)
    date_label.setText(f"Imprime le {datetime.now().strftime('%d.%m.%Y')}\nGeodonnees (c) Etat de Vaud")
    date_label.attemptMove(QgsLayoutPoint(320, 280, QgsUnitTypes.LayoutMillimeters))
    date_label.attemptResize(QgsLayoutSize(90, 12, QgsUnitTypes.LayoutMillimeters))
    font_small = QFont("Arial", 7)
    date_label.setFont(font_small)
    layout.addLayoutItem(date_label)

    manager.addLayout(layout)
    return layout

def exporter_pdf(layout):
    """Exporte la mise en page en PDF"""
    exporter = QgsLayoutExporter(layout)
    settings = QgsLayoutExporter.PdfExportSettings()
    settings.dpi = 300

    result = exporter.exportToPdf(OUTPUT_PDF, settings)

    if result == QgsLayoutExporter.Success:
        print(f"PDF exporte avec succes: {OUTPUT_PDF}")
        return True
    else:
        print(f"ERREUR lors de l'export PDF: {result}")
        return False

def main():
    """Fonction principale"""
    print("="*50)
    print("Generation du plan de situation - Servitudes 791")
    print("="*50)

    # Creer le projet
    result = creer_projet()
    if result is None:
        return

    project, layer = result

    # Creer la mise en page
    layout = creer_mise_en_page(project, layer)

    # Exporter en PDF
    exporter_pdf(layout)

    # Sauvegarder le projet final
    project.write(OUTPUT_PROJECT)

    print("="*50)
    print("Termine!")
    print(f"Projet: {OUTPUT_PROJECT}")
    print(f"PDF: {OUTPUT_PDF}")
    print("="*50)

# Executer si lance dans QGIS
if __name__ == "__main__" or True:
    try:
        main()
    finally:
        # Cleanup QGIS si en mode standalone
        if qgs is not None:
            qgs.exitQgis()
            print("QGIS ferme proprement")
