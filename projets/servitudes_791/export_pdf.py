"""
Export PDF - Plan de situation servitudes BF 791
Chemin du Cedre 35, Bussigny

USAGE dans la console Python de QGIS:
  1. Ouvrir servitudes_791.qgs
  2. Extensions > Console Python
  3. Copier-coller:

exec(open(r'C:\Users\zema\GeoBrain\projets\servitudes_791\export_pdf.py').read())
"""

import os
import sys

# Ajouter le chemin des scripts GeoBrain
sys.path.insert(0, r'C:\Users\zema\GeoBrain\scripts\python')

from export_plan_situation import export_pdf, zoom_to_extent, list_layouts

# Configuration specifique BF 791
PROJECT_DIR = r"C:\Users\zema\GeoBrain\projets\servitudes_791"
LAYOUT_NAME = "Plan de situation A4 paysage"
OUTPUT_PDF = os.path.join(PROJECT_DIR, "Plan_servitudes_BF791_Bussigny.pdf")

# Coordonnees parcelle 791
BF791_EXTENT = (2532380, 1155800, 2532560, 1156000)


def export_bf791(open_after=True):
    """Export le plan de situation de la parcelle 791"""

    print("=" * 50)
    print("Plan de situation - BF 791 - Bussigny")
    print("Chemin du Cedre 35")
    print("=" * 50)

    result = export_pdf(
        layout_name=LAYOUT_NAME,
        output_path=OUTPUT_PDF,
        dpi=300,
        open_after=open_after
    )

    if result:
        print(f"\nPDF: {result}")
    return result


def zoom_bf791():
    """Zoom sur la parcelle 791"""
    zoom_to_extent(*BF791_EXTENT)


# Execution automatique
print("\nCommandes:")
print("  export_bf791()  - Generer le PDF")
print("  zoom_bf791()    - Centrer la vue")
print("  list_layouts()  - Lister mises en page")
print("")

# Export automatique
export_bf791(open_after=True)
