# -*- coding: utf-8 -*-
"""
Dialog de georeferencement de plans PDF
Permet de caler des plans scannes ou numeriques sur la BDCO

Auteur: Marc Zermatten / GeoBrain
"""

import os
import tempfile
from typing import List, Tuple, Optional

from qgis.PyQt.QtCore import Qt, QPointF, QRectF, pyqtSignal
from qgis.PyQt.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QGroupBox,
    QPushButton, QLabel, QFileDialog, QMessageBox,
    QTableWidget, QTableWidgetItem, QHeaderView,
    QSplitter, QWidget, QProgressBar, QSpinBox,
    QGraphicsView, QGraphicsScene, QGraphicsPixmapItem,
    QGraphicsEllipseItem, QGraphicsTextItem, QAbstractItemView,
    QDoubleSpinBox, QSlider
)
from qgis.PyQt.QtGui import QPixmap, QImage, QPen, QBrush, QColor, QFont, QPainter
from qgis.gui import QgsMapToolEmitPoint, QgsRubberBand, QgsVertexMarker
from qgis.core import (
    QgsProject, QgsPointXY, QgsCoordinateReferenceSystem,
    QgsRasterLayer, QgsWkbTypes, Qgis
)

from .georef_helmert import HelmertTransform, estimate_quality

# Import conditionnel du module auto
try:
    from .georef_auto import AutoGeoref, check_dependencies
    AUTO_AVAILABLE = True
except ImportError:
    AUTO_AVAILABLE = False


class ImageViewer(QGraphicsView):
    """Widget pour afficher et interagir avec l'image PDF"""

    point_clicked = pyqtSignal(float, float)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.scene = QGraphicsScene(self)
        self.setScene(self.scene)
        self.setRenderHint(QPainter.Antialiasing)
        self.setDragMode(QGraphicsView.ScrollHandDrag)
        self.setTransformationAnchor(QGraphicsView.AnchorUnderMouse)

        self.pixmap_item = None
        self.gcp_markers = []
        self.picking_mode = False

    def load_image(self, image_path: str):
        """Charge une image dans le viewer"""
        self.scene.clear()
        self.gcp_markers = []

        pixmap = QPixmap(image_path)
        if pixmap.isNull():
            return False

        self.pixmap_item = QGraphicsPixmapItem(pixmap)
        self.scene.addItem(self.pixmap_item)
        self.fitInView(self.pixmap_item, Qt.KeepAspectRatio)
        return True

    def set_picking_mode(self, enabled: bool):
        """Active/desactive le mode selection de point"""
        self.picking_mode = enabled
        if enabled:
            self.setDragMode(QGraphicsView.NoDrag)
            self.setCursor(Qt.CrossCursor)
        else:
            self.setDragMode(QGraphicsView.ScrollHandDrag)
            self.setCursor(Qt.ArrowCursor)

    def mousePressEvent(self, event):
        if self.picking_mode and event.button() == Qt.LeftButton:
            scene_pos = self.mapToScene(event.pos())
            if self.pixmap_item and self.pixmap_item.contains(scene_pos):
                self.point_clicked.emit(scene_pos.x(), scene_pos.y())
                self.set_picking_mode(False)
        else:
            super().mousePressEvent(event)

    def add_gcp_marker(self, x: float, y: float, index: int):
        """Ajoute un marqueur de GCP sur l'image"""
        # Cercle rouge
        marker = QGraphicsEllipseItem(x - 8, y - 8, 16, 16)
        marker.setPen(QPen(QColor(255, 0, 0), 2))
        marker.setBrush(QBrush(QColor(255, 0, 0, 50)))
        self.scene.addItem(marker)

        # Numero
        label = QGraphicsTextItem(str(index + 1))
        label.setPos(x + 10, y - 10)
        label.setDefaultTextColor(QColor(255, 0, 0))
        font = QFont()
        font.setBold(True)
        label.setFont(font)
        self.scene.addItem(label)

        self.gcp_markers.append((marker, label))

    def remove_last_marker(self):
        """Supprime le dernier marqueur"""
        if self.gcp_markers:
            marker, label = self.gcp_markers.pop()
            self.scene.removeItem(marker)
            self.scene.removeItem(label)

    def clear_markers(self):
        """Supprime tous les marqueurs"""
        for marker, label in self.gcp_markers:
            self.scene.removeItem(marker)
            self.scene.removeItem(label)
        self.gcp_markers = []

    def wheelEvent(self, event):
        """Zoom avec la molette"""
        factor = 1.15
        if event.angleDelta().y() < 0:
            factor = 1 / factor
        self.scale(factor, factor)


class MapPointTool(QgsMapToolEmitPoint):
    """Outil de selection de point sur la carte QGIS"""

    point_selected = pyqtSignal(float, float)

    def __init__(self, canvas):
        super().__init__(canvas)
        self.canvas = canvas

    def canvasReleaseEvent(self, event):
        point = self.toMapCoordinates(event.pos())
        self.point_selected.emit(point.x(), point.y())


class GeorefDialog(QDialog):
    """Dialog principal de georeferencement"""

    def __init__(self, iface, parent=None):
        super().__init__(parent)
        self.iface = iface
        self.canvas = iface.mapCanvas()

        self.pdf_path = None
        self.image_path = None
        self.gcps = []  # Liste de tuples ((img_x, img_y), (map_x, map_y))
        self.transform = None
        self.map_markers = []
        self.preview_layer = None  # Couche raster de previsualisation
        self.preview_path = None   # Chemin du fichier temporaire
        self.adjustment_tx = 0.0   # Ajustement translation X
        self.adjustment_ty = 0.0   # Ajustement translation Y
        self.adjustment_rot = 0.0  # Ajustement rotation (deg)
        self.adjustment_scale = 1.0  # Ajustement echelle

        # Outil de selection de point sur la carte
        self.map_tool = MapPointTool(self.canvas)
        self.map_tool.point_selected.connect(self.on_map_point_selected)
        self.previous_tool = None

        self.setup_ui()

    def setup_ui(self):
        """Configure l'interface"""
        self.setWindowTitle('Georeferencement de plan (Helmert)')
        self.setMinimumSize(1000, 700)

        layout = QVBoxLayout()

        # === Splitter principal ===
        splitter = QSplitter(Qt.Horizontal)

        # --- Panneau gauche : Image ---
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)

        # Chargement PDF
        pdf_group = QGroupBox('Plan PDF')
        pdf_layout = QHBoxLayout()
        self.btn_load_pdf = QPushButton('Charger PDF...')
        self.btn_load_pdf.clicked.connect(self.load_pdf)
        pdf_layout.addWidget(self.btn_load_pdf)
        self.lbl_pdf = QLabel('Aucun fichier')
        pdf_layout.addWidget(self.lbl_pdf, 1)

        self.spin_dpi = QSpinBox()
        self.spin_dpi.setRange(72, 600)
        self.spin_dpi.setValue(200)
        self.spin_dpi.setSuffix(' DPI')
        pdf_layout.addWidget(self.spin_dpi)

        pdf_group.setLayout(pdf_layout)
        left_layout.addWidget(pdf_group)

        # Viewer image
        self.image_viewer = ImageViewer()
        self.image_viewer.point_clicked.connect(self.on_image_point_clicked)
        left_layout.addWidget(self.image_viewer, 1)

        splitter.addWidget(left_widget)

        # --- Panneau droit : GCPs et controles ---
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)

        # Instructions
        instr_group = QGroupBox('Mode d\'emploi')
        instr_layout = QVBoxLayout()
        instr_label = QLabel(
            "1. Charger un plan PDF\n"
            "2. Cliquer 'Ajouter GCP'\n"
            "3. Cliquer sur l'image (point de calage)\n"
            "4. Cliquer sur la carte QGIS (point cible)\n"
            "5. Repeter pour 3-4 points minimum\n"
            "6. Calculer la transformation\n"
            "7. Exporter en GeoTIFF"
        )
        instr_label.setWordWrap(True)
        instr_layout.addWidget(instr_label)
        instr_group.setLayout(instr_layout)
        right_layout.addWidget(instr_group)

        # Table des GCPs
        gcp_group = QGroupBox('Points de calage (GCPs)')
        gcp_layout = QVBoxLayout()

        self.table_gcps = QTableWidget()
        self.table_gcps.setColumnCount(5)
        self.table_gcps.setHorizontalHeaderLabels(['#', 'Img X', 'Img Y', 'Map X', 'Map Y'])
        self.table_gcps.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table_gcps.setSelectionBehavior(QAbstractItemView.SelectRows)
        gcp_layout.addWidget(self.table_gcps)

        # Boutons GCP
        btn_gcp_layout = QHBoxLayout()
        self.btn_add_gcp = QPushButton('Ajouter GCP')
        self.btn_add_gcp.clicked.connect(self.start_gcp_picking)
        self.btn_add_gcp.setEnabled(False)
        btn_gcp_layout.addWidget(self.btn_add_gcp)

        self.btn_remove_gcp = QPushButton('Supprimer')
        self.btn_remove_gcp.clicked.connect(self.remove_selected_gcp)
        btn_gcp_layout.addWidget(self.btn_remove_gcp)

        self.btn_clear_gcps = QPushButton('Tout effacer')
        self.btn_clear_gcps.clicked.connect(self.clear_all_gcps)
        btn_gcp_layout.addWidget(self.btn_clear_gcps)

        gcp_layout.addLayout(btn_gcp_layout)

        # Bouton detection automatique
        if AUTO_AVAILABLE:
            auto_layout = QHBoxLayout()
            self.btn_auto_detect = QPushButton('Detection auto (OCR)')
            self.btn_auto_detect.clicked.connect(self.auto_detect_gcps)
            self.btn_auto_detect.setEnabled(False)
            self.btn_auto_detect.setToolTip(
                "Detecte automatiquement les numeros de parcelles\n"
                "et les matche avec la couche BDCO chargee"
            )
            auto_layout.addWidget(self.btn_auto_detect)
            gcp_layout.addLayout(auto_layout)
        gcp_group.setLayout(gcp_layout)
        right_layout.addWidget(gcp_group)

        # Resultats transformation
        result_group = QGroupBox('Transformation Helmert')
        result_layout = QVBoxLayout()

        self.btn_compute = QPushButton('Calculer transformation')
        self.btn_compute.clicked.connect(self.compute_transformation)
        self.btn_compute.setEnabled(False)
        result_layout.addWidget(self.btn_compute)

        self.lbl_result = QLabel('En attente de points de calage...')
        self.lbl_result.setWordWrap(True)
        result_layout.addWidget(self.lbl_result)

        result_group.setLayout(result_layout)
        right_layout.addWidget(result_group)

        # Previsualisation et ajustement
        preview_group = QGroupBox('Previsualisation et ajustement')
        preview_layout = QVBoxLayout()

        self.btn_preview = QPushButton('Previsualiser sur la carte')
        self.btn_preview.clicked.connect(self.preview_on_map)
        self.btn_preview.setEnabled(False)
        self.btn_preview.setToolTip('Affiche le plan cale en transparence sur la carte')
        preview_layout.addWidget(self.btn_preview)

        # Controles d'ajustement manuel
        adjust_label = QLabel('Ajustement manuel:')
        preview_layout.addWidget(adjust_label)

        # Translation X
        tx_layout = QHBoxLayout()
        tx_layout.addWidget(QLabel('Trans. X (m):'))
        self.spin_tx = QDoubleSpinBox()
        self.spin_tx.setRange(-1000, 1000)
        self.spin_tx.setDecimals(2)
        self.spin_tx.setSingleStep(0.5)
        self.spin_tx.setValue(0)
        self.spin_tx.valueChanged.connect(self.on_adjustment_changed)
        tx_layout.addWidget(self.spin_tx)
        preview_layout.addLayout(tx_layout)

        # Translation Y
        ty_layout = QHBoxLayout()
        ty_layout.addWidget(QLabel('Trans. Y (m):'))
        self.spin_ty = QDoubleSpinBox()
        self.spin_ty.setRange(-1000, 1000)
        self.spin_ty.setDecimals(2)
        self.spin_ty.setSingleStep(0.5)
        self.spin_ty.setValue(0)
        self.spin_ty.valueChanged.connect(self.on_adjustment_changed)
        ty_layout.addWidget(self.spin_ty)
        preview_layout.addLayout(ty_layout)

        # Rotation
        rot_layout = QHBoxLayout()
        rot_layout.addWidget(QLabel('Rotation (deg):'))
        self.spin_rotation = QDoubleSpinBox()
        self.spin_rotation.setRange(-180, 180)
        self.spin_rotation.setDecimals(3)
        self.spin_rotation.setSingleStep(0.1)
        self.spin_rotation.setValue(0)
        self.spin_rotation.valueChanged.connect(self.on_adjustment_changed)
        rot_layout.addWidget(self.spin_rotation)
        preview_layout.addLayout(rot_layout)

        # Echelle
        scale_layout = QHBoxLayout()
        scale_layout.addWidget(QLabel('Echelle (%):'))
        self.spin_scale = QDoubleSpinBox()
        self.spin_scale.setRange(50, 200)
        self.spin_scale.setDecimals(2)
        self.spin_scale.setSingleStep(0.5)
        self.spin_scale.setValue(100)
        self.spin_scale.valueChanged.connect(self.on_adjustment_changed)
        scale_layout.addWidget(self.spin_scale)
        preview_layout.addLayout(scale_layout)

        # Transparence
        opacity_layout = QHBoxLayout()
        opacity_layout.addWidget(QLabel('Transparence:'))
        self.slider_opacity = QSlider(Qt.Horizontal)
        self.slider_opacity.setRange(0, 100)
        self.slider_opacity.setValue(50)
        self.slider_opacity.valueChanged.connect(self.on_opacity_changed)
        opacity_layout.addWidget(self.slider_opacity)
        self.lbl_opacity = QLabel('50%')
        opacity_layout.addWidget(self.lbl_opacity)
        preview_layout.addLayout(opacity_layout)

        # Boutons preview
        preview_btn_layout = QHBoxLayout()
        self.btn_update_preview = QPushButton('Actualiser')
        self.btn_update_preview.clicked.connect(self.update_preview)
        self.btn_update_preview.setEnabled(False)
        preview_btn_layout.addWidget(self.btn_update_preview)

        self.btn_remove_preview = QPushButton('Supprimer apercu')
        self.btn_remove_preview.clicked.connect(self.remove_preview)
        self.btn_remove_preview.setEnabled(False)
        preview_btn_layout.addWidget(self.btn_remove_preview)
        preview_layout.addLayout(preview_btn_layout)

        preview_group.setLayout(preview_layout)
        right_layout.addWidget(preview_group)

        # Export
        export_group = QGroupBox('Export final')
        export_layout = QVBoxLayout()

        self.btn_export = QPushButton('Exporter GeoTIFF')
        self.btn_export.clicked.connect(self.export_geotiff)
        self.btn_export.setEnabled(False)
        export_layout.addWidget(self.btn_export)

        self.btn_add_to_qgis = QPushButton('Ajouter au projet QGIS')
        self.btn_add_to_qgis.clicked.connect(self.add_to_qgis)
        self.btn_add_to_qgis.setEnabled(False)
        export_layout.addWidget(self.btn_add_to_qgis)

        export_group.setLayout(export_layout)
        right_layout.addWidget(export_group)

        right_layout.addStretch()

        # Bouton Fermer
        self.btn_close = QPushButton('Fermer')
        self.btn_close.clicked.connect(self.close)
        right_layout.addWidget(self.btn_close)

        splitter.addWidget(right_widget)
        splitter.setSizes([700, 300])

        layout.addWidget(splitter)

        # Status
        self.lbl_status = QLabel('Pret')
        layout.addWidget(self.lbl_status)

        self.setLayout(layout)

    def load_pdf(self):
        """Charge un fichier PDF"""
        path, _ = QFileDialog.getOpenFileName(
            self, 'Ouvrir un plan PDF',
            '', 'PDF (*.pdf);;Images (*.png *.jpg *.tif)'
        )

        if not path:
            return

        self.pdf_path = path
        self.lbl_pdf.setText(os.path.basename(path))
        self.lbl_status.setText('Conversion PDF en cours...')

        # Si c'est deja une image, charger directement
        if path.lower().endswith(('.png', '.jpg', '.jpeg', '.tif', '.tiff')):
            self.image_path = path
            if self.image_viewer.load_image(path):
                self.btn_add_gcp.setEnabled(True)
                if AUTO_AVAILABLE and hasattr(self, 'btn_auto_detect'):
                    self.btn_auto_detect.setEnabled(True)
                self.lbl_status.setText('Image chargee')
            else:
                QMessageBox.warning(self, 'Erreur', 'Impossible de charger l\'image')
            return

        # Convertir PDF en image
        try:
            self.image_path = self.convert_pdf_to_image(path, self.spin_dpi.value())
            if self.image_path and self.image_viewer.load_image(self.image_path):
                self.btn_add_gcp.setEnabled(True)
                if AUTO_AVAILABLE and hasattr(self, 'btn_auto_detect'):
                    self.btn_auto_detect.setEnabled(True)
                self.lbl_status.setText('PDF converti et charge')
            else:
                QMessageBox.warning(self, 'Erreur', 'Impossible de convertir le PDF')
        except ImportError as e:
            # Message d'erreur specifique pour les dependances manquantes
            QMessageBox.warning(
                self, 'Dependance manquante',
                f'{str(e)}\n\n'
                'Pour installer PyMuPDF dans QGIS:\n'
                '1. Ouvrir OSGeo4W Shell (en admin)\n'
                '2. Taper: pip install pymupdf\n\n'
                'Alternative: convertir le PDF en image (PNG/JPG)\n'
                'avec un autre outil et charger l\'image directement.'
            )
            self.lbl_status.setText('Dependance manquante')
        except Exception as e:
            QMessageBox.critical(self, 'Erreur', f'Erreur de conversion:\n{str(e)}')
            self.lbl_status.setText('Erreur de conversion')

    def convert_pdf_to_image(self, pdf_path: str, dpi: int = 200) -> Optional[str]:
        """Convertit un PDF en image PNG"""

        # Essayer PyMuPDF (fitz) d'abord
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(pdf_path)
            page = doc[0]  # Premiere page

            # Calculer la matrice de zoom pour le DPI souhaite
            zoom = dpi / 72.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)

            # Sauvegarder en PNG temporaire
            output_path = tempfile.mktemp(suffix='.png')
            pix.save(output_path)
            doc.close()

            return output_path

        except ImportError:
            pass

        # Fallback: essayer pdf2image
        try:
            from pdf2image import convert_from_path
            images = convert_from_path(pdf_path, dpi=dpi, first_page=1, last_page=1)

            if images:
                output_path = tempfile.mktemp(suffix='.png')
                images[0].save(output_path, 'PNG')
                return output_path

        except ImportError:
            pass

        # Dernier recours: message d'erreur
        raise ImportError(
            "Aucune bibliotheque de conversion PDF disponible.\n"
            "Installer PyMuPDF: pip install pymupdf\n"
            "Ou pdf2image: pip install pdf2image"
        )

    def start_gcp_picking(self):
        """Demarre la selection d'un nouveau GCP"""
        self.lbl_status.setText('Cliquez sur l\'IMAGE pour placer le point source...')
        self.image_viewer.set_picking_mode(True)
        self.btn_add_gcp.setEnabled(False)

    def on_image_point_clicked(self, x: float, y: float):
        """Appele quand un point est clique sur l'image"""
        # Stocker temporairement le point image
        self._pending_img_point = (x, y)

        # Ajouter marqueur sur l'image
        self.image_viewer.add_gcp_marker(x, y, len(self.gcps))

        # Passer a la selection sur la carte
        self.lbl_status.setText('Cliquez sur la CARTE pour placer le point cible...')
        self.previous_tool = self.canvas.mapTool()
        self.canvas.setMapTool(self.map_tool)

    def on_map_point_selected(self, x: float, y: float):
        """Appele quand un point est selectionne sur la carte"""
        if not hasattr(self, '_pending_img_point'):
            return

        img_point = self._pending_img_point
        map_point = (x, y)

        # Ajouter le GCP
        self.gcps.append((img_point, map_point))
        self.update_gcp_table()

        # Ajouter marqueur sur la carte
        marker = QgsVertexMarker(self.canvas)
        marker.setCenter(QgsPointXY(x, y))
        marker.setColor(QColor(255, 0, 0))
        marker.setIconType(QgsVertexMarker.ICON_CROSS)
        marker.setIconSize(12)
        marker.setPenWidth(2)
        self.map_markers.append(marker)

        # Restaurer l'outil precedent
        if self.previous_tool:
            self.canvas.setMapTool(self.previous_tool)

        del self._pending_img_point
        self.btn_add_gcp.setEnabled(True)
        self.btn_compute.setEnabled(len(self.gcps) >= 2)

        self.lbl_status.setText(f'{len(self.gcps)} GCP(s) defini(s) - Minimum 2 requis')

    def update_gcp_table(self):
        """Met a jour la table des GCPs"""
        self.table_gcps.setRowCount(len(self.gcps))

        for i, (img_pt, map_pt) in enumerate(self.gcps):
            self.table_gcps.setItem(i, 0, QTableWidgetItem(str(i + 1)))
            self.table_gcps.setItem(i, 1, QTableWidgetItem(f'{img_pt[0]:.1f}'))
            self.table_gcps.setItem(i, 2, QTableWidgetItem(f'{img_pt[1]:.1f}'))
            self.table_gcps.setItem(i, 3, QTableWidgetItem(f'{map_pt[0]:.2f}'))
            self.table_gcps.setItem(i, 4, QTableWidgetItem(f'{map_pt[1]:.2f}'))

    def remove_selected_gcp(self):
        """Supprime le GCP selectionne"""
        row = self.table_gcps.currentRow()
        if row < 0 or row >= len(self.gcps):
            return

        # Supprimer les marqueurs
        if row < len(self.map_markers):
            self.canvas.scene().removeItem(self.map_markers[row])
            del self.map_markers[row]

        self.image_viewer.clear_markers()

        # Supprimer le GCP
        del self.gcps[row]

        # Re-ajouter les marqueurs restants sur l'image
        for i, (img_pt, _) in enumerate(self.gcps):
            self.image_viewer.add_gcp_marker(img_pt[0], img_pt[1], i)

        self.update_gcp_table()
        self.btn_compute.setEnabled(len(self.gcps) >= 2)
        self.lbl_status.setText(f'{len(self.gcps)} GCP(s) defini(s)')

    def clear_all_gcps(self):
        """Efface tous les GCPs"""
        self.gcps = []
        self.image_viewer.clear_markers()

        for marker in self.map_markers:
            self.canvas.scene().removeItem(marker)
        self.map_markers = []

        self.update_gcp_table()
        self.btn_compute.setEnabled(False)
        self.btn_export.setEnabled(False)
        self.btn_add_to_qgis.setEnabled(False)
        self.transform = None
        self.lbl_result.setText('En attente de points de calage...')
        self.lbl_status.setText('GCPs effaces')

    def compute_transformation(self):
        """Calcule la transformation Helmert"""
        if len(self.gcps) < 2:
            QMessageBox.warning(self, 'Erreur', 'Minimum 2 GCPs requis')
            return

        src_points = [gcp[0] for gcp in self.gcps]
        tgt_points = [gcp[1] for gcp in self.gcps]

        self.transform = HelmertTransform()
        success = self.transform.compute_from_gcps(src_points, tgt_points)

        if success:
            params = self.transform.get_parameters()
            quality = estimate_quality(params['rmse'], params['scale'])

            result_text = (
                f"Transformation calculee:\n\n"
                f"Translation X: {params['tx']:.2f} m\n"
                f"Translation Y: {params['ty']:.2f} m\n"
                f"Rotation: {params['rotation_deg']:.4f} deg\n"
                f"Echelle: {params['scale']:.6f}\n"
                f"RMSE: {params['rmse']:.4f} m\n\n"
                f"Qualite: {quality}"
            )
            self.lbl_result.setText(result_text)
            self.btn_export.setEnabled(True)
            self.btn_preview.setEnabled(True)
            self.lbl_status.setText('Transformation calculee - Previsualiser ou exporter')
        else:
            self.lbl_result.setText('Erreur de calcul')
            QMessageBox.warning(self, 'Erreur', 'Impossible de calculer la transformation')

    def export_geotiff(self):
        """Exporte l'image georeferencee en GeoTIFF (avec ajustements)"""
        if not self.transform or not self.image_path:
            return

        output_path, _ = QFileDialog.getSaveFileName(
            self, 'Enregistrer GeoTIFF',
            os.path.splitext(self.pdf_path)[0] + '_georef.tif',
            'GeoTIFF (*.tif)'
        )

        if not output_path:
            return

        try:
            # Utiliser la methode avec ajustements
            self.create_geotiff_with_adjustments(self.image_path, output_path)
            self.output_geotiff = output_path
            self.btn_add_to_qgis.setEnabled(True)

            # Supprimer la preview si elle existe
            self.remove_preview()

            self.lbl_status.setText(f'GeoTIFF exporte: {os.path.basename(output_path)}')
            QMessageBox.information(self, 'Succes', f'GeoTIFF cree:\n{output_path}')
        except Exception as e:
            QMessageBox.critical(self, 'Erreur', f'Erreur d\'export:\n{str(e)}')

    def create_geotiff(self, input_path: str, output_path: str):
        """Cree un GeoTIFF georeference avec GDAL"""
        from osgeo import gdal, osr

        # Ouvrir l'image source
        src_ds = gdal.Open(input_path)
        if not src_ds:
            raise Exception("Impossible d'ouvrir l'image source")

        # Creer le GeoTIFF de sortie
        driver = gdal.GetDriverByName('GTiff')
        dst_ds = driver.CreateCopy(output_path, src_ds, strict=0,
                                    options=['COMPRESS=LZW', 'TILED=YES'])

        if not dst_ds:
            raise Exception("Impossible de creer le GeoTIFF")

        # Appliquer la geotransformation
        gt = self.transform.get_gdal_geotransform(
            origin_x=0,
            origin_y=0,
            pixel_width=1,
            pixel_height=1
        )
        dst_ds.SetGeoTransform(gt)

        # Definir le SRS (MN95 / EPSG:2056)
        srs = osr.SpatialReference()
        srs.ImportFromEPSG(2056)
        dst_ds.SetProjection(srs.ExportToWkt())

        # Fermer les datasets
        src_ds = None
        dst_ds = None

    def add_to_qgis(self):
        """Ajoute le GeoTIFF au projet QGIS"""
        if not hasattr(self, 'output_geotiff'):
            return

        layer_name = os.path.splitext(os.path.basename(self.output_geotiff))[0]
        layer = QgsRasterLayer(self.output_geotiff, layer_name)

        if layer.isValid():
            QgsProject.instance().addMapLayer(layer)
            self.lbl_status.setText(f'Couche ajoutee: {layer_name}')
        else:
            QMessageBox.warning(self, 'Erreur', 'Impossible d\'ajouter la couche')

    def preview_on_map(self):
        """Cree une couche raster de previsualisation sur la carte"""
        if not self.transform or not self.image_path:
            QMessageBox.warning(self, 'Erreur', 'Calculer d\'abord la transformation')
            return

        try:
            # Supprimer l'ancienne preview si elle existe
            self.remove_preview()

            # Creer le GeoTIFF temporaire
            self.preview_path = tempfile.mktemp(suffix='_preview.tif')
            self.create_geotiff_with_adjustments(self.image_path, self.preview_path)

            # Charger comme couche raster
            self.preview_layer = QgsRasterLayer(self.preview_path, 'Preview calage')

            if self.preview_layer.isValid():
                # Appliquer la transparence
                opacity = self.slider_opacity.value() / 100.0
                self.preview_layer.renderer().setOpacity(opacity)

                QgsProject.instance().addMapLayer(self.preview_layer)
                self.canvas.refresh()

                self.btn_update_preview.setEnabled(True)
                self.btn_remove_preview.setEnabled(True)
                self.lbl_status.setText('Preview affichee - ajustez si necessaire')
            else:
                QMessageBox.warning(self, 'Erreur', 'Impossible de charger la preview')

        except Exception as e:
            QMessageBox.critical(self, 'Erreur', f'Erreur preview:\n{str(e)}')

    def update_preview(self):
        """Met a jour la preview avec les ajustements actuels"""
        if not self.transform or not self.image_path:
            return

        try:
            # Supprimer l'ancienne couche
            if self.preview_layer:
                QgsProject.instance().removeMapLayer(self.preview_layer.id())

            # Recreer avec les nouveaux ajustements
            self.preview_path = tempfile.mktemp(suffix='_preview.tif')
            self.create_geotiff_with_adjustments(self.image_path, self.preview_path)

            self.preview_layer = QgsRasterLayer(self.preview_path, 'Preview calage')

            if self.preview_layer.isValid():
                opacity = self.slider_opacity.value() / 100.0
                self.preview_layer.renderer().setOpacity(opacity)
                QgsProject.instance().addMapLayer(self.preview_layer)
                self.canvas.refresh()

        except Exception as e:
            self.lbl_status.setText(f'Erreur update: {str(e)}')

    def remove_preview(self):
        """Supprime la couche de previsualisation"""
        if self.preview_layer:
            try:
                QgsProject.instance().removeMapLayer(self.preview_layer.id())
            except:
                pass
            self.preview_layer = None

        self.btn_update_preview.setEnabled(False)
        self.btn_remove_preview.setEnabled(False)
        self.canvas.refresh()

    def on_adjustment_changed(self, value):
        """Appele quand un ajustement est modifie"""
        self.adjustment_tx = self.spin_tx.value()
        self.adjustment_ty = self.spin_ty.value()
        self.adjustment_rot = self.spin_rotation.value()
        self.adjustment_scale = self.spin_scale.value() / 100.0

        # Indicateur visuel que la preview doit etre actualisee
        if self.preview_layer:
            self.lbl_status.setText('Ajustements modifies - cliquer Actualiser')

    def on_opacity_changed(self, value):
        """Change la transparence de la preview"""
        self.lbl_opacity.setText(f'{value}%')

        if self.preview_layer:
            opacity = value / 100.0
            self.preview_layer.renderer().setOpacity(opacity)
            self.preview_layer.triggerRepaint()

    def create_geotiff_with_adjustments(self, input_path: str, output_path: str):
        """Cree un GeoTIFF avec la transformation + ajustements manuels"""
        import math
        from osgeo import gdal, osr

        # Ouvrir l'image source
        src_ds = gdal.Open(input_path)
        if not src_ds:
            raise Exception("Impossible d'ouvrir l'image source")

        # Creer le GeoTIFF de sortie
        driver = gdal.GetDriverByName('GTiff')
        dst_ds = driver.CreateCopy(output_path, src_ds, strict=0,
                                    options=['COMPRESS=LZW', 'TILED=YES'])

        if not dst_ds:
            raise Exception("Impossible de creer le GeoTIFF")

        # Calculer la transformation ajustee
        # Transformation de base depuis Helmert
        base_tx = self.transform.tx
        base_ty = self.transform.ty
        base_rot = self.transform.theta  # en radians
        base_scale = self.transform.scale

        # Appliquer les ajustements
        final_tx = base_tx + self.adjustment_tx
        final_ty = base_ty + self.adjustment_ty
        final_rot = base_rot + math.radians(self.adjustment_rot)
        final_scale = base_scale * self.adjustment_scale

        cos_t = math.cos(final_rot)
        sin_t = math.sin(final_rot)

        # GeoTransform GDAL
        gt = (
            final_tx,                      # Origin X
            final_scale * cos_t,           # Pixel width
            final_scale * sin_t,           # Rotation X
            final_ty,                      # Origin Y
            final_scale * sin_t,           # Rotation Y
            -final_scale * cos_t           # Pixel height (negatif)
        )

        dst_ds.SetGeoTransform(gt)

        # Definir le SRS (MN95 / EPSG:2056)
        srs = osr.SpatialReference()
        srs.ImportFromEPSG(2056)
        dst_ds.SetProjection(srs.ExportToWkt())

        # Fermer
        src_ds = None
        dst_ds = None

    def auto_detect_gcps(self):
        """Detection automatique des GCPs via OCR des numeros de parcelles"""
        if not AUTO_AVAILABLE:
            QMessageBox.warning(self, 'Erreur', 'Module de detection auto non disponible')
            return

        if not self.image_path:
            QMessageBox.warning(self, 'Erreur', 'Charger d\'abord une image')
            return

        # Verifier les dependances
        deps = check_dependencies()
        missing = []
        if not deps['opencv']:
            missing.append('opencv-python')
        if not deps['tesseract']:
            missing.append('pytesseract + Tesseract-OCR')

        if missing:
            QMessageBox.warning(
                self, 'Dependances manquantes',
                'Pour la detection automatique, installer:\n\n' +
                '\n'.join(f'- {m}' for m in missing) +
                '\n\nDans OSGeo4W Shell:\n'
                'pip install opencv-python pytesseract'
            )
            return

        self.lbl_status.setText('Detection OCR en cours...')

        try:
            auto = AutoGeoref(self.image_path)

            # Detection
            n_detected = auto.detect(min_confidence=50.0)
            if n_detected == 0:
                QMessageBox.information(
                    self, 'Detection',
                    'Aucun numero de parcelle detecte.\n'
                    'Essayez le mode manuel.'
                )
                self.lbl_status.setText('Aucune parcelle detectee')
                return

            self.lbl_status.setText(f'{n_detected} numero(s) detecte(s), matching BDCO...')

            # Matching avec BDCO
            n_matched = auto.match()

            if n_matched == 0:
                QMessageBox.warning(
                    self, 'Matching',
                    f'{n_detected} numero(s) detecte(s) mais aucun match BDCO.\n'
                    'Verifier que les couches BDCO sont chargees.'
                )
                self.lbl_status.setText('Pas de match BDCO')
                return

            # Ajouter les GCPs
            self.clear_all_gcps()

            for gcp in auto.matched_gcps:
                self.gcps.append((gcp.image_point, gcp.map_point))

                # Marqueur sur l'image
                self.image_viewer.add_gcp_marker(
                    gcp.image_point[0], gcp.image_point[1], len(self.gcps) - 1
                )

                # Marqueur sur la carte
                marker = QgsVertexMarker(self.canvas)
                marker.setCenter(QgsPointXY(gcp.map_point[0], gcp.map_point[1]))
                marker.setColor(QColor(0, 200, 0))  # Vert pour auto
                marker.setIconType(QgsVertexMarker.ICON_CIRCLE)
                marker.setIconSize(10)
                marker.setPenWidth(2)
                self.map_markers.append(marker)

            self.update_gcp_table()
            self.btn_compute.setEnabled(len(self.gcps) >= 2)

            QMessageBox.information(
                self, 'Detection automatique',
                f'Succes!\n\n'
                f'- {n_detected} numero(s) de parcelle detecte(s)\n'
                f'- {n_matched} GCP(s) matche(s) avec BDCO\n\n'
                f'Parcelles: {", ".join(g.parcel_number for g in auto.matched_gcps)}'
            )

            self.lbl_status.setText(f'{n_matched} GCP(s) auto-detecte(s)')

        except Exception as e:
            QMessageBox.critical(self, 'Erreur', f'Erreur detection:\n{str(e)}')
            self.lbl_status.setText('Erreur detection')

    def closeEvent(self, event):
        """Nettoyage a la fermeture"""
        # Supprimer la preview
        self.remove_preview()

        # Supprimer les marqueurs de la carte
        for marker in self.map_markers:
            self.canvas.scene().removeItem(marker)
        self.map_markers = []

        # Restaurer l'outil de carte
        if self.previous_tool:
            self.canvas.setMapTool(self.previous_tool)

        super().closeEvent(event)
