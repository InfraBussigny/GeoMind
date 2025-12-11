"""
Export PDF de mise en page QGIS en ligne de commande
Commune de Bussigny - Service SIT

Usage:
  python qgis_export_pdf.py <projet.qgs> [layout_name] [output.pdf]
  python qgis_export_pdf.py --help

Exemples:
  python qgis_export_pdf.py projet.qgs
  python qgis_export_pdf.py projet.qgs "Ma mise en page" sortie.pdf
"""

import subprocess
import os
import sys
import glob
from pathlib import Path

# Recherche automatique de QGIS
def find_qgis():
    """Trouve l'installation QGIS la plus recente"""

    search_paths = [
        r"C:\Program Files\QGIS *",
        r"C:\OSGeo4W64",
        r"C:\OSGeo4W",
    ]

    qgis_dirs = []
    for pattern in search_paths:
        qgis_dirs.extend(glob.glob(pattern))

    if not qgis_dirs:
        return None

    # Trier par version (la plus recente en premier)
    qgis_dirs.sort(reverse=True)

    for qgis_dir in qgis_dirs:
        # Chercher qgis_process
        candidates = [
            os.path.join(qgis_dir, "bin", "qgis_process-qgis-ltr.bat"),
            os.path.join(qgis_dir, "bin", "qgis_process-qgis.bat"),
            os.path.join(qgis_dir, "bin", "qgis_process.bat"),
        ]
        for candidate in candidates:
            if os.path.exists(candidate):
                return candidate

    return None


def list_layouts(project_path, qgis_process=None):
    """Liste les mises en page d'un projet QGIS"""

    if qgis_process is None:
        qgis_process = find_qgis()

    if not qgis_process:
        print("ERREUR: QGIS non trouve")
        return []

    # Pas de moyen direct de lister les layouts via qgis_process
    # On doit parser le fichier .qgs
    import xml.etree.ElementTree as ET

    try:
        tree = ET.parse(project_path)
        root = tree.getroot()

        layouts = []
        for layout in root.findall(".//Layout"):
            name = layout.get("name")
            if name:
                layouts.append(name)

        return layouts
    except Exception as e:
        print(f"Erreur lecture projet: {e}")
        return []


def export_pdf(project_path, layout_name=None, output_path=None, dpi=300,
               open_after=False, qgis_process=None):
    """
    Exporte une mise en page QGIS en PDF

    Args:
        project_path: Chemin du projet .qgs
        layout_name: Nom de la mise en page (None = premiere trouvee)
        output_path: Chemin du PDF (None = auto)
        dpi: Resolution (defaut 300)
        open_after: Ouvrir le PDF apres export
        qgis_process: Chemin vers qgis_process (None = auto-detect)

    Returns:
        str: Chemin du PDF si succes, None sinon
    """

    # Trouver QGIS
    if qgis_process is None:
        qgis_process = find_qgis()

    if not qgis_process:
        print("ERREUR: QGIS non trouve sur ce systeme")
        print("Chemins recherches:")
        print("  - C:\\Program Files\\QGIS *")
        print("  - C:\\OSGeo4W64")
        print("  - C:\\OSGeo4W")
        return None

    print(f"QGIS: {qgis_process}")

    # Verifier le projet
    project_path = os.path.abspath(project_path)
    if not os.path.exists(project_path):
        print(f"ERREUR: Projet non trouve: {project_path}")
        return None

    # Trouver la mise en page
    if layout_name is None:
        layouts = list_layouts(project_path)
        if not layouts:
            print("ERREUR: Aucune mise en page dans le projet")
            return None
        layout_name = layouts[0]
        print(f"Mise en page: {layout_name} (auto)")
    else:
        print(f"Mise en page: {layout_name}")

    # Generer le chemin de sortie
    if output_path is None:
        project_dir = os.path.dirname(project_path)
        project_name = Path(project_path).stem
        output_path = os.path.join(project_dir, f"{project_name}_{layout_name.replace(' ', '_')}.pdf")

    output_path = os.path.abspath(output_path)
    print(f"Sortie: {output_path}")
    print(f"DPI: {dpi}")
    print()

    # Construire la commande
    cmd = [
        qgis_process,
        "run", "native:printlayouttopdf",
        f"--PROJECT_PATH={project_path}",
        f"--LAYOUT={layout_name}",
        f"--DPI={dpi}",
        "--FORCE_VECTOR=true",
        "--GEOREFERENCE=true",
        "--INCLUDE_METADATA=true",
        f"--OUTPUT={output_path}"
    ]

    # Executer
    print("Export en cours...")
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)

    # Verifier le resultat
    if result.returncode == 0 and os.path.exists(output_path):
        size_kb = os.path.getsize(output_path) / 1024
        print(f"\nSUCCES! PDF cree ({size_kb:.0f} KB)")
        print(f"  {output_path}")

        if open_after:
            os.startfile(output_path)

        return output_path
    else:
        print(f"\nECHEC (code {result.returncode})")
        if result.stderr:
            # Filtrer les erreurs de plugins
            errors = [l for l in result.stderr.split('\n')
                     if l and 'plugin' not in l.lower() and 'traceback' not in l.lower()]
            if errors:
                print("Erreurs:", '\n'.join(errors[:5]))
        return None


def main():
    """Point d'entree CLI"""

    if len(sys.argv) < 2 or sys.argv[1] in ['-h', '--help']:
        print(__doc__)
        print("\nQGIS detecte:", find_qgis() or "NON TROUVE")
        return

    project_path = sys.argv[1]
    layout_name = sys.argv[2] if len(sys.argv) > 2 else None
    output_path = sys.argv[3] if len(sys.argv) > 3 else None

    # Lister les layouts si demande
    if project_path == '--list' and len(sys.argv) > 2:
        layouts = list_layouts(sys.argv[2])
        print("Mises en page disponibles:")
        for i, l in enumerate(layouts, 1):
            print(f"  {i}. {l}")
        return

    result = export_pdf(
        project_path=project_path,
        layout_name=layout_name,
        output_path=output_path,
        dpi=300,
        open_after=True
    )

    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
