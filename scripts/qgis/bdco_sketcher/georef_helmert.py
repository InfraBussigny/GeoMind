# -*- coding: utf-8 -*-
"""
Module de georeferencement par transformation de Helmert 2D
Transformation a 4 parametres: 2 translations, 1 rotation, 1 echelle

Auteur: Marc Zermatten / GeoBrain
"""

import numpy as np
from typing import List, Tuple, Optional
import math


class HelmertTransform:
    """
    Transformation de Helmert 2D (similarite conforme)

    X' = tx + s * (X * cos(theta) - Y * sin(theta))
    Y' = ty + s * (X * sin(theta) + Y * cos(theta))

    Parametres:
    - tx, ty: translations
    - theta: rotation (radians)
    - s: facteur d'echelle
    """

    def __init__(self):
        self.tx = 0.0
        self.ty = 0.0
        self.theta = 0.0
        self.scale = 1.0
        self.rmse = None
        self.residuals = None

    def compute_from_gcps(self,
                          source_points: List[Tuple[float, float]],
                          target_points: List[Tuple[float, float]]) -> bool:
        """
        Calcule les parametres de transformation depuis des points de calage (GCPs)

        Args:
            source_points: Points dans le systeme source (image pixels ou coords locales)
            target_points: Points dans le systeme cible (coordonnees MN95)

        Returns:
            True si le calcul a reussi, False sinon
        """
        n = len(source_points)

        if n < 2:
            raise ValueError("Minimum 2 points de calage requis pour Helmert")

        if n != len(target_points):
            raise ValueError("Nombre de points source et cible different")

        # Convertir en arrays numpy
        src = np.array(source_points)
        tgt = np.array(target_points)

        # Methode des moindres carres pour Helmert 2D
        # On resout le systeme surdetermine A * p = b
        # avec p = [a, b, tx, ty] ou:
        # a = s * cos(theta)
        # b = s * sin(theta)

        A = np.zeros((2 * n, 4))
        b = np.zeros(2 * n)

        for i in range(n):
            x, y = src[i]
            X, Y = tgt[i]

            # Equations pour X'
            A[2*i, 0] = x      # coefficient de a
            A[2*i, 1] = -y     # coefficient de b
            A[2*i, 2] = 1      # coefficient de tx
            A[2*i, 3] = 0      # coefficient de ty
            b[2*i] = X

            # Equations pour Y'
            A[2*i+1, 0] = y    # coefficient de a
            A[2*i+1, 1] = x    # coefficient de b
            A[2*i+1, 2] = 0    # coefficient de tx
            A[2*i+1, 3] = 1    # coefficient de ty
            b[2*i+1] = Y

        # Resolution par moindres carres (pseudo-inverse)
        try:
            params, residuals_sum, rank, singular = np.linalg.lstsq(A, b, rcond=None)
        except np.linalg.LinAlgError:
            return False

        a, b_param, self.tx, self.ty = params

        # Extraire echelle et rotation
        self.scale = math.sqrt(a**2 + b_param**2)
        self.theta = math.atan2(b_param, a)

        # Calculer les residus et RMSE
        self._compute_residuals(src, tgt)

        return True

    def _compute_residuals(self, src: np.ndarray, tgt: np.ndarray):
        """Calcule les residus et RMSE"""
        n = len(src)
        transformed = np.array([self.transform_point(p[0], p[1]) for p in src])

        diff = transformed - tgt
        self.residuals = np.sqrt(np.sum(diff**2, axis=1))
        self.rmse = math.sqrt(np.mean(self.residuals**2))

    def transform_point(self, x: float, y: float) -> Tuple[float, float]:
        """
        Transforme un point du systeme source vers le systeme cible

        Args:
            x, y: Coordonnees dans le systeme source

        Returns:
            (X, Y): Coordonnees transformees
        """
        cos_t = math.cos(self.theta)
        sin_t = math.sin(self.theta)

        X = self.tx + self.scale * (x * cos_t - y * sin_t)
        Y = self.ty + self.scale * (x * sin_t + y * cos_t)

        return (X, Y)

    def inverse_transform_point(self, X: float, Y: float) -> Tuple[float, float]:
        """
        Transformation inverse: du systeme cible vers le systeme source

        Args:
            X, Y: Coordonnees dans le systeme cible (MN95)

        Returns:
            (x, y): Coordonnees dans le systeme source
        """
        cos_t = math.cos(self.theta)
        sin_t = math.sin(self.theta)

        # Inverse de la transformation
        dx = X - self.tx
        dy = Y - self.ty

        x = (dx * cos_t + dy * sin_t) / self.scale
        y = (-dx * sin_t + dy * cos_t) / self.scale

        return (x, y)

    def get_parameters(self) -> dict:
        """Retourne les parametres de transformation"""
        return {
            'tx': self.tx,
            'ty': self.ty,
            'rotation_rad': self.theta,
            'rotation_deg': math.degrees(self.theta),
            'scale': self.scale,
            'rmse': self.rmse
        }

    def get_affine_matrix(self) -> np.ndarray:
        """
        Retourne la matrice affine 3x3 pour GDAL/rasterio

        [a  b  tx]   [s*cos  -s*sin  tx]
        [c  d  ty] = [s*sin   s*cos  ty]
        [0  0  1 ]   [0       0      1 ]
        """
        cos_t = math.cos(self.theta)
        sin_t = math.sin(self.theta)

        return np.array([
            [self.scale * cos_t, -self.scale * sin_t, self.tx],
            [self.scale * sin_t,  self.scale * cos_t, self.ty],
            [0, 0, 1]
        ])

    def get_gdal_geotransform(self,
                               origin_x: float = 0,
                               origin_y: float = 0,
                               pixel_width: float = 1,
                               pixel_height: float = 1) -> Tuple[float, ...]:
        """
        Retourne le GeoTransform au format GDAL

        Pour une image avec origine (0,0) en haut-gauche:
        GT[0] = x coordinate of upper-left corner
        GT[1] = pixel width (positive = east)
        GT[2] = rotation (0 if image is north-up)
        GT[3] = y coordinate of upper-left corner
        GT[4] = rotation (0 if image is north-up)
        GT[5] = pixel height (negative = north)
        """
        cos_t = math.cos(self.theta)
        sin_t = math.sin(self.theta)

        # Coordonnees du coin superieur gauche apres transformation
        corner_x, corner_y = self.transform_point(origin_x, origin_y)

        # Taille des pixels apres mise a l'echelle
        scaled_pixel_w = pixel_width * self.scale
        scaled_pixel_h = pixel_height * self.scale

        return (
            corner_x,                           # GT[0]
            scaled_pixel_w * cos_t,             # GT[1]
            scaled_pixel_w * sin_t,             # GT[2]
            corner_y,                           # GT[3]
            scaled_pixel_h * sin_t,             # GT[4]
            -scaled_pixel_h * cos_t             # GT[5] negatif car Y vers le bas
        )


def compute_helmert_from_corners(
    image_corners: List[Tuple[float, float]],
    map_corners: List[Tuple[float, float]]
) -> HelmertTransform:
    """
    Calcule la transformation depuis les 4 coins d'un plan

    Args:
        image_corners: Coins de l'image [haut-gauche, haut-droit, bas-droit, bas-gauche]
        map_corners: Coins correspondants en coordonnees carte

    Returns:
        HelmertTransform configure
    """
    transform = HelmertTransform()
    transform.compute_from_gcps(image_corners, map_corners)
    return transform


def estimate_quality(rmse: float, scale: float) -> str:
    """
    Estime la qualite du calage

    Args:
        rmse: Erreur quadratique moyenne en unites cible
        scale: Facteur d'echelle (pixels -> metres)

    Returns:
        Message de qualite
    """
    # RMSE en metres terrain
    rmse_m = rmse

    if rmse_m < 0.05:
        return "Excellent (< 5 cm)"
    elif rmse_m < 0.10:
        return "Tres bon (< 10 cm)"
    elif rmse_m < 0.25:
        return "Bon (< 25 cm)"
    elif rmse_m < 0.50:
        return "Acceptable (< 50 cm)"
    else:
        return f"Mediocre ({rmse_m:.2f} m) - Verifier les points"


if __name__ == "__main__":
    # Test de la transformation
    print("Test transformation Helmert 2D")
    print("=" * 40)

    # Points de test (simulation)
    # Source: pixels image (origine haut-gauche)
    src_pts = [
        (100, 100),
        (900, 100),
        (900, 700),
        (100, 700)
    ]

    # Cible: coordonnees MN95 (metres)
    tgt_pts = [
        (2533500, 1152500),
        (2533700, 1152500),
        (2533700, 1152350),
        (2533500, 1152350)
    ]

    transform = HelmertTransform()
    success = transform.compute_from_gcps(src_pts, tgt_pts)

    if success:
        params = transform.get_parameters()
        print(f"Translation X: {params['tx']:.2f} m")
        print(f"Translation Y: {params['ty']:.2f} m")
        print(f"Rotation: {params['rotation_deg']:.4f} deg")
        print(f"Echelle: {params['scale']:.6f}")
        print(f"RMSE: {params['rmse']:.4f} m")
        print(f"Qualite: {estimate_quality(params['rmse'], params['scale'])}")

        print("\nVerification des points:")
        for i, (src, tgt) in enumerate(zip(src_pts, tgt_pts)):
            result = transform.transform_point(*src)
            print(f"  Point {i+1}: {src} -> {result} (attendu: {tgt})")
