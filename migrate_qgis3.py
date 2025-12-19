#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de migration automatique PyQT4 -> PyQT5/QGIS 3.x
Auteur: GeoBrain
Date: 2025-12-19
"""

import os
import re
from pathlib import Path

# Répertoire cible
TARGET_DIR = Path(r"C:\Users\zema\GeoBrain\VDLTools\tools")

# Patterns de remplacement
REPLACEMENTS = [
    # Import PyQt4 -> qgis.PyQt
    (r'from PyQt4\.QtCore import', 'from qgis.PyQt.QtCore import'),
    (r'from PyQt4\.QtGui import (Q[A-Z]\w+(?:, Q[A-Z]\w+)*)', lambda m: f'from qgis.PyQt.QtWidgets import {m.group(1)}' if any(w in m.group(1) for w in ['QDialog', 'QPushButton', 'QWidget', 'QProgressBar', 'QMessageBox']) else f'from qgis.PyQt.QtGui import {m.group(1)}'),

    # QGis -> Qgis
    (r'\bQGis\.Line\b', 'Qgis.GeometryType.Line'),
    (r'\bQGis\.Point\b', 'Qgis.GeometryType.Point'),
    (r'\bQGis\.Polygon\b', 'Qgis.GeometryType.Polygon'),
    (r'\bQGis\.fromOldWkbType\(', 'QgsWkbTypes.geometryType('),
    (r'\bQGis\b', 'Qgis'),

    # QgsMessageBar levels
    (r'QgsMessageBar\.CRITICAL', 'Qgis.Critical'),
    (r'QgsMessageBar\.INFO', 'Qgis.Info'),
    (r'QgsMessageBar\.WARNING', 'Qgis.Warning'),

    # Geometry V2 classes
    (r'\bQgsPointV2\b', 'QgsPoint'),
    (r'\bQgsLineStringV2\b', 'QgsLineString'),
    (r'\bQgsCircularStringV2\b', 'QgsCircularString'),
    (r'\bQgsCurvePolygonV2\b', 'QgsCurvePolygon'),
    (r'\bQgsCompoundCurveV2\b', 'QgsCompoundCurve'),
    (r'\bQgsPolygonV2\b', 'QgsPolygon'),

    # QgsDataSourceURI -> QgsDataSourceUri
    (r'\bQgsDataSourceURI\b', 'QgsDataSourceUri'),

    # Layer methods
    (r'\.setSelectedFeatures\(\[([\w, ]+)\]\)', r'.selectByIds([\1])'),
    (r'\.pendingFields\(\)', '.fields()'),
    (r'\.setCacheImage\(None\)', '  # setCacheImage obsolete in QGIS 3'),
    (r'\.rendererV2\(\)', '.renderer()'),

    # QgsEditFormConfig
    (r'QgsEditFormConfig\.SuppressOn', 'Qgis.AttributeFormSuppression.On'),

    # Remove future imports
    (r'from __future__ import division\n', ''),
    (r'from future\.builtins import .*\n', ''),
    (r'from past\.utils import old_div\n', ''),

    # Replace old_div
    (r'old_div\(([^,]+),\s*([^)]+)\)', r'(\1 / \2)'),

    # QgsGeometry().fromPoint -> QgsGeometry.fromPointXY
    (r'QgsGeometry\(\)\.fromPoint\(', 'QgsGeometry.fromPointXY(QgsPointXY('),

    # QgsMapLayerRegistry -> QgsProject
    (r'QgsMapLayerRegistry\.instance\(\)\.addMapLayer', 'QgsProject.instance().addMapLayer'),
]

def migrate_file(filepath):
    """Migre un fichier Python vers QGIS 3.x"""
    print(f"Migration de {filepath.name}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Ajout du commentaire de migration en haut
    if not content.startswith('# Migrated to QGIS 3.x by GeoBrain'):
        lines = content.split('\n')
        # Insérer après la première ligne (# -*- coding: utf-8 -*-)
        if lines[0].startswith('#'):
            lines.insert(1, '# Migrated to QGIS 3.x by GeoBrain (2025)')
            content = '\n'.join(lines)

    # Appliquer les remplacements
    for pattern, replacement in REPLACEMENTS:
        if callable(replacement):
            content = re.sub(pattern, replacement, content)
        else:
            content = re.sub(pattern, replacement, content)

    # Gestion spéciale des imports PyQt4.QtGui
    # Séparer les widgets et les graphiques
    def split_qtgui_imports(match):
        imports = match.group(1).split(',')
        imports = [i.strip() for i in imports]

        widgets = []
        graphics = []

        widget_classes = ['QDialog', 'QPushButton', 'QWidget', 'QProgressBar',
                         'QProgressDialog', 'QMessageBox', 'QLabel', 'QLineEdit',
                         'QCheckBox', 'QRadioButton', 'QComboBox', 'QSpinBox',
                         'QDoubleSpinBox', 'QTextEdit', 'QPlainTextEdit',
                         'QTreeWidget', 'QTableWidget', 'QListWidget',
                         'QGroupBox', 'QTabWidget', 'QScrollArea', 'QToolButton',
                         'QSlider', 'QDial', 'QCalendarWidget']

        for imp in imports:
            if any(widget in imp for widget in widget_classes):
                widgets.append(imp)
            else:
                graphics.append(imp)

        result = []
        if widgets:
            result.append(f"from qgis.PyQt.QtWidgets import {', '.join(widgets)}")
        if graphics:
            result.append(f"from qgis.PyQt.QtGui import {', '.join(graphics)}")

        return '\n'.join(result) if result else match.group(0)

    content = re.sub(r'from PyQt4\.QtGui import ([^)]+)', split_qtgui_imports, content)

    # Écrire le fichier migré
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"  [OK] {filepath.name} migre avec succes")

def main():
    """Fonction principale"""
    print("=== Migration VDLTools vers QGIS 3.x ===\n")

    # Liste des fichiers à migrer
    files_to_migrate = [
        'control_tool.py',
        'drawndown_tool.py',
        'duplicate_tool.py',
        'extrapolate_tool.py',
        'import_measures.py',
        'interpolate_tool.py',
        'intersect_tool.py',
        'move_tool.py',
        'multi_attributes_tool.py',
        'pointer_tool.py',
        'profile_tool.py',
        'rebuild_index.py',
        'show_settings.py',
        'subprofile_tool.py',
    ]

    migrated_count = 0
    for filename in files_to_migrate:
        filepath = TARGET_DIR / filename
        if filepath.exists():
            try:
                migrate_file(filepath)
                migrated_count += 1
            except Exception as e:
                print(f"  [ERREUR] Erreur lors de la migration de {filename}: {e}")
        else:
            print(f"  [ATTENTION] Fichier non trouve: {filename}")

    print(f"\n=== Migration terminee ===")
    print(f"{migrated_count}/{len(files_to_migrate)} fichiers migres avec succes")

if __name__ == '__main__':
    main()
