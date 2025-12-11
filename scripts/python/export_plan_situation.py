"""
Script generique d'export PDF de plans de situation
Commune de Bussigny - Service SIT

Usage depuis la console Python de QGIS:
  from export_plan_situation import export_pdf, export_all_layouts
  export_pdf()                          # Export mise en page par defaut
  export_pdf("Ma mise en page")         # Export mise en page specifique
  export_all_layouts()                  # Export toutes les mises en page

Ou execution directe:
  exec(open(r'C:\Users\zema\GeoBrain\scripts\python\export_plan_situation.py').read())
"""

import os
from datetime import datetime
from qgis.core import QgsProject, QgsLayoutExporter, QgsRectangle

# Configuration par defaut
DEFAULT_DPI = 300
DEFAULT_OUTPUT_DIR = None  # Meme dossier que le projet


def get_output_path(layout_name, output_dir=None, suffix=""):
    """Genere le chemin de sortie du PDF"""

    project = QgsProject.instance()

    if output_dir is None:
        output_dir = os.path.dirname(project.fileName())

    # Nettoyer le nom pour le fichier
    safe_name = layout_name.replace(" ", "_").replace("/", "-").replace("\\", "-")

    # Ajouter la date si demande
    if suffix:
        safe_name = f"{safe_name}_{suffix}"

    return os.path.join(output_dir, f"{safe_name}.pdf")


def export_pdf(layout_name=None, output_path=None, dpi=DEFAULT_DPI,
               add_date=False, open_after=False):
    """
    Exporte une mise en page en PDF

    Args:
        layout_name: Nom de la mise en page (None = premiere disponible)
        output_path: Chemin du PDF (None = auto)
        dpi: Resolution (defaut 300)
        add_date: Ajouter la date au nom du fichier
        open_after: Ouvrir le PDF apres export

    Returns:
        str: Chemin du PDF si succes, None sinon
    """

    project = QgsProject.instance()

    if not project.fileName():
        print("[!] Aucun projet QGIS ouvert")
        return None

    manager = project.layoutManager()
    layouts = manager.layouts()

    if not layouts:
        print("[!] Aucune mise en page dans le projet")
        return None

    # Selection de la mise en page
    if layout_name:
        layout = manager.layoutByName(layout_name)
        if not layout:
            print(f"[!] Mise en page '{layout_name}' non trouvee")
            print(f"    Disponibles: {[l.name() for l in layouts]}")
            return None
    else:
        layout = layouts[0]
        print(f"[i] Utilisation de la mise en page: {layout.name()}")

    # Chemin de sortie
    if output_path is None:
        suffix = datetime.now().strftime("%Y%m%d") if add_date else ""
        output_path = get_output_path(layout.name(), suffix=suffix)

    # Configuration export
    exporter = QgsLayoutExporter(layout)
    settings = QgsLayoutExporter.PdfExportSettings()
    settings.dpi = dpi
    settings.forceVectorOutput = True
    settings.appendGeoreference = True
    settings.exportMetadata = True

    print(f"\nExport: {layout.name()}")
    print(f"  -> {output_path}")
    print(f"  Resolution: {dpi} DPI")

    # Export
    result = exporter.exportToPdf(output_path, settings)

    if result == QgsLayoutExporter.Success:
        size_kb = os.path.getsize(output_path) / 1024
        print(f"  OK ({size_kb:.0f} KB)")

        if open_after:
            os.startfile(output_path)

        return output_path
    else:
        errors = {
            1: "Annule", 2: "Memoire", 3: "Fichier",
            4: "Impression", 5: "SVG", 6: "Iterateur"
        }
        print(f"  ECHEC: {errors.get(result, result)}")
        return None


def export_all_layouts(output_dir=None, dpi=DEFAULT_DPI, add_date=True):
    """
    Exporte toutes les mises en page du projet en PDF

    Args:
        output_dir: Dossier de sortie (None = dossier du projet)
        dpi: Resolution
        add_date: Ajouter la date aux noms

    Returns:
        list: Liste des PDFs generes
    """

    project = QgsProject.instance()
    manager = project.layoutManager()
    layouts = manager.layouts()

    if not layouts:
        print("[!] Aucune mise en page")
        return []

    print(f"\nExport de {len(layouts)} mise(s) en page...")
    print("=" * 50)

    results = []
    for layout in layouts:
        suffix = datetime.now().strftime("%Y%m%d") if add_date else ""
        output_path = get_output_path(layout.name(), output_dir, suffix)

        pdf = export_pdf(layout.name(), output_path, dpi)
        if pdf:
            results.append(pdf)

    print("=" * 50)
    print(f"Termine: {len(results)}/{len(layouts)} exports reussis")

    return results


def zoom_to_extent(xmin, ymin, xmax, ymax):
    """Zoome le canevas sur une emprise donnee"""

    from qgis.utils import iface

    extent = QgsRectangle(xmin, ymin, xmax, ymax)
    iface.mapCanvas().setExtent(extent)
    iface.mapCanvas().refresh()

    print(f"Vue: [{xmin:.0f}, {ymin:.0f}] - [{xmax:.0f}, {ymax:.0f}]")


def zoom_to_layer(layer_name):
    """Zoome sur l'emprise d'une couche"""

    from qgis.utils import iface

    project = QgsProject.instance()
    layers = project.mapLayersByName(layer_name)

    if not layers:
        print(f"[!] Couche '{layer_name}' non trouvee")
        return

    layer = layers[0]
    iface.mapCanvas().setExtent(layer.extent())
    iface.mapCanvas().refresh()

    print(f"Vue sur: {layer_name}")


def list_layouts():
    """Liste les mises en page disponibles"""

    project = QgsProject.instance()
    manager = project.layoutManager()

    print("\nMises en page disponibles:")
    for i, layout in enumerate(manager.layouts(), 1):
        print(f"  {i}. {layout.name()}")


# Execution directe depuis la console QGIS
if __name__ != "__main__":
    print("\n" + "=" * 50)
    print("Export Plan de Situation - Bussigny")
    print("=" * 50)
    print("\nCommandes disponibles:")
    print("  export_pdf()           - Export mise en page")
    print("  export_pdf('nom')      - Export mise en page specifique")
    print("  export_all_layouts()   - Export toutes les mises en page")
    print("  list_layouts()         - Liste les mises en page")
    print("  zoom_to_layer('nom')   - Zoom sur une couche")
    print("")
