# -*- coding: utf-8 -*-
"""
Module de georeferencement automatique
Detection des numeros de parcelles via OCR et matching avec BDCO

Auteur: Marc Zermatten / GeoBrain
"""

import os
import re
import tempfile
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass

# Imports QGIS
from qgis.core import (
    QgsProject, QgsVectorLayer, QgsFeatureRequest,
    QgsPointXY, QgsGeometry, QgsRectangle
)

# Imports pour traitement image
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

# Import OCR
try:
    import pytesseract
    from PIL import Image
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False


@dataclass
class DetectedParcel:
    """Parcelle detectee dans l'image"""
    numero: str
    bbox_image: Tuple[int, int, int, int]  # x, y, w, h dans l'image
    center_image: Tuple[float, float]  # centre dans l'image
    confidence: float


@dataclass
class MatchedGCP:
    """Point de calage matche automatiquement"""
    parcel_number: str
    image_point: Tuple[float, float]
    map_point: Tuple[float, float]
    confidence: float


def check_dependencies() -> Dict[str, bool]:
    """Verifie les dependances disponibles"""
    return {
        'opencv': CV2_AVAILABLE,
        'tesseract': TESSERACT_AVAILABLE
    }


def detect_parcel_numbers(image_path: str,
                          min_confidence: float = 60.0) -> List[DetectedParcel]:
    """
    Detecte les numeros de parcelles dans une image via OCR

    Args:
        image_path: Chemin vers l'image
        min_confidence: Seuil de confiance minimum (0-100)

    Returns:
        Liste des parcelles detectees
    """
    if not TESSERACT_AVAILABLE:
        raise ImportError("pytesseract non disponible. Installer avec: pip install pytesseract")

    if not CV2_AVAILABLE:
        raise ImportError("opencv non disponible. Installer avec: pip install opencv-python")

    # Charger l'image
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Impossible de charger l'image: {image_path}")

    # Convertir en niveaux de gris
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Preprocessing pour ameliorer l'OCR
    # Binarisation adaptive
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )

    # OCR avec detection des boites
    # Configuration pour detecter les chiffres principalement
    custom_config = r'--oem 3 --psm 11 -c tessedit_char_whitelist=0123456789'

    # Obtenir les donnees detaillees
    data = pytesseract.image_to_data(binary, config=custom_config, output_type=pytesseract.Output.DICT)

    parcels = []
    n_boxes = len(data['text'])

    for i in range(n_boxes):
        text = data['text'][i].strip()
        conf = float(data['conf'][i])

        # Filtrer : numeros de 1-5 chiffres avec bonne confiance
        if text and conf >= min_confidence:
            # Verifier que c'est un numero de parcelle valide (1-5 chiffres)
            if re.match(r'^\d{1,5}$', text):
                x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                center = (x + w/2, y + h/2)

                parcels.append(DetectedParcel(
                    numero=text,
                    bbox_image=(x, y, w, h),
                    center_image=center,
                    confidence=conf
                ))

    # Filtrer les doublons (meme numero proche)
    parcels = filter_duplicate_detections(parcels)

    return parcels


def filter_duplicate_detections(parcels: List[DetectedParcel],
                                 distance_threshold: float = 50.0) -> List[DetectedParcel]:
    """
    Filtre les detections en double (meme numero proche spatialement)
    Garde celle avec la meilleure confiance
    """
    if not parcels:
        return []

    filtered = []
    used = set()

    # Trier par confiance decroissante
    sorted_parcels = sorted(parcels, key=lambda p: p.confidence, reverse=True)

    for parcel in sorted_parcels:
        # Verifier si un numero similaire existe deja a proximite
        dominated = False
        for existing in filtered:
            if existing.numero == parcel.numero:
                dx = existing.center_image[0] - parcel.center_image[0]
                dy = existing.center_image[1] - parcel.center_image[1]
                dist = (dx**2 + dy**2) ** 0.5
                if dist < distance_threshold:
                    dominated = True
                    break

        if not dominated:
            filtered.append(parcel)

    return filtered


def find_parcels_in_bdco(parcel_numbers: List[str],
                         parcelle_layer: QgsVectorLayer = None) -> Dict[str, QgsGeometry]:
    """
    Trouve les geometries des parcelles dans la couche BDCO

    Args:
        parcel_numbers: Liste des numeros de parcelles a chercher
        parcelle_layer: Couche de parcelles (si None, cherche dans le projet)

    Returns:
        Dictionnaire {numero: geometrie}
    """
    # Trouver la couche de parcelles si non fournie
    if parcelle_layer is None:
        for layer in QgsProject.instance().mapLayers().values():
            if isinstance(layer, QgsVectorLayer):
                # Chercher une couche qui ressemble aux parcelles
                name_lower = layer.name().lower()
                if 'parcelle' in name_lower or 'bien_fonds' in name_lower or 'bdco_parcelle' in name_lower:
                    parcelle_layer = layer
                    break

    if parcelle_layer is None:
        raise ValueError("Couche de parcelles non trouvee. Charger d'abord les couches BDCO.")

    # Trouver le champ numero
    fields = parcelle_layer.fields()
    numero_field = None
    for field in fields:
        if field.name().lower() in ['numero', 'no_parcelle', 'numero_parcelle', 'identdn']:
            numero_field = field.name()
            break

    if numero_field is None:
        # Essayer de deviner
        for field in fields:
            if 'num' in field.name().lower() or 'no' in field.name().lower():
                numero_field = field.name()
                break

    if numero_field is None:
        raise ValueError("Champ numero de parcelle non trouve dans la couche")

    # Chercher les parcelles
    results = {}

    for numero in parcel_numbers:
        # Construire l'expression de filtre
        # Gerer les cas ou le numero peut avoir des zeros devant
        expr = f'"{numero_field}" = \'{numero}\' OR "{numero_field}" = \'{numero.lstrip("0")}\' OR "{numero_field}" LIKE \'%{numero}\''

        request = QgsFeatureRequest().setFilterExpression(expr)

        for feature in parcelle_layer.getFeatures(request):
            geom = feature.geometry()
            if geom and not geom.isEmpty():
                results[numero] = geom
                break

    return results


def get_parcel_corners(geometry: QgsGeometry) -> List[Tuple[float, float]]:
    """
    Extrait les coins significatifs d'une geometrie de parcelle
    Retourne les 4 coins de la bounding box + le centroide
    """
    if geometry.isEmpty():
        return []

    bbox = geometry.boundingBox()
    centroid = geometry.centroid().asPoint()

    corners = [
        (bbox.xMinimum(), bbox.yMaximum()),  # Haut-gauche
        (bbox.xMaximum(), bbox.yMaximum()),  # Haut-droit
        (bbox.xMaximum(), bbox.yMinimum()),  # Bas-droit
        (bbox.xMinimum(), bbox.yMinimum()),  # Bas-gauche
        (centroid.x(), centroid.y())         # Centre
    ]

    return corners


def auto_match_gcps(image_path: str,
                    parcelle_layer: QgsVectorLayer = None,
                    min_confidence: float = 60.0,
                    use_centroids: bool = True) -> List[MatchedGCP]:
    """
    Fonction principale : detecte automatiquement les GCPs

    Args:
        image_path: Chemin vers l'image du plan
        parcelle_layer: Couche de parcelles BDCO
        min_confidence: Seuil de confiance OCR
        use_centroids: Si True, utilise les centroides. Si False, utilise les coins.

    Returns:
        Liste des GCPs matches
    """
    # 1. Detecter les numeros de parcelles dans l'image
    detected = detect_parcel_numbers(image_path, min_confidence)

    if not detected:
        return []

    # 2. Trouver ces parcelles dans la BDCO
    parcel_numbers = [p.numero for p in detected]
    bdco_parcels = find_parcels_in_bdco(parcel_numbers, parcelle_layer)

    # 3. Creer les GCPs
    gcps = []

    for detection in detected:
        if detection.numero in bdco_parcels:
            geom = bdco_parcels[detection.numero]

            if use_centroids:
                # Utiliser le centroide
                centroid = geom.centroid().asPoint()
                map_point = (centroid.x(), centroid.y())
            else:
                # Utiliser le premier coin (haut-gauche de la bbox)
                corners = get_parcel_corners(geom)
                map_point = corners[0] if corners else None

            if map_point:
                gcps.append(MatchedGCP(
                    parcel_number=detection.numero,
                    image_point=detection.center_image,
                    map_point=map_point,
                    confidence=detection.confidence
                ))

    return gcps


def detect_frame_coordinates(image_path: str) -> Optional[List[Tuple[Tuple[float, float], Tuple[float, float]]]]:
    """
    Tente de detecter les coordonnees inscrites sur le cadre du plan
    (pour les plans avec coordonnees MN95 aux coins)

    Returns:
        Liste de tuples ((img_x, img_y), (map_x, map_y)) ou None
    """
    if not TESSERACT_AVAILABLE or not CV2_AVAILABLE:
        return None

    img = cv2.imread(image_path)
    if img is None:
        return None

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Zones a scanner (bords de l'image)
    margin = int(min(w, h) * 0.15)  # 15% des bords

    zones = {
        'top': gray[0:margin, :],
        'bottom': gray[h-margin:h, :],
        'left': gray[:, 0:margin],
        'right': gray[:, w-margin:w]
    }

    # Pattern pour coordonnees MN95 (format: 2'533'xxx ou 1'152'xxx)
    coord_pattern = r"[12]['\s]?\d{3}['\s]?\d{3}"

    found_coords = []

    for zone_name, zone_img in zones.items():
        # OCR sur la zone
        text = pytesseract.image_to_string(zone_img, config='--psm 6')

        # Chercher les coordonnees
        matches = re.findall(coord_pattern, text)

        for match in matches:
            # Nettoyer et convertir
            clean = match.replace("'", "").replace(" ", "")
            try:
                coord = float(clean)
                # Verifier si c'est une coordonnee MN95 plausible
                if 2400000 < coord < 2900000:  # E (X)
                    found_coords.append(('E', coord, zone_name))
                elif 1000000 < coord < 1400000:  # N (Y)
                    found_coords.append(('N', coord, zone_name))
            except ValueError:
                continue

    # Si on a trouve au moins 2 E et 2 N, on peut tenter le calage
    e_coords = [c for c in found_coords if c[0] == 'E']
    n_coords = [c for c in found_coords if c[0] == 'N']

    if len(e_coords) >= 2 and len(n_coords) >= 2:
        # Retourner les coins detectes
        # (implementation simplifiee - a ameliorer selon les cas)
        return found_coords

    return None


# =============================================================================
# CLASSE POUR INTERFACE SIMPLIFIEE
# =============================================================================

class AutoGeoref:
    """Classe facade pour le georeferencement automatique"""

    def __init__(self, image_path: str):
        self.image_path = image_path
        self.detected_parcels: List[DetectedParcel] = []
        self.matched_gcps: List[MatchedGCP] = []
        self.status = "initialized"
        self.error = None

    def check_requirements(self) -> Tuple[bool, str]:
        """Verifie si les dependances sont disponibles"""
        deps = check_dependencies()

        missing = []
        if not deps['opencv']:
            missing.append("opencv-python (pip install opencv-python)")
        if not deps['tesseract']:
            missing.append("pytesseract (pip install pytesseract) + Tesseract-OCR")

        if missing:
            return False, "Dependances manquantes:\n- " + "\n- ".join(missing)

        return True, "OK"

    def detect(self, min_confidence: float = 60.0) -> int:
        """
        Detecte les numeros de parcelles dans l'image

        Returns:
            Nombre de parcelles detectees
        """
        try:
            self.detected_parcels = detect_parcel_numbers(self.image_path, min_confidence)
            self.status = "detected"
            return len(self.detected_parcels)
        except Exception as e:
            self.error = str(e)
            self.status = "error"
            return 0

    def match(self, parcelle_layer: QgsVectorLayer = None) -> int:
        """
        Matche les parcelles detectees avec la BDCO

        Returns:
            Nombre de GCPs matches
        """
        if not self.detected_parcels:
            return 0

        try:
            self.matched_gcps = auto_match_gcps(
                self.image_path,
                parcelle_layer,
                use_centroids=True
            )
            self.status = "matched"
            return len(self.matched_gcps)
        except Exception as e:
            self.error = str(e)
            self.status = "error"
            return 0

    def get_gcps_for_helmert(self) -> Tuple[List[Tuple[float, float]], List[Tuple[float, float]]]:
        """
        Retourne les GCPs au format attendu par HelmertTransform

        Returns:
            (source_points, target_points)
        """
        src = [gcp.image_point for gcp in self.matched_gcps]
        tgt = [gcp.map_point for gcp in self.matched_gcps]
        return src, tgt


if __name__ == "__main__":
    print("Module de georeferencement automatique")
    print("=" * 40)
    deps = check_dependencies()
    print(f"OpenCV disponible: {deps['opencv']}")
    print(f"Tesseract disponible: {deps['tesseract']}")
