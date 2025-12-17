"""
Export Fond de Plan Bussigny vers DXF
=====================================
Script PyQGIS pour extraire les couches BDCO depuis PostGIS
et les exporter en DXF avec les styles corrects.

Usage: Lancer depuis la console Python de QGIS ou via le menu Extensions > Console Python
"""

from qgis.core import (
    QgsProject, QgsVectorLayer, QgsDataSourceUri,
    QgsCoordinateReferenceSystem, QgsDxfExport,
    QgsMapSettings, QgsSymbol, QgsFillSymbol, QgsLineSymbol,
    QgsSimpleFillSymbolLayer, QgsSimpleLineSymbolLayer
)
from qgis.PyQt.QtWidgets import QFileDialog, QMessageBox
from qgis.PyQt.QtGui import QColor
from qgis.PyQt.QtCore import QSize, QFile, QIODevice
import os
from datetime import datetime

# =============================================================================
# CONFIGURATION
# =============================================================================

# Connexion PostGIS
DB_CONFIG = {
    'host': 'srv-fme',
    'port': '5432',
    'dbname': 'Prod',
    'schema': 'bdco',
    'user': 'postgres',
    'password': '4w3TL6fsWcSqC'  # TODO: Externaliser dans un fichier config
}

# Couches à exporter avec leurs styles (couleur RGB, épaisseur en mm)
LAYERS_CONFIG = [
    {
        'table': 'bdco_parcelle',
        'name': 'PARCELLES',
        'geom': 'geom',
        'color': (190, 207, 80),
        'width': 0.6,
        'type': 'polygon'
    },
    {
        'table': 'bdco_batiment',
        'name': 'BATIMENTS',
        'geom': 'geom',
        'color': (128, 128, 128),  # Gris pour le contour
        'fill_color': (200, 200, 200),
        'width': 0.2,
        'type': 'polygon'
    },
    {
        'table': 'bdco_cs_dur',
        'name': 'CS_DUR',
        'geom': 'geom',
        'color': (231, 113, 72),
        'width': 0.6,
        'type': 'polygon'
    },
    {
        'table': 'bdco_objet_divers_surf',
        'name': 'OBJETS_DIVERS_SURF',
        'geom': 'geom',
        'color': (190, 178, 151),
        'width': 0.6,
        'type': 'polygon'
    },
    {
        'table': 'bdco_objet_divers_lin',
        'name': 'OBJETS_DIVERS_LIN',
        'geom': 'geom',
        'color': (229, 182, 54),
        'width': 0.6,
        'type': 'line'
    },
    {
        'table': 'bdco_adresse_rue_lin',
        'name': 'RUES',
        'geom': 'geom',
        'color': (141, 90, 153),
        'width': 0.6,
        'type': 'line'
    },
    {
        'table': 'bdco_point_fixe_1',
        'name': 'PFP1',
        'geom': 'geom',
        'color': (255, 0, 0),
        'width': 0.5,
        'type': 'point'
    },
    {
        'table': 'bdco_point_fixe_2',
        'name': 'PFP2',
        'geom': 'geom',
        'color': (255, 128, 0),
        'width': 0.4,
        'type': 'point'
    },
    {
        'table': 'bdco_point_fixe_3',
        'name': 'PFP3',
        'geom': 'geom',
        'color': (255, 200, 0),
        'width': 0.3,
        'type': 'point'
    },
    {
        'table': 'bdco_point_limite',
        'name': 'POINTS_LIMITES',
        'geom': 'geom',
        'color': (225, 89, 137),
        'width': 0.26,
        'type': 'point'
    }
]

# Dossier de sortie par défaut
DEFAULT_OUTPUT_DIR = r'C:\Users\zema\GeoBrain\projets\Fonds_de_plan'


# =============================================================================
# FONCTIONS
# =============================================================================

def create_uri(table, geom='geom'):
    """Crée l'URI de connexion PostGIS"""
    uri = QgsDataSourceUri()
    uri.setConnection(
        DB_CONFIG['host'],
        DB_CONFIG['port'],
        DB_CONFIG['dbname'],
        DB_CONFIG['user'],
        DB_CONFIG['password']
    )
    uri.setDataSource(DB_CONFIG['schema'], table, geom)
    uri.setSrid('2056')
    return uri


def load_layer(config):
    """Charge une couche depuis PostGIS avec le style approprié"""
    uri = create_uri(config['table'], config['geom'])
    layer = QgsVectorLayer(uri.uri(False), config['name'], 'postgres')

    if not layer.isValid():
        print(f"  ⚠ Erreur chargement: {config['table']}")
        return None

    # Appliquer le style selon le type de géométrie
    r, g, b = config['color']

    if config['type'] == 'polygon':
        symbol = QgsFillSymbol.createSimple({
            'color': f"{config.get('fill_color', config['color'])[0]},{config.get('fill_color', config['color'])[1]},{config.get('fill_color', config['color'])[2]},50",
            'outline_color': f'{r},{g},{b},255',
            'outline_width': str(config['width'])
        })
    elif config['type'] == 'line':
        symbol = QgsLineSymbol.createSimple({
            'color': f'{r},{g},{b},255',
            'width': str(config['width'])
        })
    else:  # point
        symbol = QgsSymbol.defaultSymbol(layer.geometryType())
        symbol.setColor(QColor(r, g, b))
        symbol.setSize(config['width'] * 3)

    layer.renderer().setSymbol(symbol)
    layer.triggerRepaint()

    print(f"  ✓ {config['name']}: {layer.featureCount()} entités")
    return layer


def export_dxf(layers, output_path):
    """Exporte les couches en DXF"""
    dxf_export = QgsDxfExport()

    # Configuration export
    dxf_export.setMapSettings(QgsMapSettings())
    dxf_export.setSymbologyScale(1000)  # Échelle 1:1000
    dxf_export.setSymbologyExport(QgsDxfExport.SymbolLayerSymbology)
    dxf_export.setDestinationCrs(QgsCoordinateReferenceSystem('EPSG:2056'))

    # Ajouter les couches
    dxf_layers = []
    for layer in layers:
        if layer:
            dxf_layers.append(QgsDxfExport.DxfLayer(layer))

    dxf_export.addLayers(dxf_layers)

    # Exporter via QFile (API QGIS 3.40+)
    dxf_file = QFile(output_path)
    if not dxf_file.open(QIODevice.WriteOnly | QIODevice.Truncate):
        print(f"  ✗ Impossible d'ouvrir le fichier: {output_path}")
        return False

    result = dxf_export.writeToFile(dxf_file, 'UTF-8')
    dxf_file.close()

    return result == QgsDxfExport.ExportResult.Success


def main():
    """Fonction principale"""
    print("=" * 60)
    print("  EXPORT FOND DE PLAN BUSSIGNY - DXF")
    print("=" * 60)

    # Créer le dossier de sortie si nécessaire
    os.makedirs(DEFAULT_OUTPUT_DIR, exist_ok=True)

    # Nom du fichier avec date
    date_str = datetime.now().strftime('%Y%m%d')
    default_filename = f"Fond_Plan_Bussigny_{date_str}.dxf"
    default_path = os.path.join(DEFAULT_OUTPUT_DIR, default_filename)

    # Dialog pour choisir le fichier de sortie
    output_path, _ = QFileDialog.getSaveFileName(
        None,
        "Enregistrer le DXF",
        default_path,
        "Fichiers DXF (*.dxf)"
    )

    if not output_path:
        print("Export annulé.")
        return

    print(f"\nChargement des couches depuis PostGIS...")
    print(f"  Serveur: {DB_CONFIG['host']}")
    print(f"  Base: {DB_CONFIG['dbname']}")
    print(f"  Schéma: {DB_CONFIG['schema']}")
    print()

    # Charger toutes les couches
    layers = []
    for config in LAYERS_CONFIG:
        layer = load_layer(config)
        if layer:
            layers.append(layer)
            # Ajouter temporairement au projet pour l'export
            QgsProject.instance().addMapLayer(layer, False)

    print(f"\n{len(layers)} couches chargées.")
    print(f"\nExport DXF en cours...")

    # Exporter
    success = export_dxf(layers, output_path)

    # Nettoyer (retirer les couches temporaires)
    for layer in layers:
        QgsProject.instance().removeMapLayer(layer.id())

    if success:
        print(f"\n✓ Export réussi!")
        print(f"  Fichier: {output_path}")

        # Message de confirmation
        QMessageBox.information(
            None,
            "Export terminé",
            f"Fond de plan exporté avec succès!\n\n{output_path}"
        )
    else:
        print(f"\n✗ Erreur lors de l'export")
        QMessageBox.critical(
            None,
            "Erreur",
            "Erreur lors de l'export DXF"
        )


# =============================================================================
# EXECUTION
# =============================================================================

if __name__ == '__main__':
    main()
else:
    # Si importé dans la console QGIS, lancer directement
    main()
