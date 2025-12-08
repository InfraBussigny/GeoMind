# -*- coding: utf-8 -*-
"""
Plugin "Stats Assainissement Bussigny"

Génère un fichier Excel + PDF avec statistiques du réseau d'assainissement.
Inclut les collecteurs et les chambres.
"""

import os
import csv
import traceback
from datetime import date

from qgis.PyQt.QtCore import QCoreApplication
from qgis.PyQt.QtWidgets import QAction, QFileDialog, QMessageBox
from qgis.PyQt.QtGui import QIcon

from qgis.core import (
    QgsProject,
    QgsMessageLog,
    Qgis,
    QgsWkbTypes,
    QgsDataSourceUri,
    QgsVectorLayer,
    QgsProviderRegistry,
)

# Import xlsxwriter
EXCEL_LIBRARY = None
try:
    import xlsxwriter
    EXCEL_LIBRARY = "xlsxwriter"
except ImportError:
    pass

# Import reportlab
PDF_LIBRARY = None
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm, mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.graphics.shapes import Drawing, Rect, String
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics.charts.piecharts import Pie
    PDF_LIBRARY = "reportlab"
except ImportError:
    pass

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

POSTGIS_CONNECTION_NAME = "PostGIS_Bussigny"
POSTGIS_SCHEMA = "assainissement"

# Tables
COLLECTORS_TABLE = "by_ass_collecteur"
CHAMBERS_TABLE = "by_ass_chambre"

# Champs Collecteurs
FIELD_COL_HIERARCHY = "fonction_hierarchique"
FIELD_COL_WATERTYPE = "genre_utilisation"
FIELD_COL_DIAMETER = "largeur_profil"
FIELD_COL_MATERIAL = "materiau"
FIELD_COL_STATE1 = "etat_inspection_1"
FIELD_COL_STATE2 = "etat_inspection_2"
FIELD_COL_DATE1 = "date_inspection_1"
FIELD_COL_DATE2 = "date_inspection_2"

# Champs Chambres (noms corrigés selon la BD)
FIELD_CH_OWNER = "proprietaire"
FIELD_CH_WATERTYPE = "eaux_infiltration"  # Corrigé: était "genre_utilisation"
FIELD_CH_GENRE = "genre_chambre"
FIELD_CH_SERVICE = "etat"
FIELD_CH_ACCESS = "acces"
FIELD_CH_DOUBLE = "chambre_double"
FIELD_CH_MATERIAL = "materiau_chambre"
FIELD_CH_FORME = "forme_chambre"

DEFAULT_OUTPUT_DIR = r"M:\7-Infra\0-Gest\3-Geoportail\7036_Scripts\Analyse\Rapport Assainissement"

ICON_FILENAME = "pipe.png"
LOGO_FILENAME = "logo_bussigny.png"

WATER_TYPES = ["Eaux claires", "Eaux usées", "Eaux mixtes"]
HIERARCHY_TYPES = ["Public - Principal", "Public - Secondaire", "Privé - Tertiaire"]

STATE_ORDER = [
    "Non renseigné",
    "4 - Bon état",
    "3 - Insatisfaisant",
    "2 - Défectueux",
    "1 - Détérioré",
    "0 - Fortement détérioré"
]

# Propriétaires chambres
CHAMBER_OWNER_PUBLIC = "Bussigny - Publique"

# Genre de chambre pour filtrage
CHAMBER_GENRE_VISITE = "Chambre de visite"

# Couleurs pour graphiques
COLORS_WATER = {
    "Eaux claires": '#2E75B6',
    "Eaux usées": '#C65911', 
    "Eaux mixtes": '#538135',
    "Eaux industrielles": '#7030A0'
}


# ---------------------------------------------------------------------------
# Fonctions utilitaires
# ---------------------------------------------------------------------------

def log_message(msg, level=Qgis.Info):
    QgsMessageLog.logMessage(msg, "StatsAssainissementBussigny", level)


def safe_str(value, default=""):
    if value is None:
        return default
    if hasattr(value, '__class__') and value.__class__.__name__ == 'QPyNullVariant':
        return default
    s = str(value).strip()
    return s if s else default


def normalize_empty_value(value):
    val = safe_str(value, "").strip()
    if not val:
        return "Non renseigné"
    val_lower = val.lower()
    empty_indicators = [
        "inconnu", "unknown", "null", "n/a", "na", "non renseigné",
        "non renseigne", "-", "?", "nc", "non connu", "non défini",
        "indefini", "indéfini", "pas de données", "pas de donnees"
    ]
    if val_lower in empty_indicators:
        return "Non renseigné"
    return val


def normalize_water_type(value):
    val = safe_str(value, "").strip()
    if not val:
        return "Non renseigné"
    val_lower = val.lower()
    if "clair" in val_lower:
        return "Eaux claires"
    elif "usée" in val_lower or "usee" in val_lower:
        return "Eaux usées"
    elif "mixte" in val_lower:
        return "Eaux mixtes"
    elif "industriel" in val_lower:
        return "Eaux industrielles"
    else:
        return normalize_empty_value(val)


def normalize_hierarchy(value):
    val = safe_str(value, "").strip()
    if not val:
        return "Non renseigné"
    val_lower = val.lower()
    if "principal" in val_lower:
        return "Public - Principal"
    elif "secondaire" in val_lower:
        return "Public - Secondaire"
    elif "tertiaire" in val_lower or "privé" in val_lower or "prive" in val_lower:
        return "Privé - Tertiaire"
    else:
        return normalize_empty_value(val)


def normalize_state(value):
    val = safe_str(value, "").strip()
    if not val:
        return "Non renseigné"
    val_lower = val.lower()
    if "bon" in val_lower or val.startswith("4"):
        return "4 - Bon état"
    elif "insatisfaisant" in val_lower or val.startswith("3"):
        return "3 - Insatisfaisant"
    elif "défectueux" in val_lower or "defectueux" in val_lower or val.startswith("2"):
        return "2 - Défectueux"
    elif "détérioré" in val_lower or "deteriore" in val_lower:
        if "fortement" in val_lower or val.startswith("0"):
            return "0 - Fortement détérioré"
        else:
            return "1 - Détérioré"
    elif val.startswith("1"):
        return "1 - Détérioré"
    elif val.startswith("0"):
        return "0 - Fortement détérioré"
    else:
        return "Non renseigné"


def to_python_date(val):
    if val is None:
        return None
    if hasattr(val, '__class__') and val.__class__.__name__ == 'QPyNullVariant':
        return None
    if hasattr(val, "toPyDate"):
        try:
            return val.toPyDate()
        except:
            return None
    if isinstance(val, date):
        return val
    return None


def sort_diameter_key(val):
    try:
        num = ''.join(filter(lambda x: x.isdigit() or x == '.', str(val)))
        return float(num) if num else 999999
    except:
        return 999999


def load_layer_from_postgis(table_name, geom_type=None):
    """Charge une couche depuis PostGIS."""
    try:
        project = QgsProject.instance()
        for layer in project.mapLayers().values():
            if table_name in layer.source():
                if geom_type is None or layer.geometryType() == geom_type:
                    log_message(f"Couche {table_name} trouvée dans le projet")
                    return layer

        provider_metadata = QgsProviderRegistry.instance().providerMetadata('postgres')
        if provider_metadata is None:
            log_message("Provider PostgreSQL non disponible", Qgis.Critical)
            return None
        
        connection = provider_metadata.findConnection(POSTGIS_CONNECTION_NAME)
        if connection is None:
            log_message(f"Connexion '{POSTGIS_CONNECTION_NAME}' non trouvée", Qgis.Critical)
            return None
        
        uri = QgsDataSourceUri(connection.uri())
        uri.setSchema(POSTGIS_SCHEMA)
        uri.setTable(table_name)
        
        for geom_col in ["geometry", "geom", "the_geom", "wkb_geometry"]:
            uri.setGeometryColumn(geom_col)
            layer = QgsVectorLayer(uri.uri(), table_name, "postgres")
            if layer.isValid():
                break
        
        if not layer.isValid():
            log_message(f"Impossible de charger la couche {table_name}", Qgis.Critical)
            return None
        
        QgsProject.instance().addMapLayer(layer, False)
        log_message(f"Couche {table_name} chargée: {layer.featureCount()} features")
        return layer
    except Exception as e:
        log_message(f"Erreur chargement {table_name}: {e}", Qgis.Critical)
        return None


# ---------------------------------------------------------------------------
# Collecte des stats - COLLECTEURS
# ---------------------------------------------------------------------------

def collect_collectors_stats(layer):
    """Collecte les données des collecteurs."""
    data_rows = []
    if layer is None:
        return data_rows

    fields = layer.fields()
    idx_hierarchy = fields.indexFromName(FIELD_COL_HIERARCHY)
    idx_type = fields.indexFromName(FIELD_COL_WATERTYPE)
    idx_mat = fields.indexFromName(FIELD_COL_MATERIAL)
    idx_diam = fields.indexFromName(FIELD_COL_DIAMETER)
    idx_state1 = fields.indexFromName(FIELD_COL_STATE1)
    idx_state2 = fields.indexFromName(FIELD_COL_STATE2)
    idx_date1 = fields.indexFromName(FIELD_COL_DATE1)
    idx_date2 = fields.indexFromName(FIELD_COL_DATE2)

    for feat in layer.getFeatures():
        attrs = feat.attributes()
        geom = feat.geometry()
        if geom is None or geom.isEmpty():
            continue
        length = geom.length()
        if length <= 0:
            continue

        hierarchy = normalize_hierarchy(attrs[idx_hierarchy] if idx_hierarchy != -1 else None)
        wt = normalize_water_type(attrs[idx_type] if idx_type != -1 else None)
        mat = normalize_empty_value(attrs[idx_mat] if idx_mat != -1 else None)
        diam = normalize_empty_value(attrs[idx_diam] if idx_diam != -1 else None)

        latest_date = None
        latest_state = None
        d1 = to_python_date(attrs[idx_date1]) if idx_date1 != -1 else None
        s1 = attrs[idx_state1] if idx_state1 != -1 else None
        if d1 is not None:
            latest_date = d1
            latest_state = s1
        d2 = to_python_date(attrs[idx_date2]) if idx_date2 != -1 else None
        s2 = attrs[idx_state2] if idx_state2 != -1 else None
        if d2 is not None:
            if latest_date is None or d2 > latest_date:
                latest_state = s2

        state_label = normalize_state(latest_state)
        data_rows.append((hierarchy, wt, mat, diam, state_label, length))

    log_message(f"Collecteurs: {len(data_rows)} tronçons")
    return data_rows


# ---------------------------------------------------------------------------
# Collecte des stats - CHAMBRES
# ---------------------------------------------------------------------------

def collect_chambers_stats(layer):
    """Collecte les données des chambres."""
    data_rows = []
    if layer is None:
        return data_rows

    fields = layer.fields()
    idx_owner = fields.indexFromName(FIELD_CH_OWNER)
    idx_type = fields.indexFromName(FIELD_CH_WATERTYPE)
    idx_genre = fields.indexFromName(FIELD_CH_GENRE)
    idx_service = fields.indexFromName(FIELD_CH_SERVICE)
    idx_access = fields.indexFromName(FIELD_CH_ACCESS)
    idx_double = fields.indexFromName(FIELD_CH_DOUBLE)
    idx_material = fields.indexFromName(FIELD_CH_MATERIAL)
    idx_forme = fields.indexFromName(FIELD_CH_FORME)

    log_message(f"Index chambres: owner={idx_owner}, type={idx_type}, genre={idx_genre}, service={idx_service}, access={idx_access}, double={idx_double}, material={idx_material}, forme={idx_forme}")

    # Collecter les valeurs uniques pour debug
    owners_found = set()
    types_found = set()
    services_found = set()
    access_found = set()

    for feat in layer.getFeatures():
        attrs = feat.attributes()

        # Propriétaire: garder la valeur telle quelle de la BD
        owner_raw = safe_str(attrs[idx_owner] if idx_owner != -1 else None, "")
        owner = owner_raw if owner_raw else "Non renseigné"
        owners_found.add(owner)

        # Type d'eau: normaliser pour avoir des noms cohérents
        wt_raw = safe_str(attrs[idx_type] if idx_type != -1 else None, "")
        wt = normalize_water_type(wt_raw) if wt_raw else "Non renseigné"
        types_found.add(wt_raw)
        
        # Genre
        genre = normalize_empty_value(attrs[idx_genre] if idx_genre != -1 else None)
        
        # Service: garder la valeur telle quelle
        service_raw = safe_str(attrs[idx_service] if idx_service != -1 else None, "")
        service = service_raw if service_raw else "Non renseigné"
        services_found.add(service)
        
        # Accessibilité: garder la valeur telle quelle
        access_raw = safe_str(attrs[idx_access] if idx_access != -1 else None, "")
        access = access_raw if access_raw else "Non renseigné"
        access_found.add(access)
        
        # Chambre double
        double_val = safe_str(attrs[idx_double] if idx_double != -1 else None, "")
        is_double = "Double" if double_val else "Simple"
        
        # Matériau
        material = normalize_empty_value(attrs[idx_material] if idx_material != -1 else None)
        
        # Forme
        forme = normalize_empty_value(attrs[idx_forme] if idx_forme != -1 else None)

        data_rows.append((owner, wt, genre, service, access, is_double, material, forme))

    log_message(f"Chambres: {len(data_rows)} éléments")
    log_message(f"Propriétaires trouvés: {owners_found}")
    log_message(f"Types d'eau (raw): {types_found}")
    log_message(f"Services trouvés: {services_found}")
    log_message(f"Accessibilités trouvées: {access_found}")
    
    return data_rows


# ---------------------------------------------------------------------------
# Agrégation des données
# ---------------------------------------------------------------------------

def aggregate_collectors(data_rows, key_index, hierarchy_filter=None, water_type_filter=None):
    """Agrège les données des collecteurs (longueur)."""
    agg = {}
    for row in data_rows:
        hierarchy, wt, mat, diam, state, length = row
        if hierarchy_filter and hierarchy != hierarchy_filter:
            continue
        if water_type_filter and wt != water_type_filter:
            continue
        
        if key_index == 1:
            key = wt
        elif key_index == 2:
            key = mat
        elif key_index == 3:
            key = diam
        elif key_index == 4:
            key = state
        else:
            key = wt
        
        agg[key] = agg.get(key, 0) + length
    return agg


def aggregate_chambers(data_rows, key_index, owner_filter=None, genre_filter=None):
    """Agrège les données des chambres (comptage)."""
    agg = {}
    for row in data_rows:
        owner, wt, genre, service, access, is_double, material, forme = row
        if owner_filter and owner != owner_filter:
            continue
        if genre_filter and genre != genre_filter:
            continue
        
        if key_index == 0:
            key = owner
        elif key_index == 1:
            key = wt
        elif key_index == 2:
            key = genre
        elif key_index == 3:
            key = service
        elif key_index == 4:
            key = access
        elif key_index == 5:
            key = is_double
        elif key_index == 6:
            key = material
        elif key_index == 7:
            key = forme
        else:
            key = wt
        
        agg[key] = agg.get(key, 0) + 1
    return agg


def aggregate_chambers_cross(data_rows, owner_filter=None, genre_filter=None):
    """Agrège les chambres en croisant Service × Accessibilité."""
    cross = {}
    for row in data_rows:
        owner, wt, genre, service, access, is_double, material, forme = row
        if owner_filter and owner != owner_filter:
            continue
        if genre_filter and genre != genre_filter:
            continue
        
        key = (service, access)
        cross[key] = cross.get(key, 0) + 1
    return cross


def get_unique_values(data_rows, key_index):
    """Récupère les valeurs uniques pour un index donné."""
    values = set()
    for row in data_rows:
        values.add(row[key_index])
    return sorted(values)


# ---------------------------------------------------------------------------
# Plugin QGIS
# ---------------------------------------------------------------------------

class StatsAssainissementBussignyPlugin:

    def __init__(self, iface):
        self.iface = iface
        self.plugin_dir = os.path.dirname(__file__)
        self.action = None

    def initGui(self):
        icon_path = os.path.join(self.plugin_dir, ICON_FILENAME)
        icon = QIcon(icon_path) if os.path.exists(icon_path) else QIcon.fromTheme("mActionCalculateField")
        self.action = QAction(icon, "Stats Assainissement Bussigny", self.iface.mainWindow())
        self.action.triggered.connect(self.run)
        self.iface.addPluginToMenu("&Stats Assainissement", self.action)
        self.iface.addToolBarIcon(self.action)

    def unload(self):
        if self.action:
            self.iface.removePluginMenu("&Stats Assainissement", self.action)
            self.iface.removeToolBarIcon(self.action)

    def run(self):
        # Charger les couches
        collectors_layer = load_layer_from_postgis(COLLECTORS_TABLE, QgsWkbTypes.LineGeometry)
        chambers_layer = load_layer_from_postgis(CHAMBERS_TABLE, QgsWkbTypes.PointGeometry)

        if collectors_layer is None:
            QMessageBox.warning(self.iface.mainWindow(), "Stats Assainissement",
                                f"Couche collecteurs introuvable ('{COLLECTORS_TABLE}')")
            return

        if chambers_layer is None:
            QMessageBox.warning(self.iface.mainWindow(), "Stats Assainissement",
                                f"Couche chambres introuvable ('{CHAMBERS_TABLE}')")
            return

        default_dir = DEFAULT_OUTPUT_DIR if os.path.isdir(DEFAULT_OUTPUT_DIR) else os.path.expanduser("~")
        today_str = date.today().strftime("%Y_%m_%d")
        default_name = f"{today_str}_stats_assainissement_bussigny.xlsx"
        filename, _ = QFileDialog.getSaveFileName(self.iface.mainWindow(), "Enregistrer le rapport",
                                                   os.path.join(default_dir, default_name), "Fichiers Excel (*.xlsx)")
        if not filename:
            return

        # Définir le chemin du PDF (remplacement forcé si existant)
        pdf_filename = filename.replace('.xlsx', '.pdf')
        generate_pdf = True
        if os.path.exists(pdf_filename):
            try:
                os.remove(pdf_filename)
                log_message(f"Ancien PDF supprimé: {pdf_filename}")
            except Exception as e:
                log_message(f"Impossible de supprimer l'ancien PDF: {e}", Qgis.Warning)
                generate_pdf = False

        # Collecter les données
        collectors_data = collect_collectors_stats(collectors_layer)
        chambers_data = collect_chambers_stats(chambers_layer)

        try:
            self.write_excel(filename, collectors_data, chambers_data)
        except Exception as e:
            log_message(f"Erreur Excel: {e}", Qgis.Critical)
            log_message(traceback.format_exc(), Qgis.Critical)
            QMessageBox.critical(self.iface.mainWindow(), "Erreur", f"Erreur Excel:\n{e}")
            return

        # Générer le PDF
        if generate_pdf and PDF_LIBRARY:
            try:
                self.write_pdf(pdf_filename, collectors_data, chambers_data)
                log_message(f"PDF généré: {pdf_filename}")
            except Exception as e:
                log_message(f"Erreur PDF: {e}", Qgis.Warning)
                log_message(traceback.format_exc(), Qgis.Warning)
                pdf_filename = None
        else:
            pdf_filename = None

        msg = f"Rapports créés:\n- {filename}"
        if pdf_filename:
            msg += f"\n- {pdf_filename}"
        self.iface.messageBar().pushMessage("Stats Assainissement", msg, level=Qgis.Info, duration=8)

    # =======================================================================
    # EXCEL
    # =======================================================================

    def write_excel(self, filename, collectors_data, chambers_data):
        import xlsxwriter
        workbook = xlsxwriter.Workbook(filename)

        # Formats
        header_fmt = workbook.add_format({'bold': True, 'font_color': 'white', 'bg_color': '#366092', 'align': 'center', 'border': 1})
        number_fmt = workbook.add_format({'num_format': '#,##0.00'})
        int_fmt = workbook.add_format({'num_format': '#,##0'})
        total_fmt = workbook.add_format({'bold': True, 'bg_color': '#D9E1F2', 'num_format': '#,##0.00', 'border': 1})
        total_int_fmt = workbook.add_format({'bold': True, 'bg_color': '#D9E1F2', 'num_format': '#,##0', 'border': 1})
        total_label_fmt = workbook.add_format({'bold': True, 'bg_color': '#D9E1F2', 'border': 1})
        title_fmt = workbook.add_format({'bold': True, 'font_size': 14, 'font_color': '#366092'})
        
        ec_fmt = workbook.add_format({'bold': True, 'font_color': '#2E75B6', 'font_size': 11})
        eu_fmt = workbook.add_format({'bold': True, 'font_color': '#C65911', 'font_size': 11})
        em_fmt = workbook.add_format({'bold': True, 'font_color': '#538135', 'font_size': 11})

        # ===== COLLECTEURS =====
        self._write_collectors_excel(workbook, collectors_data, header_fmt, number_fmt, total_fmt, 
                                     total_label_fmt, title_fmt, ec_fmt, eu_fmt, em_fmt)

        # ===== CHAMBRES =====
        self._write_chambers_excel(workbook, chambers_data, header_fmt, int_fmt, total_int_fmt,
                                   total_label_fmt, title_fmt)

        workbook.close()

    def _write_collectors_excel(self, workbook, data, header_fmt, number_fmt, total_fmt,
                                 total_label_fmt, title_fmt, ec_fmt, eu_fmt, em_fmt):
        """Écrit les onglets collecteurs."""
        
        # Données brutes
        ws = workbook.add_worksheet("Collecteurs - Données")
        headers = ["Fonction", "Type d'eau", "Matériau", "Diamètre", "État", "Longueur (m)"]
        for col, h in enumerate(headers):
            ws.write(0, col, h, header_fmt)
        for row_idx, row in enumerate(data, 1):
            for col, val in enumerate(row):
                if col == 5:
                    ws.write(row_idx, col, round(val, 2), number_fmt)
                else:
                    ws.write(row_idx, col, val)
        ws.autofilter(0, 0, len(data), 5)
        ws.set_column(0, 5, 18)

        # Par type d'eau
        ws = workbook.add_worksheet("Collecteurs - Type eau")
        ws.write(0, 0, "Récapitulatif par type d'eau", title_fmt)
        self._write_collectors_water_type(ws, workbook, data, header_fmt, number_fmt, total_fmt, total_label_fmt)

        # Par matériau
        ws = workbook.add_worksheet("Collecteurs - Matériau")
        ws.write(0, 0, "Récapitulatif par matériau (Public - Principal)", title_fmt)
        self._write_collectors_detail(ws, workbook, data, 2, "Matériau", header_fmt, number_fmt, total_fmt, total_label_fmt, ec_fmt, eu_fmt, em_fmt)

        # Par diamètre (top 10)
        ws = workbook.add_worksheet("Collecteurs - Diamètre")
        ws.write(0, 0, "Récapitulatif par diamètre - Top 10 (Public - Principal)", title_fmt)
        self._write_collectors_diameter(ws, workbook, data, header_fmt, number_fmt, total_fmt, total_label_fmt, ec_fmt, eu_fmt, em_fmt)

        # Par état
        ws = workbook.add_worksheet("Collecteurs - État")
        ws.write(0, 0, "Récapitulatif par état (Public - Principal)", title_fmt)
        self._write_collectors_detail(ws, workbook, data, 4, "État", header_fmt, number_fmt, total_fmt, total_label_fmt, ec_fmt, eu_fmt, em_fmt, use_state_order=True)

    def _write_collectors_water_type(self, ws, workbook, data, header_fmt, number_fmt, total_fmt, total_label_fmt):
        """Onglet type d'eau avec les 3 fonctions hiérarchiques."""
        row = 2
        hierarchy_colors = [
            ("Public - Principal", '#366092', '#D9E1F2'),
            ("Public - Secondaire", '#7030A0', '#E4DFEC'),
            ("Privé - Tertiaire", '#C65911', '#FCE4D6'),
        ]
        
        chart_col = 5
        for hierarchy, hdr_color, bg_color in hierarchy_colors:
            section = workbook.add_format({'bold': True, 'font_size': 12, 'font_color': hdr_color})
            ws.write(row, 0, hierarchy.upper(), section)
            row += 1
            
            hdr = workbook.add_format({'bold': True, 'font_color': 'white', 'bg_color': hdr_color, 'align': 'center', 'border': 1})
            ws.write(row, 0, "Type d'eau", hdr)
            ws.write(row, 1, "Longueur (m)", hdr)
            ws.write(row, 2, "%", hdr)
            row += 1
            
            agg = aggregate_collectors(data, 1, hierarchy, None)
            total = sum(agg.values())
            start_row = row
            
            for wt in WATER_TYPES:
                val = agg.get(wt, 0)
                pct = (val / total * 100) if total > 0 else 0
                ws.write(row, 0, wt)
                ws.write(row, 1, round(val, 2), number_fmt)
                ws.write(row, 2, round(pct, 1))
                row += 1
            
            total_bg = workbook.add_format({'bold': True, 'bg_color': bg_color, 'border': 1})
            total_num = workbook.add_format({'bold': True, 'bg_color': bg_color, 'num_format': '#,##0.00', 'border': 1})
            ws.write(row, 0, "TOTAL", total_bg)
            ws.write(row, 1, round(total, 2), total_num)
            ws.write(row, 2, 100.0 if total > 0 else 0, total_bg)
            
            # Graphique camembert aligné avec le tableau
            chart = workbook.add_chart({'type': 'pie'})
            chart.add_series({
                'categories': [ws.name, start_row, 0, row - 1, 0],
                'values': [ws.name, start_row, 1, row - 1, 1],
                'data_labels': {'percentage': True}
            })
            chart.set_title({'name': hierarchy})
            chart.set_size({'width': 300, 'height': 180})
            ws.insert_chart(start_row - 2, chart_col, chart)
            
            row += 3

        ws.set_column(0, 0, 20)
        ws.set_column(1, 2, 12)

    def _write_collectors_detail(self, ws, workbook, data, key_idx, title, header_fmt, number_fmt, 
                                  total_fmt, total_label_fmt, ec_fmt, eu_fmt, em_fmt, use_state_order=False):
        """Onglet détail par matériau/état."""
        row = 2
        wt_formats = {"Eaux claires": (ec_fmt, '#2E75B6'), "Eaux usées": (eu_fmt, '#C65911'), "Eaux mixtes": (em_fmt, '#538135')}
        chart_col = 5

        for wt in WATER_TYPES:
            fmt, color = wt_formats[wt]
            ws.write(row, 0, f"► {wt.upper()}", fmt)
            row += 1
            ws.write(row, 0, title, header_fmt)
            ws.write(row, 1, "Longueur (m)", header_fmt)
            ws.write(row, 2, "%", header_fmt)
            row += 1

            agg = aggregate_collectors(data, key_idx, "Public - Principal", wt)
            total = sum(agg.values())
            start_row = row

            if use_state_order:
                keys = STATE_ORDER
            else:
                keys = sorted(agg.keys())

            for key in keys:
                val = agg.get(key, 0)
                pct = (val / total * 100) if total > 0 else 0
                if use_state_order or val > 0:
                    ws.write(row, 0, str(key))
                    ws.write(row, 1, round(val, 2), number_fmt)
                    ws.write(row, 2, round(pct, 1))
                    row += 1

            ws.write(row, 0, "TOTAL", total_label_fmt)
            ws.write(row, 1, round(total, 2), total_fmt)
            ws.write(row, 2, 100.0 if total > 0 else 0, total_label_fmt)

            # Graphique barres aligné avec le tableau
            if total > 0:
                chart = workbook.add_chart({'type': 'column'})
                chart.add_series({
                    'categories': [ws.name, start_row, 0, row - 1, 0],
                    'values': [ws.name, start_row, 1, row - 1, 1],
                    'fill': {'color': color}
                })
                chart.set_title({'name': f'{title} - {wt}'})
                chart.set_y_axis({'num_format': '#,##0'})
                chart.set_legend({'none': True})
                chart.set_size({'width': 380, 'height': 200})
                ws.insert_chart(start_row - 2, chart_col, chart)

            row += 3

        ws.set_column(0, 0, 25)
        ws.set_column(1, 2, 12)

    def _write_collectors_diameter(self, ws, workbook, data, header_fmt, number_fmt, 
                                    total_fmt, total_label_fmt, ec_fmt, eu_fmt, em_fmt):
        """Onglet diamètre - Top 10 par type d'eau."""
        row = 2
        wt_formats = {"Eaux claires": (ec_fmt, '#2E75B6'), "Eaux usées": (eu_fmt, '#C65911'), "Eaux mixtes": (em_fmt, '#538135')}
        chart_col = 5

        for wt in WATER_TYPES:
            fmt, color = wt_formats[wt]
            ws.write(row, 0, f"► {wt.upper()}", fmt)
            row += 1
            ws.write(row, 0, "Diamètre (mm)", header_fmt)
            ws.write(row, 1, "Longueur (m)", header_fmt)
            ws.write(row, 2, "%", header_fmt)
            row += 1

            agg = aggregate_collectors(data, 3, "Public - Principal", wt)
            
            top10 = sorted(agg.items(), key=lambda x: x[1], reverse=True)[:10]
            top10_sorted = sorted(top10, key=lambda x: sort_diameter_key(x[0]))
            
            total = sum(v for k, v in top10_sorted)
            total_all = sum(agg.values())
            start_row = row

            for key, val in top10_sorted:
                pct = (val / total_all * 100) if total_all > 0 else 0
                ws.write(row, 0, str(key))
                ws.write(row, 1, round(val, 2), number_fmt)
                ws.write(row, 2, round(pct, 1))
                row += 1

            if len(agg) > 10:
                autres = total_all - total
                pct_autres = (autres / total_all * 100) if total_all > 0 else 0
                ws.write(row, 0, "Autres")
                ws.write(row, 1, round(autres, 2), number_fmt)
                ws.write(row, 2, round(pct_autres, 1))
                row += 1

            ws.write(row, 0, "TOTAL", total_label_fmt)
            ws.write(row, 1, round(total_all, 2), total_fmt)
            ws.write(row, 2, 100.0 if total_all > 0 else 0, total_label_fmt)

            # Graphique
            if total > 0:
                chart = workbook.add_chart({'type': 'column'})
                chart.add_series({
                    'categories': [ws.name, start_row, 0, start_row + len(top10_sorted) - 1, 0],
                    'values': [ws.name, start_row, 1, start_row + len(top10_sorted) - 1, 1],
                    'fill': {'color': color}
                })
                chart.set_title({'name': f'Diamètre - {wt}'})
                chart.set_y_axis({'num_format': '#,##0'})
                chart.set_legend({'none': True})
                chart.set_size({'width': 380, 'height': 200})
                ws.insert_chart(start_row - 2, chart_col, chart)

            row += 3

        ws.set_column(0, 0, 20)
        ws.set_column(1, 2, 12)

    def _write_chambers_excel(self, workbook, data, header_fmt, int_fmt, total_int_fmt,
                               total_label_fmt, title_fmt):
        """Écrit les onglets chambres."""
        
        # Récupérer les valeurs uniques de propriétaire
        owners = get_unique_values(data, 0)
        log_message(f"Propriétaires uniques: {owners}")
        
        # Données brutes
        ws = workbook.add_worksheet("Chambres - Données")
        headers = ["Propriétaire", "Type d'eau", "Genre", "Service", "Accessibilité", "Simple/Double", "Matériau", "Forme"]
        for col, h in enumerate(headers):
            ws.write(0, col, h, header_fmt)
        for row_idx, row in enumerate(data, 1):
            for col, val in enumerate(row):
                ws.write(row_idx, col, val)
        ws.autofilter(0, 0, len(data), len(headers) - 1)
        ws.set_column(0, len(headers) - 1, 18)

        # Par propriétaire
        ws = workbook.add_worksheet("Chambres - Propriétaire")
        ws.write(0, 0, "Répartition par propriétaire et type d'eau", title_fmt)
        self._write_chambers_owner(ws, workbook, data, header_fmt, int_fmt, total_int_fmt, total_label_fmt)

        # Par propriétaire (Chambres de visite uniquement)
        ws = workbook.add_worksheet("Ch. Visite - Propriétaire")
        ws.write(0, 0, "Répartition par propriétaire et type d'eau (Chambres de visite)", title_fmt)
        self._write_chambers_owner(ws, workbook, data, header_fmt, int_fmt, total_int_fmt, total_label_fmt, CHAMBER_GENRE_VISITE)

        # Par genre (Public uniquement)
        ws = workbook.add_worksheet("Chambres - Genre")
        ws.write(0, 0, "Répartition par genre (Bussigny - Publique)", title_fmt)
        self._write_chambers_simple_with_chart(ws, workbook, data, 2, "Genre de chambre", header_fmt, int_fmt, total_int_fmt, total_label_fmt, CHAMBER_OWNER_PUBLIC, None, 'column')

        # Service/Accessibilité (Chambres de visite uniquement)
        ws = workbook.add_worksheet("Ch. Visite - Service")
        ws.write(0, 0, "Service × Accessibilité (Chambres de visite publiques)", title_fmt)
        self._write_chambers_cross(ws, workbook, data, header_fmt, int_fmt, total_int_fmt, total_label_fmt)

        # Simple/Double (Chambres de visite uniquement)
        ws = workbook.add_worksheet("Ch. Visite - Simple-Double")
        ws.write(0, 0, "Simple / Double (Chambres de visite publiques)", title_fmt)
        self._write_chambers_simple_with_chart(ws, workbook, data, 5, "Type", header_fmt, int_fmt, total_int_fmt, total_label_fmt, CHAMBER_OWNER_PUBLIC, CHAMBER_GENRE_VISITE, 'pie')

        # Par matériau (Chambres de visite uniquement)
        ws = workbook.add_worksheet("Ch. Visite - Matériau")
        ws.write(0, 0, "Répartition par matériau (Chambres de visite publiques)", title_fmt)
        self._write_chambers_simple_with_chart(ws, workbook, data, 6, "Matériau", header_fmt, int_fmt, total_int_fmt, total_label_fmt, CHAMBER_OWNER_PUBLIC, CHAMBER_GENRE_VISITE, 'column')

        # Par forme (Chambres de visite uniquement)
        ws = workbook.add_worksheet("Ch. Visite - Forme")
        ws.write(0, 0, "Répartition par forme (Chambres de visite publiques)", title_fmt)
        self._write_chambers_simple_with_chart(ws, workbook, data, 7, "Forme", header_fmt, int_fmt, total_int_fmt, total_label_fmt, CHAMBER_OWNER_PUBLIC, CHAMBER_GENRE_VISITE, 'column')

    def _write_chambers_owner(self, ws, workbook, data, header_fmt, int_fmt, total_int_fmt, total_label_fmt, genre_filter=None):
        """Onglet propriétaire avec type d'eau et graphiques camembert."""
        row = 2
        
        # Récupérer les propriétaires et types d'eau uniques
        owners = get_unique_values(data, 0)
        water_types = get_unique_values(data, 1)
        
        owner_colors = {
            'Bussigny - Publique': ('#366092', '#D9E1F2'),
            'Privée': ('#C65911', '#FCE4D6'),
        }
        
        chart_col = 5
        
        for owner in owners:
            if owner == "Non renseigné":
                continue
                
            hdr_color, bg_color = owner_colors.get(owner, ('#808080', '#E0E0E0'))
            
            section = workbook.add_format({'bold': True, 'font_size': 12, 'font_color': hdr_color})
            ws.write(row, 0, owner.upper(), section)
            row += 1

            hdr = workbook.add_format({'bold': True, 'font_color': 'white', 'bg_color': hdr_color, 'align': 'center', 'border': 1})
            ws.write(row, 0, "Type d'eau", hdr)
            ws.write(row, 1, "Nombre", hdr)
            ws.write(row, 2, "%", hdr)
            row += 1

            agg = aggregate_chambers(data, 1, owner, genre_filter)
            total = sum(agg.values())
            start_row = row

            for wt in water_types:
                val = agg.get(wt, 0)
                pct = (val / total * 100) if total > 0 else 0
                ws.write(row, 0, wt)
                ws.write(row, 1, val, int_fmt)
                ws.write(row, 2, round(pct, 1))
                row += 1

            total_bg = workbook.add_format({'bold': True, 'bg_color': bg_color, 'border': 1})
            total_num = workbook.add_format({'bold': True, 'bg_color': bg_color, 'num_format': '#,##0', 'border': 1})
            ws.write(row, 0, "TOTAL", total_bg)
            ws.write(row, 1, total, total_num)
            ws.write(row, 2, 100.0 if total > 0 else 0, total_bg)

            # Graphique camembert
            chart = workbook.add_chart({'type': 'pie'})
            chart.add_series({
                'categories': [ws.name, start_row, 0, row - 1, 0],
                'values': [ws.name, start_row, 1, row - 1, 1],
                'data_labels': {'percentage': True}
            })
            chart_title = f"{owner} (Ch. visite)" if genre_filter else owner
            chart.set_title({'name': chart_title})
            chart.set_size({'width': 300, 'height': 200})
            ws.insert_chart(start_row - 2, chart_col, chart)
            
            row += 3

        ws.set_column(0, 0, 20)
        ws.set_column(1, 2, 12)

    def _write_chambers_simple_with_chart(self, ws, workbook, data, key_idx, title, header_fmt, int_fmt, 
                                           total_int_fmt, total_label_fmt, owner_filter, genre_filter=None, chart_type='column'):
        """Onglet simple avec graphique aligné."""
        row = 2
        ws.write(row, 0, title, header_fmt)
        ws.write(row, 1, "Nombre", header_fmt)
        ws.write(row, 2, "%", header_fmt)
        row += 1

        agg = aggregate_chambers(data, key_idx, owner_filter, genre_filter)
        total = sum(agg.values())
        start_row = row

        for key in sorted(agg.keys()):
            val = agg[key]
            pct = (val / total * 100) if total > 0 else 0
            ws.write(row, 0, str(key))
            ws.write(row, 1, val, int_fmt)
            ws.write(row, 2, round(pct, 1))
            row += 1

        ws.write(row, 0, "TOTAL", total_label_fmt)
        ws.write(row, 1, total, total_int_fmt)
        ws.write(row, 2, 100.0 if total > 0 else 0, total_label_fmt)

        # Graphique
        chart = workbook.add_chart({'type': chart_type})
        if chart_type == 'pie':
            chart.add_series({
                'categories': [ws.name, start_row, 0, row - 1, 0],
                'values': [ws.name, start_row, 1, row - 1, 1],
                'data_labels': {'percentage': True}
            })
        else:
            chart.add_series({
                'categories': [ws.name, start_row, 0, row - 1, 0],
                'values': [ws.name, start_row, 1, row - 1, 1],
                'fill': {'color': '#366092'}
            })
            chart.set_legend({'none': True})
        
        chart.set_title({'name': title})
        chart.set_size({'width': 400, 'height': 280})
        ws.insert_chart(2, 5, chart)

        ws.set_column(0, 0, 25)
        ws.set_column(1, 2, 12)

    def _write_chambers_cross(self, ws, workbook, data, header_fmt, int_fmt, total_int_fmt, total_label_fmt):
        """Onglet croisé Service × Accessibilité avec graphique (Chambres de visite uniquement)."""
        row = 2
        
        # Filtrer les données pour chambres de visite publiques
        filtered_data = [r for r in data if r[0] == CHAMBER_OWNER_PUBLIC and r[2] == CHAMBER_GENRE_VISITE]
        
        # Récupérer les valeurs uniques
        services = sorted(set(r[3] for r in filtered_data))
        accessibilities = sorted(set(r[4] for r in filtered_data))
        
        log_message(f"Services (Ch. Visite): {services}")
        log_message(f"Accessibilités (Ch. Visite): {accessibilities}")
        
        cross = aggregate_chambers_cross(data, CHAMBER_OWNER_PUBLIC, CHAMBER_GENRE_VISITE)
        grand_total = sum(cross.values())
        
        # En-têtes colonnes
        ws.write(row, 0, "", header_fmt)
        for col, acc in enumerate(accessibilities, 1):
            ws.write(row, col, acc, header_fmt)
        ws.write(row, len(accessibilities) + 1, "Total", header_fmt)
        ws.write(row, len(accessibilities) + 2, "%", header_fmt)
        row += 1
        
        # Données
        for service in services:
            ws.write(row, 0, service, header_fmt)
            row_total = 0
            for col, acc in enumerate(accessibilities, 1):
                val = cross.get((service, acc), 0)
                ws.write(row, col, val, int_fmt)
                row_total += val
            ws.write(row, len(accessibilities) + 1, row_total, int_fmt)
            row_pct = (row_total / grand_total * 100) if grand_total > 0 else 0
            ws.write(row, len(accessibilities) + 2, round(row_pct, 1))
            row += 1
        
        # Totaux colonnes
        ws.write(row, 0, "Total", total_label_fmt)
        for col, acc in enumerate(accessibilities, 1):
            col_total = sum(cross.get((s, acc), 0) for s in services)
            ws.write(row, col, col_total, total_int_fmt)
        ws.write(row, len(accessibilities) + 1, grand_total, total_int_fmt)
        ws.write(row, len(accessibilities) + 2, 100.0 if grand_total > 0 else 0, total_label_fmt)
        
        # Graphique en barres groupées
        chart = workbook.add_chart({'type': 'column'})
        for i, service in enumerate(services):
            chart.add_series({
                'name': service,
                'categories': [ws.name, 2, 1, 2, len(accessibilities)],
                'values': [ws.name, 3 + i, 1, 3 + i, len(accessibilities)],
            })
        chart.set_title({'name': 'Service × Accessibilité (Ch. de visite)'})
        chart.set_y_axis({'title': 'Nombre'})
        chart.set_size({'width': 400, 'height': 280})
        ws.insert_chart(2, len(accessibilities) + 4, chart)
        
        ws.set_column(0, len(accessibilities) + 2, 15)

    # =======================================================================
    # PDF avec graphiques
    # =======================================================================

    def write_pdf(self, filename, collectors_data, chambers_data):
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.graphics.shapes import Drawing, String
        from reportlab.graphics.charts.barcharts import VerticalBarChart
        from reportlab.graphics.charts.piecharts import Pie

        logo_path = os.path.join(self.plugin_dir, LOGO_FILENAME)
        pdf_basename = os.path.basename(filename)

        class PDFWithHeaderFooter(SimpleDocTemplate):
            def __init__(self, *args, **kwargs):
                self.logo_path = kwargs.pop('logo_path', None)
                self.pdf_filename = kwargs.pop('pdf_filename', '')
                SimpleDocTemplate.__init__(self, *args, **kwargs)

            def afterPage(self):
                # Ne pas afficher l'en-tête et le pied de page sur la première page (page titre)
                page_num = self.canv.getPageNumber()
                if page_num == 1:
                    return
                
                self.canv.saveState()
                page_width = A4[0]
                
                if self.logo_path and os.path.exists(self.logo_path):
                    try:
                        self.canv.drawImage(self.logo_path, 1.5*cm, A4[1] - 2*cm, width=1.5*cm, height=1.5*cm, preserveAspectRatio=True)
                    except:
                        pass
                
                self.canv.setFont('Helvetica-Bold', 12)
                self.canv.setFillColor(colors.HexColor('#333333'))
                self.canv.drawString(3.5*cm, A4[1] - 1.3*cm, "Commune de Bussigny")
                
                self.canv.setStrokeColor(colors.HexColor('#366092'))
                self.canv.setLineWidth(1)
                self.canv.line(1.5*cm, A4[1] - 2.2*cm, page_width - 1.5*cm, A4[1] - 2.2*cm)
                
                self.canv.setFont('Helvetica', 8)
                self.canv.setFillColor(colors.HexColor('#666666'))
                self.canv.drawString(1.5*cm, 1*cm, f"/ {self.pdf_filename}")
                self.canv.drawRightString(page_width - 1.5*cm, 1*cm, f"{page_num}")
                
                self.canv.restoreState()

        doc = PDFWithHeaderFooter(filename, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm,
                                   topMargin=2.8*cm, bottomMargin=1.8*cm, logo_path=logo_path, pdf_filename=pdf_basename)

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=14, spaceAfter=8, textColor=colors.HexColor('#366092'))
        subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=9, spaceAfter=4, textColor=colors.HexColor('#666666'))

        elements = []

        # ===== PAGE TITRE =====
        elements.extend(self._pdf_title_page(logo_path, title_style))

        # ===== COLLECTEURS =====
        elements.extend(self._pdf_collectors(collectors_data, title_style, subtitle_style))

        # ===== CHAMBRES =====
        elements.extend(self._pdf_chambers(chambers_data, title_style, subtitle_style))

        doc.build(elements)

    def _pdf_title_page(self, logo_path, title_style):
        """Génère la page de titre du rapport."""
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.platypus import Spacer, Image, Paragraph, PageBreak
        from reportlab.lib.styles import ParagraphStyle
        
        elements = []
        
        # Espace pour centrer verticalement
        elements.append(Spacer(1, 6*cm))
        
        # Logo centré avec proportions conservées
        if logo_path and os.path.exists(logo_path):
            try:
                # Utiliser PIL pour obtenir les dimensions originales
                from PIL import Image as PILImage
                pil_img = PILImage.open(logo_path)
                orig_width, orig_height = pil_img.size
                
                # Calculer les dimensions en conservant les proportions
                max_size = 6*cm
                ratio = min(max_size / orig_width, max_size / orig_height)
                new_width = orig_width * ratio
                new_height = orig_height * ratio
                
                img = Image(logo_path, width=new_width, height=new_height)
                img.hAlign = 'CENTER'
                elements.append(img)
            except:
                # Fallback si PIL n'est pas disponible
                img = Image(logo_path, width=6*cm, height=6*cm, kind='proportional')
                img.hAlign = 'CENTER'
                elements.append(img)
        
        elements.append(Spacer(1, 2*cm))
        
        # Titre principal
        title_page_style = ParagraphStyle('TitlePage', fontSize=24, alignment=1, textColor=colors.HexColor('#366092'), fontName='Helvetica-Bold', spaceAfter=20)
        elements.append(Paragraph("Bussigny", title_page_style))
        
        subtitle_page_style = ParagraphStyle('SubtitlePage', fontSize=18, alignment=1, textColor=colors.HexColor('#666666'), fontName='Helvetica', spaceAfter=10)
        elements.append(Paragraph("Assainissement en chiffres", subtitle_page_style))
        
        elements.append(Spacer(1, 2*cm))
        
        # Date
        from datetime import date
        date_style = ParagraphStyle('DateStyle', fontSize=12, alignment=1, textColor=colors.HexColor('#999999'), fontName='Helvetica')
        elements.append(Paragraph(f"Rapport du {date.today().strftime('%d/%m/%Y')}", date_style))
        
        from reportlab.platypus import PageBreak
        elements.append(PageBreak())
        
        return elements

    def _create_pie_chart(self, data_dict, title, width=200, height=150):
        """Crée un graphique camembert pour PDF."""
        from reportlab.graphics.shapes import Drawing, String
        from reportlab.graphics.charts.piecharts import Pie
        from reportlab.graphics.charts.legends import Legend
        from reportlab.lib import colors
        
        drawing = Drawing(width, height)
        pie = Pie()
        pie.x = 30
        pie.y = 25
        pie.width = 70
        pie.height = 70
        
        # Filtrer les valeurs nulles
        filtered = [(k, v) for k, v in data_dict.items() if v > 0]
        if not filtered:
            return drawing
            
        labels = [k for k, v in filtered]
        values = [v for k, v in filtered]
        
        pie.data = values
        pie.labels = None  # Pas de labels sur le camembert, on utilise une légende séparée
        
        # Couleurs
        color_map = {
            'Eaux claires': colors.HexColor('#2E75B6'),
            'Eaux usées': colors.HexColor('#C65911'),
            'Eaux mixtes': colors.HexColor('#538135'),
            'Eaux industrielles': colors.HexColor('#7030A0'),
            'Simple': colors.HexColor('#366092'),
            'Double': colors.HexColor('#C65911'),
        }
        default_colors = [colors.HexColor('#366092'), colors.HexColor('#C65911'), 
                         colors.HexColor('#538135'), colors.HexColor('#7030A0'),
                         colors.HexColor('#2E75B6'), colors.HexColor('#FFC000')]
        
        slice_colors = []
        for i, label in enumerate(labels):
            col = color_map.get(label, default_colors[i % len(default_colors)])
            pie.slices[i].fillColor = col
            pie.slices[i].strokeWidth = 0.5
            slice_colors.append(col)
        
        pie.slices.strokeColor = colors.white
        
        drawing.add(pie)
        
        # Légende séparée à droite du camembert
        legend = Legend()
        legend.x = 110
        legend.y = height - 40
        legend.dx = 8
        legend.dy = 8
        legend.fontName = 'Helvetica'
        legend.fontSize = 6
        legend.boxAnchor = 'nw'
        legend.columnMaximum = 10
        legend.strokeWidth = 0.5
        legend.strokeColor = colors.black
        legend.deltax = 5
        legend.deltay = 0
        legend.autoXPadding = 3
        legend.yGap = 0
        legend.dxTextSpace = 3
        legend.alignment = 'right'
        legend.dividerLines = 0
        legend.subCols.rpad = 10
        
        # Créer les entrées de légende avec pourcentages
        total = sum(values)
        legend_items = []
        for i, (label, val) in enumerate(zip(labels, values)):
            pct = (val / total * 100) if total > 0 else 0
            legend_items.append((slice_colors[i], f"{label[:12]} ({pct:.0f}%)"))
        legend.colorNamePairs = legend_items
        
        drawing.add(legend)
        
        # Titre
        drawing.add(String(width/2, height - 10, title, textAnchor='middle', fontSize=9, fontName='Helvetica-Bold'))
        
        return drawing

    def _create_bar_chart(self, data_dict, title, color='#366092', width=280, height=150, x_label=None, y_label=None, keep_zeros=False):
        """Crée un graphique en barres pour PDF."""
        from reportlab.graphics.shapes import Drawing, String, Group
        from reportlab.graphics.charts.barcharts import VerticalBarChart
        from reportlab.lib import colors
        
        drawing = Drawing(width, height)
        
        # Filtrer les valeurs nulles sauf si keep_zeros=True
        if keep_zeros:
            filtered = list(data_dict.items())
        else:
            filtered = [(k, v) for k, v in data_dict.items() if v > 0]
        if not filtered:
            return drawing
            
        labels = [str(k)[:12] for k, v in filtered]  # Tronquer les labels longs
        values = [v for k, v in filtered]
        
        chart = VerticalBarChart()
        chart.x = 45
        # Remonter le graphique si x_label est présent pour laisser de la place
        chart.y = 35 if x_label else 25
        chart.width = width - 55
        chart.height = height - 55 if x_label else height - 45
        
        chart.data = [values]
        chart.categoryAxis.categoryNames = labels
        chart.categoryAxis.labels.angle = 45
        chart.categoryAxis.labels.boxAnchor = 'ne'
        chart.categoryAxis.labels.fontSize = 6
        chart.categoryAxis.labels.dy = -2
        
        chart.valueAxis.valueMin = 0
        chart.valueAxis.labels.fontSize = 7
        
        chart.bars[0].fillColor = colors.HexColor(color)
        chart.bars[0].strokeWidth = 0
        
        drawing.add(chart)
        
        # Titre
        drawing.add(String(width/2, height - 6, title, textAnchor='middle', fontSize=8, fontName='Helvetica-Bold'))
        
        # Légende axe Y (texte vertical) - utiliser un Group avec rotation
        if y_label:
            # Créer le texte et le faire pivoter
            g = Group(String(0, 0, y_label, fontSize=7, fontName='Helvetica', textAnchor='middle'))
            g.transform = (0, 1, -1, 0, 8, height/2)  # Rotation 90° et positionnement
            drawing.add(g)
        
        # Légende axe X (texte horizontal en bas)
        if x_label:
            drawing.add(String(width/2, 3, x_label, textAnchor='middle', fontSize=7, fontName='Helvetica'))
        
        return drawing

    def _create_stacked_bar_chart(self, cross_data, services, accessibilities, title, width=300, height=180, y_label=None, x_label=None):
        """Crée un graphique en barres groupées pour PDF."""
        from reportlab.graphics.shapes import Drawing, String, Rect, Group
        from reportlab.graphics.charts.barcharts import VerticalBarChart
        from reportlab.lib import colors
        
        drawing = Drawing(width, height)
        
        chart = VerticalBarChart()
        chart.x = 50
        chart.y = 45
        chart.width = width - 70
        chart.height = height - 75
        
        # Préparer les données
        data = []
        for service in services:
            row = [cross_data.get((service, acc), 0) for acc in accessibilities]
            data.append(row)
        
        chart.data = data
        chart.categoryAxis.categoryNames = [a[:12] for a in accessibilities]
        chart.categoryAxis.labels.angle = 30
        chart.categoryAxis.labels.boxAnchor = 'ne'
        chart.categoryAxis.labels.fontSize = 7
        chart.categoryAxis.labels.dy = -2
        
        chart.valueAxis.valueMin = 0
        chart.valueAxis.labels.fontSize = 7
        
        bar_colors = [colors.HexColor('#366092'), colors.HexColor('#C65911'), colors.HexColor('#538135')]
        for i, service in enumerate(services):
            if i < len(chart.bars):
                chart.bars[i].fillColor = bar_colors[i % len(bar_colors)]
        
        drawing.add(chart)
        
        # Titre
        drawing.add(String(width/2, height - 6, title, textAnchor='middle', fontSize=8, fontName='Helvetica-Bold'))
        
        # Légende axe Y (texte vertical) - utiliser un Group avec rotation
        if y_label:
            g = Group(String(0, 0, y_label, fontSize=7, fontName='Helvetica', textAnchor='middle'))
            g.transform = (0, 1, -1, 0, 10, height/2)  # Rotation 90° et positionnement
            drawing.add(g)
        
        # Légende en bas, bien espacée
        legend_y = 8
        legend_x = 50
        spacing = (width - 100) / max(len(services), 1)
        for i, service in enumerate(services):
            drawing.add(Rect(legend_x, legend_y, 8, 6, fillColor=bar_colors[i % len(bar_colors)], strokeWidth=0))
            drawing.add(String(legend_x + 11, legend_y + 1, service[:15], fontSize=6))
            legend_x += spacing
        
        return drawing

    def _pdf_collectors(self, data, title_style, subtitle_style):
        """Génère les pages PDF pour les collecteurs avec graphiques."""
        from reportlab.lib import colors
        from reportlab.platypus import Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.units import cm

        elements = []
        hierarchy_colors = {"Public - Principal": ('#366092', '#D9E1F2'), "Public - Secondaire": ('#7030A0', '#E4DFEC'), "Privé - Tertiaire": ('#C65911', '#FCE4D6')}
        water_colors = {"Eaux claires": ('#2E75B6', '#DEEBF7'), "Eaux usées": ('#C65911', '#FCE4D6'), "Eaux mixtes": ('#538135', '#E2EFDA')}

        # Page 1: Type d'eau
        elements.append(Paragraph("COLLECTEURS - Récapitulatif par type d'eau", title_style))
        elements.append(Paragraph(f"Rapport du {date.today().strftime('%d/%m/%Y')}", subtitle_style))
        elements.append(Spacer(1, 6))

        for hierarchy in HIERARCHY_TYPES:
            hdr_color, bg_color = hierarchy_colors[hierarchy]
            section_style = ParagraphStyle('Section', fontSize=10, spaceBefore=6, spaceAfter=3, textColor=colors.HexColor(hdr_color), fontName='Helvetica-Bold')
            elements.append(Paragraph(hierarchy.upper(), section_style))

            agg = aggregate_collectors(data, 1, hierarchy, None)
            total = sum(agg.values())

            table_data = [["Type d'eau", "Longueur (m)", "%"]]
            for wt in WATER_TYPES:
                val = agg.get(wt, 0)
                pct = (val / total * 100) if total > 0 else 0
                table_data.append([wt, f"{val:,.0f}", f"{pct:.1f}%"])
            table_data.append(["TOTAL", f"{total:,.0f}", "100%"])

            tbl = Table(table_data, colWidths=[4*cm, 2.5*cm, 1.5*cm])
            tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(hdr_color)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor(bg_color)),
                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            
            # Tableau + graphique côte à côte
            pie_data = {wt: agg.get(wt, 0) for wt in WATER_TYPES}
            pie_chart = self._create_pie_chart(pie_data, hierarchy, width=180, height=120)
            
            combined = Table([[tbl, pie_chart]], colWidths=[8.5*cm, 7*cm])
            combined.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
            elements.append(combined)
            elements.append(Spacer(1, 4))

        # Pages suivantes: Matériau, Diamètre, État
        from reportlab.platypus import CondPageBreak
        for key_idx, key_title in [(2, "Matériau"), (3, "Diamètre"), (4, "État")]:
            # Forcer une nouvelle page (hauteur très grande = toujours nouvelle page)
            # mais CondPageBreak ne créera pas de page vide si on est déjà en haut
            elements.append(CondPageBreak(600))
            elements.append(Paragraph(f"COLLECTEURS - Récapitulatif par {key_title.lower()}", title_style))
            elements.append(Paragraph("Public - Principal uniquement", subtitle_style))
            elements.append(Spacer(1, 4))

            for wt in WATER_TYPES:
                hdr_color, bg_color = water_colors[wt]
                wt_style = ParagraphStyle('WT', fontSize=9, spaceBefore=6, spaceAfter=3, textColor=colors.HexColor(hdr_color), fontName='Helvetica-Bold')
                elements.append(Paragraph(f"► {wt}", wt_style))

                agg = aggregate_collectors(data, key_idx, "Public - Principal", wt)
                total = sum(agg.values())
                
                if key_idx == 3:  # Diamètre - Top 9 + Autres
                    top9 = sorted(agg.items(), key=lambda x: x[1], reverse=True)[:9]
                    items = sorted(top9, key=lambda x: sort_diameter_key(x[0]))
                    top9_total = sum(v for k, v in items)
                    autres = total - top9_total
                elif key_idx == 4:  # État - toutes les classes
                    items = [(k, agg.get(k, 0)) for k in STATE_ORDER]
                else:
                    items = sorted(agg.items())

                # En-tête du tableau avec unité pour diamètre
                table_header = "Diamètre (mm)" if key_idx == 3 else key_title
                table_data = [[table_header, "Longueur (m)", "%"]]
                chart_data = {}
                
                for key, val in items:
                    pct = (val / total * 100) if total > 0 else 0
                    table_data.append([str(key), f"{val:,.0f}", f"{pct:.1f}%"])
                    chart_data[key] = val
                
                # Ajouter "Autres" pour diamètre si nécessaire
                if key_idx == 3 and len(agg) > 9 and autres > 0:
                    pct_autres = (autres / total * 100) if total > 0 else 0
                    table_data.append(["Autres", f"{autres:,.0f}", f"{pct_autres:.1f}%"])
                
                table_data.append(["TOTAL", f"{total:,.0f}", "100%"])

                tbl = Table(table_data, colWidths=[4.5*cm, 2*cm, 1.2*cm])
                tbl.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(hdr_color)),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 7),
                    ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                    ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor(bg_color)),
                    ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                    ('GRID', (0, 0), (-1, -1), 0.4, colors.grey),
                ]))
                
                # Graphique barres avec légendes d'axes
                if key_idx == 3:  # Diamètre - avec légende axe X
                    bar_chart = self._create_bar_chart(chart_data, f"{key_title} - {wt}", color=hdr_color, 
                                                       width=250, height=130, x_label="Diamètre (mm)", y_label="Longueur (m)")
                elif key_idx == 4:  # État - garder toutes les classes même à 0
                    bar_chart = self._create_bar_chart(chart_data, f"{key_title} - {wt}", color=hdr_color, 
                                                       width=250, height=130, y_label="Longueur (m)", keep_zeros=True)
                else:  # Matériau
                    bar_chart = self._create_bar_chart(chart_data, f"{key_title} - {wt}", color=hdr_color, 
                                                       width=250, height=130, y_label="Longueur (m)")
                
                combined = Table([[tbl, bar_chart]], colWidths=[8*cm, 9*cm])
                combined.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
                elements.append(combined)
                elements.append(Spacer(1, 2))

        return elements

    def _pdf_chambers(self, data, title_style, subtitle_style):
        """Génère les pages PDF pour les chambres avec graphiques."""
        from reportlab.lib import colors
        from reportlab.platypus import Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.units import cm

        elements = []

        # Récupérer les valeurs uniques
        owners = [o for o in get_unique_values(data, 0) if o != "Non renseigné"]
        water_types = get_unique_values(data, 1)

        owner_colors = {
            'Bussigny - Publique': ('#366092', '#D9E1F2'),
            'Privée': ('#C65911', '#FCE4D6'),
        }

        from reportlab.platypus import CondPageBreak

        # Page: Genre (AVANT Propriétaire) - CondPageBreak pour séparer des collecteurs
        elements.append(CondPageBreak(600))
        elements.append(Paragraph("CHAMBRES - Répartition par genre", title_style))
        elements.append(Paragraph("Bussigny - Publique uniquement", subtitle_style))
        elements.append(Spacer(1, 6))

        agg = aggregate_chambers(data, 2, CHAMBER_OWNER_PUBLIC)
        total = sum(agg.values())
        table_data = [["Genre de chambre", "Nombre", "%"]]
        for key in sorted(agg.keys()):
            val = agg[key]
            pct = (val / total * 100) if total > 0 else 0
            table_data.append([str(key), f"{val:,}", f"{pct:.1f}%"])
        table_data.append(["TOTAL", f"{total:,}", "100%"])

        tbl = Table(table_data, colWidths=[5*cm, 2*cm, 1.5*cm])
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#D9E1F2')),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        
        bar_chart = self._create_bar_chart(agg, "Genre de chambre", width=250, height=150, y_label="Nombre")
        combined = Table([[tbl, bar_chart]], colWidths=[9*cm, 8*cm])
        combined.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
        elements.append(combined)

        # Page: Par propriétaire
        elements.append(CondPageBreak(600))
        elements.append(Paragraph("CHAMBRES - Répartition par propriétaire", title_style))
        elements.append(Spacer(1, 6))

        for owner in owners:
            hdr_color, bg_color = owner_colors.get(owner, ('#808080', '#E0E0E0'))
            section_style = ParagraphStyle('Section', fontSize=10, spaceBefore=6, spaceAfter=3, textColor=colors.HexColor(hdr_color), fontName='Helvetica-Bold')
            elements.append(Paragraph(owner.upper(), section_style))

            agg = aggregate_chambers(data, 1, owner)
            total = sum(agg.values())

            table_data = [["Type d'eau", "Nombre", "%"]]
            for wt in water_types:
                val = agg.get(wt, 0)
                pct = (val / total * 100) if total > 0 else 0
                table_data.append([wt, f"{val:,}", f"{pct:.1f}%"])
            table_data.append(["TOTAL", f"{total:,}", "100%"])

            tbl = Table(table_data, colWidths=[4*cm, 2*cm, 1.5*cm])
            tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(hdr_color)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor(bg_color)),
                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            
            # Graphique camembert
            pie_data = {wt: agg.get(wt, 0) for wt in water_types}
            pie_chart = self._create_pie_chart(pie_data, owner, width=180, height=120)
            
            combined = Table([[tbl, pie_chart]], colWidths=[8*cm, 7*cm])
            combined.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
            elements.append(combined)
            elements.append(Spacer(1, 4))

        # Page: Chambres de visite - Par propriétaire
        elements.append(CondPageBreak(600))
        elements.append(Paragraph("CHAMBRES DE VISITE - Répartition par propriétaire", title_style))
        elements.append(Spacer(1, 6))

        for owner in owners:
            if owner == "Non renseigné":
                continue
                
            hdr_color, bg_color = owner_colors.get(owner, ('#808080', '#E0E0E0'))
            section_style = ParagraphStyle('Section', fontSize=10, spaceBefore=6, spaceAfter=3, textColor=colors.HexColor(hdr_color), fontName='Helvetica-Bold')
            elements.append(Paragraph(owner.upper(), section_style))

            # Agrégation filtrée par Chambre de visite
            agg = aggregate_chambers(data, 1, owner, CHAMBER_GENRE_VISITE)
            total = sum(agg.values())

            table_data = [["Type d'eau", "Nombre", "%"]]
            for wt in water_types:
                val = agg.get(wt, 0)
                pct = (val / total * 100) if total > 0 else 0
                table_data.append([wt, f"{val:,}", f"{pct:.1f}%"])
            table_data.append(["TOTAL", f"{total:,}", "100%"])

            tbl = Table(table_data, colWidths=[4*cm, 2*cm, 1.5*cm])
            tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(hdr_color)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor(bg_color)),
                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            
            # Graphique camembert
            pie_data = {wt: agg.get(wt, 0) for wt in water_types}
            pie_chart = self._create_pie_chart(pie_data, f"{owner} (Ch. visite)", width=180, height=120)
            
            combined = Table([[tbl, pie_chart]], colWidths=[8*cm, 7*cm])
            combined.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
            elements.append(combined)
            elements.append(Spacer(1, 4))

        # Page: Service × Accessibilité (Chambres de visite uniquement)
        elements.append(CondPageBreak(600))
        elements.append(Paragraph("CHAMBRES DE VISITE - Service × Accessibilité", title_style))
        elements.append(Paragraph("Bussigny - Publique, Chambres de visite uniquement", subtitle_style))
        elements.append(Spacer(1, 6))

        cross = aggregate_chambers_cross(data, CHAMBER_OWNER_PUBLIC, CHAMBER_GENRE_VISITE)
        # Filtrer les données pour chambres de visite publiques
        filtered_data = [r for r in data if r[0] == CHAMBER_OWNER_PUBLIC and r[2] == CHAMBER_GENRE_VISITE]
        services = sorted(set(r[3] for r in filtered_data))
        accessibilities = sorted(set(r[4] for r in filtered_data))

        # Calculer le grand total pour les pourcentages
        grand_total = sum(cross.values())
        
        table_data = [[""] + accessibilities + ["Total", "%"]]
        for service in services:
            row = [service]
            row_total = 0
            for acc in accessibilities:
                val = cross.get((service, acc), 0)
                row.append(f"{val:,}")
                row_total += val
            row_pct = (row_total / grand_total * 100) if grand_total > 0 else 0
            row.append(f"{row_total:,}")
            row.append(f"{row_pct:.1f}%")
            table_data.append(row)
        
        total_row = ["Total"]
        for acc in accessibilities:
            col_total = sum(cross.get((s, acc), 0) for s in services)
            total_row.append(f"{col_total:,}")
        total_row.append(f"{grand_total:,}")
        total_row.append("100%")
        table_data.append(total_row)
        
        # Ligne de pourcentages par colonne
        pct_row = ["%"]
        for acc in accessibilities:
            col_total = sum(cross.get((s, acc), 0) for s in services)
            col_pct = (col_total / grand_total * 100) if grand_total > 0 else 0
            pct_row.append(f"{col_pct:.1f}%")
        pct_row.append("100%")
        pct_row.append("")
        table_data.append(pct_row)

        col_width = 2*cm
        tbl = Table(table_data, colWidths=[2.5*cm] + [col_width] * len(accessibilities) + [1.5*cm, 1.2*cm])
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('BACKGROUND', (0, 0), (0, -2), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('TEXTCOLOR', (0, 0), (0, -2), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (0, -2), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('BACKGROUND', (0, -2), (-1, -1), colors.HexColor('#D9E1F2')),
            ('BACKGROUND', (-1, 0), (-1, -1), colors.HexColor('#D9E1F2')),
            ('BACKGROUND', (-2, 0), (-2, -1), colors.HexColor('#D9E1F2')),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(tbl)
        elements.append(Spacer(1, 10))
        
        # Graphique barres groupées avec légendes d'axes
        stacked_chart = self._create_stacked_bar_chart(cross, services, accessibilities, "Service × Accessibilité", width=400, height=200, y_label="Nombre")
        elements.append(stacked_chart)

        # Page: Simple/Double (Chambres de visite uniquement)
        elements.append(CondPageBreak(600))
        elements.append(Paragraph("CHAMBRES DE VISITE - Simple / Double", title_style))
        elements.append(Paragraph("Bussigny - Publique, Chambres de visite uniquement", subtitle_style))
        elements.append(Spacer(1, 6))

        agg = aggregate_chambers(data, 5, CHAMBER_OWNER_PUBLIC, CHAMBER_GENRE_VISITE)
        total = sum(agg.values())
        table_data = [["Type", "Nombre", "%"]]
        for key in ["Simple", "Double"]:
            val = agg.get(key, 0)
            pct = (val / total * 100) if total > 0 else 0
            table_data.append([key, f"{val:,}", f"{pct:.1f}%"])
        table_data.append(["TOTAL", f"{total:,}", "100%"])

        tbl = Table(table_data, colWidths=[4*cm, 2*cm, 1.5*cm])
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#D9E1F2')),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        
        pie_chart = self._create_pie_chart(agg, "Simple / Double", width=180, height=120)
        combined = Table([[tbl, pie_chart]], colWidths=[8*cm, 7*cm])
        combined.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
        elements.append(combined)

        # Page: Matériau (Chambres de visite uniquement)
        elements.append(CondPageBreak(600))
        elements.append(Paragraph("CHAMBRES DE VISITE - Répartition par matériau", title_style))
        elements.append(Paragraph("Bussigny - Publique, Chambres de visite uniquement", subtitle_style))
        elements.append(Spacer(1, 6))

        agg = aggregate_chambers(data, 6, CHAMBER_OWNER_PUBLIC, CHAMBER_GENRE_VISITE)
        total = sum(agg.values())
        table_data = [["Matériau", "Nombre", "%"]]
        for key in sorted(agg.keys()):
            val = agg[key]
            pct = (val / total * 100) if total > 0 else 0
            table_data.append([str(key), f"{val:,}", f"{pct:.1f}%"])
        table_data.append(["TOTAL", f"{total:,}", "100%"])

        tbl = Table(table_data, colWidths=[5*cm, 2*cm, 1.5*cm])
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#D9E1F2')),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        
        bar_chart = self._create_bar_chart(agg, "Matériau", width=250, height=150, y_label="Nombre")
        combined = Table([[tbl, bar_chart]], colWidths=[9*cm, 8*cm])
        combined.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
        elements.append(combined)

        # Page: Forme (Chambres de visite uniquement)
        elements.append(CondPageBreak(600))
        elements.append(Paragraph("CHAMBRES DE VISITE - Répartition par forme", title_style))
        elements.append(Paragraph("Bussigny - Publique, Chambres de visite uniquement", subtitle_style))
        elements.append(Spacer(1, 6))

        agg = aggregate_chambers(data, 7, CHAMBER_OWNER_PUBLIC, CHAMBER_GENRE_VISITE)
        total = sum(agg.values())
        table_data = [["Forme", "Nombre", "%"]]
        for key in sorted(agg.keys()):
            val = agg[key]
            pct = (val / total * 100) if total > 0 else 0
            table_data.append([str(key), f"{val:,}", f"{pct:.1f}%"])
        table_data.append(["TOTAL", f"{total:,}", "100%"])

        tbl = Table(table_data, colWidths=[5*cm, 2*cm, 1.5*cm])
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#D9E1F2')),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        
        bar_chart = self._create_bar_chart(agg, "Forme", width=250, height=150, y_label="Nombre")
        combined = Table([[tbl, bar_chart]], colWidths=[9*cm, 8*cm])
        combined.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
        elements.append(combined)

        return elements