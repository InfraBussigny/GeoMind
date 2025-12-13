# -*- coding: utf-8 -*-
"""
BDCO Sketcher - Plugin QGIS
Charge et stylise les couches BDCO depuis PostgreSQL
Cree des couches de servitudes pretes a l'emploi

Auteur: Marc Zermatten / GeoBrain
Version: 1.0.0
"""

from qgis.PyQt.QtCore import Qt, QSettings
from qgis.PyQt.QtWidgets import (
    QAction, QDialog, QVBoxLayout, QHBoxLayout, QGroupBox,
    QComboBox, QLabel, QPushButton, QMessageBox,
    QProgressBar, QListWidget, QListWidgetItem, QAbstractItemView
)
from qgis.PyQt.QtGui import QIcon, QColor

# Import conditionnel du module de georeferencement
try:
    from .georef_dialog import GeorefDialog
    GEOREF_AVAILABLE = True
except ImportError:
    GEOREF_AVAILABLE = False
from qgis.core import (
    QgsProject, QgsVectorLayer, QgsDataSourceUri,
    QgsFillSymbol, QgsLineSymbol, QgsMarkerSymbol,
    QgsSingleSymbolRenderer, QgsSimpleFillSymbolLayer,
    QgsSimpleLineSymbolLayer, QgsSimpleMarkerSymbolLayer,
    QgsPalLayerSettings, QgsVectorLayerSimpleLabeling,
    QgsTextFormat, QgsTextBufferSettings,
    QgsUnitTypes, QgsWkbTypes, Qgis
)
import os


# =============================================================================
# CONFIGURATION DES STYLES BDCO
# =============================================================================

BDCO_LAYERS_CONFIG = {
    'parcelles': {
        'table_names': ['bdco_parcelle', 'parcelle', 'bien_fonds'],
        'fill_color': '#F5F5F5',
        'stroke_color': '#000000',
        'stroke_width': 0.15,
        'label_field': 'numero',
        'label_size': 7
    },
    'batiments': {
        'table_names': ['bdco_batiment', 'batiment', 'batiments'],
        'fill_color': '#C8C8C8',
        'stroke_color': '#000000',
        'stroke_width': 0.2,
        'label_field': 'numero',
        'label_size': 6
    },
    'surfaces': {
        'table_names': ['bdco_cs_dur', 'cs_dur', 'surfaces_dures'],
        'fill_color': '#FFFFFF',
        'stroke_color': '#808080',
        'stroke_width': 0.1
    },
    'points_limites': {
        'table_names': ['bdco_point_limite', 'point_limite', 'points_limites'],
        'stroke_color': '#000000',
        'stroke_width': 0.3,
        'marker_size': 0.8
    },
    'noms_locaux': {
        'table_names': ['bdco_adresse_rue_lin', 'adresse_rue_lin', 'noms_rues'],
        'stroke_color': '#000000',
        'stroke_width': 0.15,
        'label_field': 'texte',
        'label_size': 8,
        'italic': True,
        'along_line': True
    },
    'limites_plans': {
        'table_names': ['bdco_objet_divers_lin', 'objet_divers_lin', 'limites_plans'],
        'stroke_color': '#000000',
        'stroke_width': 0.25,
        'dash_pattern': [3, 2]
    }
}

# Configuration des types de servitudes
SERVITUDES_CONFIG = {
    'EU': {
        'nom': 'Eaux usees (refoulement)',
        'couleur': '#E52421',
        'epaisseur': 1.5,
        'description': 'Conduite de refoulement eaux usees'
    },
    'EC': {
        'nom': 'Eaux claires',
        'couleur': '#4A90D9',
        'epaisseur': 1.5,
        'description': 'Collecteur eaux claires / pluviales'
    },
    'ESP': {
        'nom': 'Eaux sous pression',
        'couleur': '#22B14C',
        'epaisseur': 1.5,
        'description': 'Conduite eau potable / sous pression'
    },
    'SEIC': {
        'nom': 'Electricite (SEIC)',
        'couleur': '#AEA1D1',
        'epaisseur': 1.5,
        'description': 'Canalisations electriques'
    },
    'GAZ': {
        'nom': 'Gaz',
        'couleur': '#FFD700',
        'epaisseur': 1.5,
        'description': 'Conduite de gaz'
    },
    'TELECOM': {
        'nom': 'Telecommunications',
        'couleur': '#FF8C00',
        'epaisseur': 1.5,
        'description': 'Fibre optique, telephone'
    },
    'AUTRE': {
        'nom': 'Autre servitude',
        'couleur': '#808080',
        'epaisseur': 1.5,
        'description': 'Servitude non classifiee'
    }
}

# Configuration des servitudes surfaciques (polygones)
SERVITUDES_SURFACES_CONFIG = {
    'EMPRISE_EU': {
        'nom': 'Emprise eaux usees',
        'couleur_fond': '#E5242133',
        'couleur_contour': '#E52421',
        'epaisseur_contour': 0.5,
        'description': 'Zone d\'emprise servitude EU'
    },
    'EMPRISE_EC': {
        'nom': 'Emprise eaux claires',
        'couleur_fond': '#4A90D933',
        'couleur_contour': '#4A90D9',
        'epaisseur_contour': 0.5,
        'description': 'Zone d\'emprise servitude EC'
    },
    'EMPRISE_ESP': {
        'nom': 'Emprise eaux sous pression',
        'couleur_fond': '#22B14C33',
        'couleur_contour': '#22B14C',
        'epaisseur_contour': 0.5,
        'description': 'Zone d\'emprise servitude ESP'
    },
    'EMPRISE_SEIC': {
        'nom': 'Emprise electricite',
        'couleur_fond': '#AEA1D133',
        'couleur_contour': '#AEA1D1',
        'epaisseur_contour': 0.5,
        'description': 'Zone d\'emprise servitude SEIC'
    },
    'EMPRISE_GAZ': {
        'nom': 'Emprise gaz',
        'couleur_fond': '#FFD70033',
        'couleur_contour': '#FFD700',
        'epaisseur_contour': 0.5,
        'description': 'Zone d\'emprise servitude gaz'
    },
    'PASSAGE': {
        'nom': 'Servitude de passage',
        'couleur_fond': '#8B451333',
        'couleur_contour': '#8B4513',
        'epaisseur_contour': 0.5,
        'description': 'Droit de passage'
    },
    'NON_BATIR': {
        'nom': 'Zone non aedificandi',
        'couleur_fond': '#FF000022',
        'couleur_contour': '#FF0000',
        'epaisseur_contour': 0.3,
        'style_contour': 'dash',
        'description': 'Zone de non-batir'
    },
    'AUTRE_SURF': {
        'nom': 'Autre servitude surfacique',
        'couleur_fond': '#80808033',
        'couleur_contour': '#808080',
        'epaisseur_contour': 0.5,
        'description': 'Servitude surfacique non classifiee'
    }
}


class BDCOSketcher:
    """Plugin principal BDCO Sketcher"""

    def __init__(self, iface):
        self.iface = iface
        self.plugin_dir = os.path.dirname(__file__)
        self.actions = []
        self.menu = '&BDCO Sketcher'
        self.toolbar = self.iface.addToolBar('BDCO Sketcher')
        self.toolbar.setObjectName('BDCOSketcherToolbar')

    def initGui(self):
        """Initialise l'interface du plugin"""
        icon_path = os.path.join(self.plugin_dir, 'icon.svg')
        icon = QIcon(icon_path) if os.path.exists(icon_path) else QIcon()

        self.action_sketcher = QAction(icon, 'Sketcher plan de situation', self.iface.mainWindow())
        self.action_sketcher.triggered.connect(self.open_sketcher)
        self.toolbar.addAction(self.action_sketcher)
        self.iface.addPluginToMenu(self.menu, self.action_sketcher)
        self.actions.append(self.action_sketcher)

        self.action_servitudes = QAction(icon, 'Creer couches servitudes', self.iface.mainWindow())
        self.action_servitudes.triggered.connect(self.create_servitudes_quick)
        self.toolbar.addAction(self.action_servitudes)
        self.iface.addPluginToMenu(self.menu, self.action_servitudes)
        self.actions.append(self.action_servitudes)

        # Action georeferencement (si module disponible)
        if GEOREF_AVAILABLE:
            self.action_georef = QAction(icon, 'Georeferencer un plan (Helmert)', self.iface.mainWindow())
            self.action_georef.triggered.connect(self.open_georef)
            self.toolbar.addAction(self.action_georef)
            self.iface.addPluginToMenu(self.menu, self.action_georef)
            self.actions.append(self.action_georef)

    def unload(self):
        """Decharge le plugin"""
        for action in self.actions:
            self.iface.removePluginMenu(self.menu, action)
            self.iface.removeToolBarIcon(action)
        del self.toolbar

    def open_sketcher(self):
        """Ouvre le sketcher principal"""
        sketcher = SketcherDialog(self.iface)
        sketcher.exec_()

    def create_servitudes_quick(self):
        """Cree rapidement les couches servitudes"""
        create_all_servitude_layers(self.iface)

    def open_georef(self):
        """Ouvre le dialog de georeferencement"""
        if GEOREF_AVAILABLE:
            dialog = GeorefDialog(self.iface)
            dialog.exec_()


class SketcherDialog(QDialog):
    """Dialog principal pour configurer et charger les couches"""

    def __init__(self, iface, parent=None):
        super().__init__(parent)
        self.iface = iface
        self.setup_ui()

    def setup_ui(self):
        """Configure l'interface utilisateur"""
        self.setWindowTitle('BDCO Sketcher - Plan de situation')
        self.setMinimumWidth(500)
        self.setMinimumHeight(450)

        layout = QVBoxLayout()

        # === Groupe Connexion PostgreSQL ===
        group_conn = QGroupBox('Connexion PostgreSQL')
        layout_conn = QVBoxLayout()

        row_conn = QHBoxLayout()
        row_conn.addWidget(QLabel('Connexion :'))
        self.combo_conn = QComboBox()
        self.load_pg_connections()
        row_conn.addWidget(self.combo_conn, 1)
        btn_refresh = QPushButton('Rafraichir')
        btn_refresh.clicked.connect(self.load_pg_connections)
        row_conn.addWidget(btn_refresh)
        layout_conn.addLayout(row_conn)

        group_conn.setLayout(layout_conn)
        layout.addWidget(group_conn)

        # === Groupe Couches BDCO ===
        group_bdco = QGroupBox('Couches BDCO a charger')
        layout_bdco = QVBoxLayout()

        self.list_bdco = QListWidget()
        self.list_bdco.setSelectionMode(QAbstractItemView.MultiSelection)

        layers_info = [
            ('parcelles', 'Parcelles (bien-fonds)', True),
            ('batiments', 'Batiments', True),
            ('surfaces', 'Routes / Surfaces dures', True),
            ('points_limites', 'Points limites', True),
            ('noms_locaux', 'Noms locaux (rues)', True),
            ('limites_plans', 'Limites de plans', False),
        ]

        for key, label, selected in layers_info:
            item = QListWidgetItem(label)
            item.setData(Qt.UserRole, key)
            if selected:
                item.setSelected(True)
            self.list_bdco.addItem(item)

        layout_bdco.addWidget(self.list_bdco)
        group_bdco.setLayout(layout_bdco)
        layout.addWidget(group_bdco)

        # === Groupe Servitudes lineaires ===
        group_serv = QGroupBox('Servitudes lineaires (conduites)')
        layout_serv = QVBoxLayout()

        self.list_servitudes = QListWidget()
        self.list_servitudes.setSelectionMode(QAbstractItemView.MultiSelection)
        self.list_servitudes.setMaximumHeight(120)

        for code, config in SERVITUDES_CONFIG.items():
            item = QListWidgetItem(f"{config['nom']} ({code})")
            item.setData(Qt.UserRole, code)
            if code in ['EU', 'SEIC', 'ESP']:
                item.setSelected(True)
            self.list_servitudes.addItem(item)

        layout_serv.addWidget(self.list_servitudes)
        group_serv.setLayout(layout_serv)
        layout.addWidget(group_serv)

        # === Groupe Servitudes surfaciques ===
        group_surf = QGroupBox('Servitudes surfaciques (emprises)')
        layout_surf = QVBoxLayout()

        self.list_surfaces = QListWidget()
        self.list_surfaces.setSelectionMode(QAbstractItemView.MultiSelection)
        self.list_surfaces.setMaximumHeight(120)

        for code, config in SERVITUDES_SURFACES_CONFIG.items():
            item = QListWidgetItem(f"{config['nom']} ({code})")
            item.setData(Qt.UserRole, code)
            # Par defaut, selectionner les emprises EU, ESP, SEIC
            if code in ['EMPRISE_EU', 'EMPRISE_ESP', 'EMPRISE_SEIC']:
                item.setSelected(True)
            self.list_surfaces.addItem(item)

        layout_surf.addWidget(self.list_surfaces)
        group_surf.setLayout(layout_surf)
        layout.addWidget(group_surf)

        # === Barre de progression ===
        self.progress = QProgressBar()
        self.progress.setVisible(False)
        layout.addWidget(self.progress)

        # === Boutons ===
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        btn_load = QPushButton('Charger')
        btn_load.setDefault(True)
        btn_load.clicked.connect(self.load_layers)
        btn_layout.addWidget(btn_load)

        btn_cancel = QPushButton('Annuler')
        btn_cancel.clicked.connect(self.reject)
        btn_layout.addWidget(btn_cancel)

        layout.addLayout(btn_layout)
        self.setLayout(layout)

    def load_pg_connections(self):
        """Charge la liste des connexions PostgreSQL disponibles"""
        self.combo_conn.clear()
        settings = QSettings()
        settings.beginGroup('PostgreSQL/connections')
        connections = settings.childGroups()
        settings.endGroup()

        for conn in connections:
            self.combo_conn.addItem(conn)

        if self.combo_conn.count() == 0:
            self.combo_conn.addItem('-- Aucune connexion PostgreSQL --')

    def load_layers(self):
        """Lance le chargement des couches"""
        conn_name = self.combo_conn.currentText()
        if not conn_name or conn_name.startswith('--'):
            QMessageBox.warning(self, 'Erreur', 'Veuillez selectionner une connexion PostgreSQL.')
            return

        schema = 'bdco'  # Schema fixe

        selected_bdco = [item.data(Qt.UserRole) for item in self.list_bdco.selectedItems()]
        selected_serv = [item.data(Qt.UserRole) for item in self.list_servitudes.selectedItems()]
        selected_surf = [item.data(Qt.UserRole) for item in self.list_surfaces.selectedItems()]

        if not selected_bdco and not selected_serv and not selected_surf:
            QMessageBox.warning(self, 'Erreur', 'Selectionnez au moins une couche.')
            return

        self.progress.setVisible(True)
        self.progress.setMaximum(len(selected_bdco) + len(selected_serv) + len(selected_surf))
        count = 0

        loaded_bdco = 0
        loaded_serv = 0
        loaded_surf = 0

        # Charger couches BDCO
        for layer_key in selected_bdco:
            layer = load_bdco_layer(self.iface, conn_name, schema, layer_key)
            if layer:
                loaded_bdco += 1
            count += 1
            self.progress.setValue(count)

        # Creer couches servitudes lineaires
        for serv_code in selected_serv:
            layer = create_servitude_layer(self.iface, serv_code)
            if layer:
                loaded_serv += 1
            count += 1
            self.progress.setValue(count)

        # Creer couches servitudes surfaciques
        for surf_code in selected_surf:
            layer = create_servitude_surface_layer(self.iface, surf_code)
            if layer:
                loaded_surf += 1
            count += 1
            self.progress.setValue(count)

        self.progress.setVisible(False)
        self.iface.mapCanvas().refresh()

        QMessageBox.information(
            self, 'Termine',
            f'Chargement termine !\n\n'
            f'- {loaded_bdco} couche(s) BDCO chargee(s)\n'
            f'- {loaded_serv} servitude(s) lineaire(s) creee(s)\n'
            f'- {loaded_surf} servitude(s) surfacique(s) creee(s)'
        )
        self.accept()


# =============================================================================
# FONCTIONS DE CHARGEMENT ET STYLISATION
# =============================================================================

def build_uri(conn_name, schema, table_name):
    """Construit l'URI de connexion PostgreSQL"""
    settings = QSettings()
    settings.beginGroup(f'PostgreSQL/connections/{conn_name}')

    uri = QgsDataSourceUri()
    uri.setConnection(
        settings.value('host', 'localhost'),
        settings.value('port', '5432'),
        settings.value('database', ''),
        settings.value('username', ''),
        settings.value('password', '')
    )
    uri.setDataSource(schema, table_name, 'geom')

    settings.endGroup()
    return uri


def load_bdco_layer(iface, conn_name, schema, layer_key):
    """Charge une couche BDCO depuis PostgreSQL et applique le style"""

    config = BDCO_LAYERS_CONFIG.get(layer_key)
    if not config:
        return None

    layer = None
    layer_name = None

    for table_name in config['table_names']:
        uri = build_uri(conn_name, schema, table_name)
        test_layer = QgsVectorLayer(uri.uri(), table_name, 'postgres')
        if test_layer.isValid():
            layer = test_layer
            layer_name = table_name
            break

    if not layer:
        iface.messageBar().pushMessage(
            'BDCO Sketcher',
            f'Couche {layer_key} non trouvee',
            level=Qgis.Warning
        )
        return None

    apply_style(layer, config)
    QgsProject.instance().addMapLayer(layer)

    return layer


def apply_style(layer, config):
    """Applique le style a une couche selon sa geometrie"""

    geom_type = layer.geometryType()

    if geom_type == QgsWkbTypes.PolygonGeometry:
        symbol = QgsFillSymbol.createSimple({})
        symbol.deleteSymbolLayer(0)

        fill_layer = QgsSimpleFillSymbolLayer()
        fill_layer.setFillColor(QColor(config.get('fill_color', '#F5F5F5')))
        fill_layer.setStrokeColor(QColor(config.get('stroke_color', '#000000')))
        fill_layer.setStrokeWidth(config.get('stroke_width', 0.15))
        fill_layer.setStrokeWidthUnit(QgsUnitTypes.RenderMillimeters)

        symbol.appendSymbolLayer(fill_layer)
        layer.setRenderer(QgsSingleSymbolRenderer(symbol))

    elif geom_type == QgsWkbTypes.LineGeometry:
        symbol = QgsLineSymbol.createSimple({})
        symbol.deleteSymbolLayer(0)

        line_layer = QgsSimpleLineSymbolLayer()
        line_layer.setColor(QColor(config.get('stroke_color', '#000000')))
        line_layer.setWidth(config.get('stroke_width', 0.2))
        line_layer.setWidthUnit(QgsUnitTypes.RenderMillimeters)

        if 'dash_pattern' in config:
            line_layer.setUseCustomDashPattern(True)
            line_layer.setCustomDashVector(config['dash_pattern'])

        symbol.appendSymbolLayer(line_layer)
        layer.setRenderer(QgsSingleSymbolRenderer(symbol))

    elif geom_type == QgsWkbTypes.PointGeometry:
        symbol = QgsMarkerSymbol.createSimple({})
        symbol.deleteSymbolLayer(0)

        marker_layer = QgsSimpleMarkerSymbolLayer()
        marker_layer.setShape(QgsSimpleMarkerSymbolLayer.Circle)
        marker_layer.setColor(QColor(0, 0, 0, 0))
        marker_layer.setStrokeColor(QColor(config.get('stroke_color', '#000000')))
        marker_layer.setStrokeWidth(config.get('stroke_width', 0.3))
        marker_layer.setSize(config.get('marker_size', 1.5))
        marker_layer.setSizeUnit(QgsUnitTypes.RenderMillimeters)

        symbol.appendSymbolLayer(marker_layer)
        layer.setRenderer(QgsSingleSymbolRenderer(symbol))

    if 'label_field' in config:
        apply_labels(layer, config)


def apply_labels(layer, config):
    """Configure les etiquettes pour une couche"""
    label_settings = QgsPalLayerSettings()
    label_settings.fieldName = config['label_field']
    label_settings.enabled = True

    # Placement le long des lignes pour les noms de rues
    if config.get('along_line', False):
        label_settings.placement = QgsPalLayerSettings.Line
        label_settings.placementFlags = QgsPalLayerSettings.OnLine

    text_format = QgsTextFormat()
    text_format.setSize(config.get('label_size', 8))
    text_format.setSizeUnit(QgsUnitTypes.RenderPoints)
    text_format.setColor(QColor('#000000'))

    if config.get('italic', False):
        font = text_format.font()
        font.setItalic(True)
        text_format.setFont(font)

    buffer_settings = QgsTextBufferSettings()
    buffer_settings.setEnabled(True)
    buffer_settings.setSize(0.5)
    buffer_settings.setColor(QColor('#FFFFFF'))
    text_format.setBuffer(buffer_settings)

    label_settings.setFormat(text_format)
    layer.setLabeling(QgsVectorLayerSimpleLabeling(label_settings))
    layer.setLabelsEnabled(True)


def create_servitude_layer(iface, serv_code):
    """Cree une couche memoire pour un type de servitude"""

    config = SERVITUDES_CONFIG.get(serv_code)
    if not config:
        return None

    layer = QgsVectorLayer(
        f"LineString?crs=EPSG:2056&field=type_serv:string(50)&field=remarque:string(255)&field=largeur_m:double",
        f"SERV_{serv_code} - {config['nom']}",
        "memory"
    )

    if not layer.isValid():
        return None

    symbol = QgsLineSymbol.createSimple({})
    symbol.deleteSymbolLayer(0)

    line_layer = QgsSimpleLineSymbolLayer()
    line_layer.setColor(QColor(config['couleur']))
    line_layer.setWidth(config['epaisseur'])
    line_layer.setWidthUnit(QgsUnitTypes.RenderMillimeters)

    symbol.appendSymbolLayer(line_layer)
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))

    QgsProject.instance().addMapLayer(layer)
    return layer


def create_servitude_surface_layer(iface, surf_code):
    """Cree une couche memoire surfacique pour un type de servitude"""

    config = SERVITUDES_SURFACES_CONFIG.get(surf_code)
    if not config:
        return None

    layer = QgsVectorLayer(
        f"Polygon?crs=EPSG:2056&field=type_serv:string(50)&field=remarque:string(255)&field=surface_m2:double",
        f"SERV_{surf_code} - {config['nom']}",
        "memory"
    )

    if not layer.isValid():
        return None

    symbol = QgsFillSymbol.createSimple({})
    symbol.deleteSymbolLayer(0)

    fill_layer = QgsSimpleFillSymbolLayer()
    fill_layer.setFillColor(QColor(config['couleur_fond']))
    fill_layer.setStrokeColor(QColor(config['couleur_contour']))
    fill_layer.setStrokeWidth(config['epaisseur_contour'])
    fill_layer.setStrokeWidthUnit(QgsUnitTypes.RenderMillimeters)

    # Style de contour (tirets pour zone non aedificandi)
    if config.get('style_contour') == 'dash':
        fill_layer.setStrokeStyle(Qt.DashLine)

    symbol.appendSymbolLayer(fill_layer)
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))

    QgsProject.instance().addMapLayer(layer)
    return layer


def create_all_servitude_layers(iface):
    """Cree rapidement toutes les couches servitudes (lineaires et surfaciques)"""
    count_lin = 0
    count_surf = 0

    # Servitudes lineaires
    for serv_code in SERVITUDES_CONFIG.keys():
        if create_servitude_layer(iface, serv_code):
            count_lin += 1

    # Servitudes surfaciques
    for surf_code in SERVITUDES_SURFACES_CONFIG.keys():
        if create_servitude_surface_layer(iface, surf_code):
            count_surf += 1

    iface.messageBar().pushMessage(
        'BDCO Sketcher',
        f'{count_lin} lineaire(s) + {count_surf} surfacique(s) creee(s)',
        level=Qgis.Info
    )
