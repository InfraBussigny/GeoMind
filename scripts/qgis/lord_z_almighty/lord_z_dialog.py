# -*- coding: utf-8 -*-
"""
Lord Z Almighty - Dialog principal
"""

from qgis.PyQt.QtCore import Qt, QRectF, QPointF, QSizeF
from qgis.PyQt.QtGui import QFont, QColor, QPixmap, QPainter, QImage, QPen, QBrush
from qgis.PyQt.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QMessageBox, QComboBox, QGroupBox, QFileDialog
)
from qgis.core import (
    QgsProject, QgsVectorLayer, QgsFeature, QgsGeometry,
    QgsPointXY, QgsRectangle, QgsCoordinateReferenceSystem,
    QgsCoordinateTransform, QgsRasterLayer, QgsTextAnnotation,
    QgsMarkerSymbol, QgsAnnotationLayer, QgsAnnotationPictureItem, Qgis
)
from qgis.gui import QgsMapCanvas, QgsMapCanvasAnnotationItem, QgsRubberBand
import os


class LordZDialog(QDialog):
    """Dialog pour invoquer Lord Z sur une parcelle"""

    def __init__(self, iface, plugin_dir):
        super().__init__(iface.mainWindow())
        self.iface = iface
        self.plugin_dir = plugin_dir
        self.canvas = iface.mapCanvas()

        # Chemins des images (dans le dossier du plugin)
        self.lord_z_path = os.path.join(plugin_dir, 'Lord_Z.png')
        self.bulle_path = os.path.join(plugin_dir, 'bulle.png')

        # Parcelle courante
        self.current_parcelle = None
        self.parcelle_info = {}

        self.setup_ui()

    def setup_ui(self):
        """Configure l'interface utilisateur"""
        self.setWindowTitle("Lord Z Almighty")
        self.setMinimumWidth(450)

        layout = QVBoxLayout()

        # Titre epique
        title = QLabel("Invoquez Lord Z !")
        title.setFont(QFont("Arial", 16, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("color: #8B4513; margin: 10px;")
        layout.addWidget(title)

        # Sous-titre
        subtitle = QLabel("Le Seigneur des Parcelles va pointer son doigt divin")
        subtitle.setAlignment(Qt.AlignCenter)
        subtitle.setStyleSheet("color: #666; font-style: italic; margin-bottom: 15px;")
        layout.addWidget(subtitle)

        # Groupe recherche
        search_group = QGroupBox("Recherche de parcelle")
        search_layout = QVBoxLayout()

        # Ligne numero parcelle
        parcelle_layout = QHBoxLayout()
        parcelle_layout.addWidget(QLabel("N° Parcelle:"))
        self.parcelle_input = QLineEdit()
        self.parcelle_input.setPlaceholderText("Ex: 791 ou VD0157-12.791")
        self.parcelle_input.returnPressed.connect(self.search_parcelle)
        parcelle_layout.addWidget(self.parcelle_input)
        search_layout.addLayout(parcelle_layout)

        # Source de donnees
        source_layout = QHBoxLayout()
        source_layout.addWidget(QLabel("Source:"))
        self.source_combo = QComboBox()
        self.source_combo.addItem("Base PostgreSQL (bf.immeuble)", "postgres")
        self.source_combo.addItem("Couche active", "layer")
        source_layout.addWidget(self.source_combo)
        search_layout.addLayout(source_layout)

        search_group.setLayout(search_layout)
        layout.addWidget(search_group)

        # Boutons
        btn_layout = QHBoxLayout()

        self.search_btn = QPushButton("Chercher la parcelle")
        self.search_btn.clicked.connect(self.search_parcelle)
        self.search_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                padding: 10px 20px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
        """)
        btn_layout.addWidget(self.search_btn)

        self.invoke_btn = QPushButton("Invoquer Lord Z !")
        self.invoke_btn.clicked.connect(self.invoke_lord_z)
        self.invoke_btn.setEnabled(False)
        self.invoke_btn.setStyleSheet("""
            QPushButton {
                background-color: #8B4513;
                color: white;
                padding: 10px 20px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #A0522D;
            }
            QPushButton:disabled {
                background-color: #ccc;
            }
        """)
        btn_layout.addWidget(self.invoke_btn)

        layout.addLayout(btn_layout)

        # Info parcelle
        self.info_label = QLabel("")
        self.info_label.setWordWrap(True)
        self.info_label.setStyleSheet("""
            QLabel {
                background-color: #f5f5f5;
                padding: 10px;
                border-radius: 5px;
                margin-top: 10px;
            }
        """)
        layout.addWidget(self.info_label)

        # Export
        export_layout = QHBoxLayout()
        self.export_btn = QPushButton("Exporter l'image")
        self.export_btn.clicked.connect(self.export_image)
        self.export_btn.setEnabled(False)
        export_layout.addWidget(self.export_btn)
        layout.addLayout(export_layout)

        # Bouton fermer
        close_btn = QPushButton("Fermer")
        close_btn.clicked.connect(self.close)
        layout.addWidget(close_btn)

        self.setLayout(layout)

    def search_parcelle(self):
        """Recherche une parcelle"""
        numero = self.parcelle_input.text().strip()
        if not numero:
            QMessageBox.warning(self, "Attention", "Veuillez saisir un numero de parcelle")
            return

        source = self.source_combo.currentData()

        if source == "postgres":
            self.search_in_postgres(numero)
        else:
            self.search_in_layer(numero)

    def search_in_postgres(self, numero):
        """Recherche dans PostgreSQL"""
        try:
            # Connexion a la base
            from qgis.core import QgsDataSourceUri

            # Construire la requete
            # Format attendu: numero simple (791) ou complet (VD0157-12.791)
            if '.' in numero:
                # Format complet
                where_clause = f"identdn || '.' || numero = '{numero}'"
            else:
                # Numero simple - on prend Bussigny par defaut
                where_clause = f"numero = '{numero}' AND identdn LIKE 'VD0157%'"

            uri = QgsDataSourceUri()
            uri.setConnection("srv-fme", "5432", "Prod", "postgres", "4w3TL6fsWcSqC")
            uri.setDataSource("bdco", "bdco_parcelle", "geom", where_clause)

            layer = QgsVectorLayer(uri.uri(), "parcelle_temp", "postgres")

            if not layer.isValid():
                QMessageBox.warning(self, "Erreur", "Impossible de se connecter a la base de donnees")
                return

            if layer.featureCount() == 0:
                QMessageBox.warning(self, "Non trouve", f"Parcelle {numero} non trouvee")
                return

            # Recuperer la premiere feature
            feature = next(layer.getFeatures())
            self.process_parcelle(feature, layer)

        except Exception as e:
            QMessageBox.critical(self, "Erreur", f"Erreur de recherche: {str(e)}")

    def search_in_layer(self, numero):
        """Recherche dans la couche active"""
        layer = self.iface.activeLayer()
        if not layer:
            QMessageBox.warning(self, "Attention", "Aucune couche active")
            return

        # Chercher dans les attributs
        for feature in layer.getFeatures():
            for field in feature.fields():
                value = str(feature[field.name()])
                if numero in value:
                    self.process_parcelle(feature, layer)
                    return

        QMessageBox.warning(self, "Non trouve", f"Parcelle {numero} non trouvee dans la couche")

    def process_parcelle(self, feature, layer):
        """Traite la parcelle trouvee"""
        self.current_parcelle = feature
        geom = feature.geometry()

        # Extraire les infos
        fields = feature.fields().names()
        self.parcelle_info = {
            'numero': feature['numero'] if 'numero' in fields else 'N/A',
            'identdn': feature['identdn'] if 'identdn' in fields else 'N/A',
            'surface': f"{feature['surface_vd']:.0f} m²" if 'surface_vd' in fields and feature['surface_vd'] else f"{geom.area():.0f} m²",
            'genre': feature['genre'] if 'genre' in fields else 'N/A',
            'egrid': feature['egris_egrid'] if 'egris_egrid' in fields else '',
        }

        # Afficher les infos
        info_text = f"""
        <b>Parcelle trouvee !</b><br><br>
        <b>Numero:</b> {self.parcelle_info['numero']}<br>
        <b>Identifiant:</b> {self.parcelle_info['identdn']}<br>
        <b>Surface:</b> {self.parcelle_info['surface']}<br>
        <b>Genre:</b> {self.parcelle_info['genre']}<br>
        <b>EGRID:</b> {self.parcelle_info['egrid']}
        """
        self.info_label.setText(info_text)

        # Zoomer sur la parcelle
        self.zoom_to_parcelle(geom, layer.crs())

        # Activer le bouton
        self.invoke_btn.setEnabled(True)
        self.export_btn.setEnabled(True)

    def zoom_to_parcelle(self, geom, crs):
        """Zoom sur la parcelle au 1:1000"""
        # Ajouter un fond de carte si aucun n'existe
        self.ensure_basemap()

        # Obtenir le centroide pour centrer la vue
        centroid = geom.centroid().asPoint()

        # Transformer si necessaire
        canvas_crs = self.canvas.mapSettings().destinationCrs()
        if crs != canvas_crs:
            transform = QgsCoordinateTransform(crs, canvas_crs, QgsProject.instance())
            centroid = transform.transform(centroid)

        # Centrer sur le centroide
        self.canvas.setCenter(centroid)

        # Forcer l'echelle a 1:1000
        self.canvas.zoomScale(1000)
        self.canvas.refresh()

    def ensure_basemap(self):
        """Ajoute un fond de carte avec cadastre si aucun n'est present"""
        project = QgsProject.instance()

        # Verifier si un fond de carte existe deja
        has_basemap = False
        for layer in project.mapLayers().values():
            if isinstance(layer, QgsRasterLayer):
                has_basemap = True
                break

        if not has_basemap:
            # 1. Orthophoto en fond
            ortho_url = (
                "crs=EPSG:2056&"
                "format=image/jpeg&"
                "layers=ch.swisstopo.swissimage&"
                "styles=&"
                "url=https://wms.geo.admin.ch/"
            )
            ortho = QgsRasterLayer(ortho_url, "Orthophoto", "wms")
            if ortho.isValid():
                project.addMapLayer(ortho)

            # 2. Ajouter les limites cadastrales depuis PostGIS
            self.add_cadastre_layer(project)

    def add_cadastre_layer(self, project):
        """Ajoute la couche des limites cadastrales avec style contour"""
        from qgis.core import QgsDataSourceUri, QgsSimpleFillSymbolLayer, QgsFillSymbol

        uri = QgsDataSourceUri()
        uri.setConnection("srv-fme", "5432", "Prod", "postgres", "4w3TL6fsWcSqC")
        uri.setDataSource("bdco", "bdco_parcelle", "geom")

        cadastre = QgsVectorLayer(uri.uri(), "Limites cadastrales", "postgres")

        if cadastre.isValid():
            # Style : contour noir, pas de remplissage
            symbol = QgsFillSymbol.createSimple({
                'color': 'transparent',
                'outline_color': '#000000',
                'outline_width': '0.3'
            })
            cadastre.renderer().setSymbol(symbol)
            cadastre.triggerRepaint()

            project.addMapLayer(cadastre)

    def invoke_lord_z(self):
        """Invoque Lord Z sur la parcelle !"""
        if not self.current_parcelle:
            return

        try:
            # Generer l'image composite
            self.create_lord_z_overlay()
            QMessageBox.information(
                self, "Lord Z a parle !",
                "Lord Z pointe maintenant sur votre parcelle avec sagesse !"
            )
        except Exception as e:
            QMessageBox.critical(self, "Erreur", f"Lord Z a trebûche: {str(e)}")

    def create_lord_z_overlay(self):
        """Cree l'overlay avec Lord Z et la bulle"""
        # Obtenir le centroide de la parcelle
        geom = self.current_parcelle.geometry()
        centroid = geom.centroid().asPoint()

        # Calculer les dimensions de l'extent actuel
        extent = self.canvas.extent()
        width = extent.width()
        height = extent.height()

        # Taille de Lord Z (proportionnelle a l'extent)
        img_width = width * 0.35
        img_height = height * 0.55

        # Coordonnees relatives dans l'image Lord_Z.png (depuis le coin bas-gauche)
        DOIGT_X = 0.85  # 85% de la largeur
        DOIGT_Y = 0.55  # 55% de la hauteur depuis le bas
        BOUCHE_X = 0.45  # 45% de la largeur
        BOUCHE_Y = 0.70  # 70% de la hauteur depuis le bas
        TETE_X = 0.45   # 45% de la largeur
        TETE_Y = 0.92   # 92% de la hauteur depuis le bas (haut de la tete)

        # Position de l'image : le bout du doigt doit etre sur le centroide
        # coin bas-gauche de l'image = centroide - offset du doigt
        lord_z_x = centroid.x() - (img_width * DOIGT_X)
        lord_z_y = centroid.y() - (img_height * DOIGT_Y)

        # Creer une couche d'annotation
        annotation_layer = QgsAnnotationLayer(
            "Lord Z Almighty",
            QgsAnnotationLayer.LayerOptions(QgsProject.instance().transformContext())
        )

        # Charger l'image Lord Z
        if os.path.exists(self.lord_z_path):
            lord_z_item = QgsAnnotationPictureItem(
                Qgis.PictureFormat.Raster,
                self.lord_z_path,
                QgsRectangle(
                    lord_z_x,
                    lord_z_y,
                    lord_z_x + img_width,
                    lord_z_y + img_height
                )
            )
            annotation_layer.addItem(lord_z_item)

        # Ajouter la couche au projet
        QgsProject.instance().addMapLayer(annotation_layer)

        # Position de la bouche (pour la pointe de la bulle)
        bouche_x = lord_z_x + (img_width * BOUCHE_X)
        bouche_y = lord_z_y + (img_height * BOUCHE_Y)

        # Position de la bulle (au-dessus de la tete)
        bulle_x = lord_z_x + (img_width * TETE_X)
        bulle_y = lord_z_y + (img_height * TETE_Y) + (height * 0.02)  # Petit decalage au-dessus

        # Creer la bulle avec pointe vers la bouche
        self.add_speech_bubble(bulle_x, bulle_y, bouche_x, bouche_y, annotation_layer)

        self.canvas.refresh()

    def add_speech_bubble(self, bulle_x, bulle_y, pointe_x, pointe_y, annotation_layer):
        """Cree une bulle BD avec pointe vers la bouche"""
        from qgis.core import QgsAnnotationPolygonItem, QgsAnnotationPointTextItem, QgsTextFormat
        from qgis.PyQt.QtGui import QFont, QColor

        # Dimensions de la bulle
        extent = self.canvas.extent()
        bulle_width = extent.width() * 0.18
        bulle_height = extent.height() * 0.12

        # Points du rectangle de la bulle (coin bas-gauche = bulle_x, bulle_y)
        x1 = bulle_x - bulle_width * 0.3  # Decale a gauche pour centrer sur la tete
        y1 = bulle_y
        x2 = x1 + bulle_width
        y2 = y1 + bulle_height

        # Creer le polygone de la bulle avec pointe
        # Rectangle + triangle pour la pointe
        bubble_points = [
            QgsPointXY(x1, y1),                    # Bas gauche
            QgsPointXY(x1, y2),                    # Haut gauche
            QgsPointXY(x2, y2),                    # Haut droite
            QgsPointXY(x2, y1),                    # Bas droite
            QgsPointXY(x1 + bulle_width * 0.6, y1),  # Retour vers pointe
            QgsPointXY(pointe_x, pointe_y),       # Pointe vers la bouche
            QgsPointXY(x1 + bulle_width * 0.4, y1),  # Retour du triangle
            QgsPointXY(x1, y1),                    # Fermer le polygone
        ]

        # Creer la geometrie
        bubble_geom = QgsGeometry.fromPolygonXY([bubble_points])

        # Creer l'item polygone
        bubble_item = QgsAnnotationPolygonItem(bubble_geom)

        # Style de la bulle
        from qgis.core import QgsFillSymbol
        symbol = QgsFillSymbol.createSimple({
            'color': '255,255,240,230',  # Beige clair
            'outline_color': '#333333',
            'outline_width': '0.5'
        })
        bubble_item.setSymbol(symbol)
        annotation_layer.addItem(bubble_item)

        # Ajouter le texte au centre de la bulle
        text_x = x1 + bulle_width * 0.5
        text_y = y1 + bulle_height * 0.5

        info_text = (
            f"Parcelle {self.parcelle_info['numero']}\n"
            f"{self.parcelle_info['identdn']}\n"
            f"{self.parcelle_info['surface']}\n"
            f"{self.parcelle_info['genre']}"
        )

        text_item = QgsAnnotationPointTextItem(info_text, QgsPointXY(text_x, text_y))

        # Style du texte
        text_format = QgsTextFormat()
        text_format.setFont(QFont("Arial", 9))
        text_format.setColor(QColor("#333333"))
        text_format.setSize(9)
        text_item.setFormat(text_format)

        annotation_layer.addItem(text_item)

    def export_image(self):
        """Exporte l'image avec Lord Z"""
        if not self.current_parcelle:
            return

        # Demander le chemin de sauvegarde
        filepath, _ = QFileDialog.getSaveFileName(
            self, "Exporter l'image",
            f"Lord_Z_Parcelle_{self.parcelle_info['numero']}.png",
            "Images PNG (*.png)"
        )

        if not filepath:
            return

        try:
            # Capturer le canvas
            self.canvas.saveAsImage(filepath)
            QMessageBox.information(
                self, "Export reussi",
                f"Image exportee: {filepath}"
            )
        except Exception as e:
            QMessageBox.critical(self, "Erreur", f"Erreur d'export: {str(e)}")
