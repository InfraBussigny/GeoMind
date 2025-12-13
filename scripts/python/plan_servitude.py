#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Plan Cadastral - Servitude
Générateur de plans de servitude au format Bussigny

Inspiré des plans de Bovard & Fritsché SA
Adapté pour la Commune de Bussigny

Usage:
    python plan_servitude.py --parcelle 1234 --type "Canalisation EU" --output plan.pdf

    Ou en mode interactif dans QGIS (PyQGIS)

Auteur: Marc Zermatten / GeoMind
Date: Décembre 2025
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# Configuration par défaut
CONFIG = {
    'commune': 'BUSSIGNY',
    'service': 'Service des Infrastructures',
    'responsable': 'Marc Zermatten, Responsable SIT',
    'adresse': 'Chemin de Budron A 2, 1052 Le Mont-sur-Lausanne',
    'email': 'sit@bussigny.ch',
    'copyright': 'Géodonnée © Etat de Vaud',

    # Chemins ressources
    'logo_path': Path('M:/7-Infra/0-Gest/2-Mod/7024_Logos/logo_bussigny_pos.png'),
    'templates_path': Path('M:/7-Infra/0-Gest/3-Geoportail/7032_DAO_SIG/70321_QGIS/703215_Mise en page'),
    'output_path': Path('M:/7-Infra/0-Gest/3-Geoportail/7032_DAO_SIG/70324_Plans_Servitude'),

    # Format
    'page_size': 'A3',  # A3 ou A4
    'orientation': 'landscape',  # landscape ou portrait
    'echelle_defaut': '1:500',
    'dpi': 300,
}

# Types de servitudes et leurs couleurs
TYPES_SERVITUDES = {
    'eau_pression': {
        'nom': 'Canalisation d\'eaux sous pression',
        'couleur': '#00AA00',  # Vert
        'couleur_rgb': (0, 170, 0),
        'epaisseur': 2.0
    },
    'eau_usee': {
        'nom': 'Conduite de refoulement d\'eaux usées',
        'couleur': '#FF0000',  # Rouge
        'couleur_rgb': (255, 0, 0),
        'epaisseur': 2.0
    },
    'electricite': {
        'nom': 'Canalisations d\'électricité',
        'couleur': '#9966FF',  # Violet
        'couleur_rgb': (153, 102, 255),
        'epaisseur': 2.0
    },
    'gaz': {
        'nom': 'Conduite de gaz',
        'couleur': '#FFCC00',  # Jaune
        'couleur_rgb': (255, 204, 0),
        'epaisseur': 2.0
    },
    'passage_pied': {
        'nom': 'Passage public à pied',
        'couleur': '#FF8800',  # Orange
        'couleur_rgb': (255, 136, 0),
        'epaisseur': 3.0
    },
    'passage_vehicule': {
        'nom': 'Droit de passage (véhicules)',
        'couleur': '#CC6600',  # Orange foncé
        'couleur_rgb': (204, 102, 0),
        'epaisseur': 4.0
    },
    'autre': {
        'nom': 'Servitude',
        'couleur': '#666666',  # Gris
        'couleur_rgb': (102, 102, 102),
        'epaisseur': 2.0
    }
}


class PlanServitude:
    """Classe principale pour générer un plan de servitude"""

    def __init__(self,
                 parcelles: list[str],
                 type_servitude: str,
                 plan_cadastral: str = None,
                 echelle: str = None,
                 coord_centre: tuple = None,
                 dossier_ref: str = None,
                 nrf: str = None):
        """
        Initialise un nouveau plan de servitude

        Args:
            parcelles: Liste des numéros de parcelles concernées
            type_servitude: Type de servitude (clé de TYPES_SERVITUDES)
            plan_cadastral: Numéro(s) du plan cadastral
            echelle: Échelle du plan (ex: "1:500")
            coord_centre: Coordonnées du centre (E, N)
            dossier_ref: Référence du dossier technique
            nrf: Numéro au Registre Foncier
        """
        self.parcelles = parcelles
        self.type_servitude = type_servitude
        self.plan_cadastral = plan_cadastral
        self.echelle = echelle or CONFIG['echelle_defaut']
        self.coord_centre = coord_centre
        self.dossier_ref = dossier_ref
        self.nrf = nrf
        self.date = datetime.now()

        # Récupérer les infos du type de servitude
        self.servitude_info = TYPES_SERVITUDES.get(
            type_servitude,
            TYPES_SERVITUDES['autre']
        )

    def get_titre(self) -> str:
        """Retourne le titre du plan"""
        return "PLAN CADASTRAL - SERVITUDE"

    def get_sous_titre(self) -> str:
        """Retourne le sous-titre (type de servitude)"""
        return self.servitude_info['nom']

    def get_commune(self) -> str:
        """Retourne le nom de la commune formaté"""
        return f"COMMUNE DE {CONFIG['commune']}"

    def get_date_formatee(self) -> str:
        """Retourne la date formatée"""
        mois = [
            'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
            'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
        ]
        return f"Bussigny, le {self.date.day} {mois[self.date.month-1]} {self.date.year}"

    def get_coordonnees_formatees(self) -> str:
        """Retourne les coordonnées formatées"""
        if not self.coord_centre:
            return ""
        e, n = self.coord_centre
        return f"E : {e:,.0f}  N : {n:,.0f}".replace(',', "'")

    def generate_filename(self) -> str:
        """Génère un nom de fichier pour le plan"""
        parcelles_str = '_'.join(self.parcelles[:3])
        if len(self.parcelles) > 3:
            parcelles_str += '_etc'
        date_str = self.date.strftime('%Y%m%d')
        type_short = self.type_servitude.replace('_', '-')
        return f"SERV_{parcelles_str}_{type_short}_{date_str}.pdf"


# =============================================================================
# GÉNÉRATION PDF AVEC REPORTLAB (standalone, sans QGIS)
# =============================================================================

def generate_pdf_reportlab(plan: PlanServitude, output_path: str):
    """
    Génère un PDF simple avec reportlab (sans carte)
    Utile pour les documents annexes ou tests
    """
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A3, landscape
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
        from reportlab.lib.styles import getSampleStyleSheet
    except ImportError:
        print("Erreur: reportlab n'est pas installé")
        print("Installez-le avec: pip install reportlab")
        return False

    # Créer le canvas
    page_size = landscape(A3)
    c = canvas.Canvas(output_path, pagesize=page_size)
    width, height = page_size

    # Marges
    margin = 15 * mm

    # === EN-TÊTE ===

    # Titre principal
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin, height - 20*mm, plan.get_titre())

    # Ligne sous le titre
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.line(margin, height - 22*mm, margin + 200*mm, height - 22*mm)

    # N°RF (droite)
    c.setFont("Helvetica", 10)
    c.drawRightString(width - margin, height - 15*mm, "N°RF")
    c.rect(width - margin - 40*mm, height - 25*mm, 40*mm, 10*mm)
    if plan.nrf:
        c.drawCentredString(width - margin - 20*mm, height - 22*mm, plan.nrf)

    # Bloc gauche
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, height - 30*mm, plan.get_commune())
    c.setFont("Helvetica", 11)
    if plan.plan_cadastral:
        c.drawString(margin, height - 37*mm, f"Plan {plan.plan_cadastral}")
    c.drawString(margin, height - 44*mm, f"Echelle {plan.echelle}")

    # Bloc droite
    c.setFont("Helvetica", 11)
    c.drawRightString(width - margin - 50*mm, height - 30*mm, "Mensuration numérique")
    c.drawRightString(width - margin - 50*mm, height - 37*mm, "Coordonnées C.N.S.")
    if plan.coord_centre:
        c.drawRightString(width - margin - 50*mm, height - 44*mm, plan.get_coordonnees_formatees())

    # Encadré type de servitude
    servitude_y = height - 55*mm
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.rect(width/2 - 90*mm, servitude_y - 8*mm, 180*mm, 12*mm)

    # Ligne colorée de la servitude
    r, g, b = plan.servitude_info['couleur_rgb']
    c.setStrokeColor(colors.Color(r/255, g/255, b/255))
    c.setLineWidth(plan.servitude_info['epaisseur'])
    c.line(width/2 - 85*mm, servitude_y - 2*mm, width/2 - 70*mm, servitude_y - 2*mm)

    # Texte type de servitude
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 11)
    c.drawString(width/2 - 65*mm, servitude_y - 4*mm, plan.get_sous_titre())

    # === ZONE CARTE (placeholder) ===
    carte_top = servitude_y - 15*mm
    carte_bottom = 75*mm
    carte_height = carte_top - carte_bottom

    c.setStrokeColor(colors.black)
    c.setLineWidth(0.3)
    c.rect(margin, carte_bottom, width - 2*margin, carte_height)

    # Texte placeholder
    c.setFont("Helvetica-Oblique", 14)
    c.setFillColor(colors.grey)
    c.drawCentredString(width/2, carte_bottom + carte_height/2,
                        "[Zone carte - À générer avec QGIS]")

    # === PIED DE PAGE ===

    # Date et copyright
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    c.drawString(margin, 60*mm, plan.get_date_formatee())
    c.setFont("Helvetica-Oblique", 9)
    c.setFillColor(colors.grey)
    c.drawString(margin, 55*mm, f'"{CONFIG["copyright"]}"')

    # Responsable
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    c.drawCentredString(width/2, 60*mm, CONFIG['responsable'])

    # === CARTOUCHE ===
    cartouche_height = 25*mm
    cartouche_y = margin

    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.rect(margin, cartouche_y, width - 2*margin, cartouche_height)

    # Séparateurs
    sep1 = margin + 70*mm
    sep2 = margin + 250*mm
    sep3 = margin + 320*mm
    c.line(sep1, cartouche_y, sep1, cartouche_y + cartouche_height)
    c.line(sep2, cartouche_y, sep2, cartouche_y + cartouche_height)
    c.line(sep3, cartouche_y, sep3, cartouche_y + cartouche_height)

    # Logo (placeholder)
    logo_path = CONFIG['logo_path']
    if logo_path.exists():
        try:
            c.drawImage(str(logo_path), margin + 5*mm, cartouche_y + 3*mm,
                       width=55*mm, height=19*mm, preserveAspectRatio=True)
        except:
            pass

    # Bloc commune
    c.setFillColor(colors.Color(54/255, 96/255, 146/255))  # Bleu Bussigny
    c.setFont("Helvetica-Bold", 11)
    c.drawString(sep1 + 5*mm, cartouche_y + 18*mm, "Commune de Bussigny")
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 9)
    c.drawString(sep1 + 5*mm, cartouche_y + 12*mm, CONFIG['service'])
    c.setFont("Helvetica-Oblique", 9)
    c.setFillColor(colors.grey)
    c.drawString(sep1 + 5*mm, cartouche_y + 6*mm, "Système d'Information du Territoire")
    c.setFont("Helvetica", 8)
    c.drawString(sep1 + 5*mm, cartouche_y + 1*mm, CONFIG['adresse'])

    # Bloc dossier
    c.setFillColor(colors.grey)
    c.setFont("Helvetica", 8)
    c.drawString(sep2 + 5*mm, cartouche_y + 18*mm, "Dossier technique :")
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    if plan.dossier_ref:
        c.drawString(sep2 + 5*mm, cartouche_y + 10*mm, plan.dossier_ref)

    # Bloc fichier
    c.setFillColor(colors.grey)
    c.setFont("Helvetica", 8)
    c.drawString(sep3 + 5*mm, cartouche_y + 18*mm, "Fichier :")
    c.setFont("Helvetica", 7)
    c.drawString(sep3 + 5*mm, cartouche_y + 10*mm, output_path)

    # Sauvegarder
    c.save()
    print(f"PDF généré: {output_path}")
    return True


# =============================================================================
# GÉNÉRATION AVEC PyQGIS (dans QGIS)
# =============================================================================

def generate_qgis_layout(plan: PlanServitude, project_path: str = None):
    """
    Génère un plan de servitude en utilisant QGIS
    À exécuter dans la console Python de QGIS ou via PyQGIS

    Args:
        plan: Instance de PlanServitude
        project_path: Chemin vers le projet QGIS (optionnel)
    """
    try:
        from qgis.core import (
            QgsProject, QgsLayout, QgsLayoutItemMap, QgsLayoutItemLabel,
            QgsLayoutItemPicture, QgsLayoutItemScaleBar, QgsLayoutItemShape,
            QgsLayoutPoint, QgsLayoutSize, QgsUnitTypes,
            QgsLayoutExporter, QgsRectangle
        )
        from qgis.PyQt.QtCore import QRectF
    except ImportError:
        print("Erreur: Ce script doit être exécuté dans QGIS (PyQGIS)")
        return None

    project = QgsProject.instance()

    # Charger le projet si spécifié
    if project_path and Path(project_path).exists():
        project.read(project_path)

    # Créer une nouvelle mise en page
    layout_name = f"Servitude_{plan.parcelles[0]}_{plan.date.strftime('%Y%m%d')}"
    manager = project.layoutManager()

    # Supprimer si existe déjà
    existing = manager.layoutByName(layout_name)
    if existing:
        manager.removeLayout(existing)

    layout = QgsLayout(project)
    layout.initializeDefaults()
    layout.setName(layout_name)

    # Configurer la page (A3 paysage)
    page = layout.pageCollection().page(0)
    page.setPageSize(QgsLayoutSize(420, 297, QgsUnitTypes.LayoutMillimeters))

    # === Ajouter les éléments ===

    # Titre
    title = QgsLayoutItemLabel(layout)
    title.setText(plan.get_titre())
    title.setFont(QFont("Arial", 14, QFont.Bold))
    title.attemptMove(QgsLayoutPoint(10, 8, QgsUnitTypes.LayoutMillimeters))
    title.attemptResize(QgsLayoutSize(200, 12, QgsUnitTypes.LayoutMillimeters))
    layout.addLayoutItem(title)

    # Commune
    commune = QgsLayoutItemLabel(layout)
    commune.setText(plan.get_commune())
    commune.setFont(QFont("Arial", 11, QFont.Bold))
    commune.attemptMove(QgsLayoutPoint(10, 22, QgsUnitTypes.LayoutMillimeters))
    layout.addLayoutItem(commune)

    # Type de servitude (encadré)
    servitude_label = QgsLayoutItemLabel(layout)
    servitude_label.setText(plan.get_sous_titre())
    servitude_label.attemptMove(QgsLayoutPoint(140, 43, QgsUnitTypes.LayoutMillimeters))
    layout.addLayoutItem(servitude_label)

    # Carte
    map_item = QgsLayoutItemMap(layout)
    map_item.attemptMove(QgsLayoutPoint(10, 55, QgsUnitTypes.LayoutMillimeters))
    map_item.attemptResize(QgsLayoutSize(400, 195, QgsUnitTypes.LayoutMillimeters))
    map_item.setFrameEnabled(True)
    layout.addLayoutItem(map_item)

    # Centrer sur les coordonnées si fournies
    if plan.coord_centre:
        e, n = plan.coord_centre
        # Calculer l'étendue selon l'échelle
        echelle_num = int(plan.echelle.split(':')[1])
        # Approximation: étendue en mètres
        extent_width = echelle_num * 0.4  # 400mm de carte
        extent_height = echelle_num * 0.195  # 195mm de carte
        extent = QgsRectangle(
            e - extent_width/2, n - extent_height/2,
            e + extent_width/2, n + extent_height/2
        )
        map_item.setExtent(extent)

    # Échelle
    scalebar = QgsLayoutItemScaleBar(layout)
    scalebar.setLinkedMap(map_item)
    scalebar.setStyle('Single Box')
    scalebar.setUnits(QgsUnitTypes.DistanceMeters)
    scalebar.setNumberOfSegments(4)
    scalebar.setUnitsPerSegment(50)
    scalebar.attemptMove(QgsLayoutPoint(10, 252, QgsUnitTypes.LayoutMillimeters))
    layout.addLayoutItem(scalebar)

    # Logo
    logo = QgsLayoutItemPicture(layout)
    logo.setPicturePath(str(CONFIG['logo_path']))
    logo.attemptMove(QgsLayoutPoint(12, 267, QgsUnitTypes.LayoutMillimeters))
    logo.attemptResize(QgsLayoutSize(55, 18, QgsUnitTypes.LayoutMillimeters))
    layout.addLayoutItem(logo)

    # Date
    date_label = QgsLayoutItemLabel(layout)
    date_label.setText(plan.get_date_formatee())
    date_label.attemptMove(QgsLayoutPoint(10, 252, QgsUnitTypes.LayoutMillimeters))
    layout.addLayoutItem(date_label)

    # Copyright
    copyright_label = QgsLayoutItemLabel(layout)
    copyright_label.setText(f'"{CONFIG["copyright"]}"')
    copyright_label.attemptMove(QgsLayoutPoint(10, 258, QgsUnitTypes.LayoutMillimeters))
    layout.addLayoutItem(copyright_label)

    # Ajouter au gestionnaire
    manager.addLayout(layout)

    print(f"Mise en page '{layout_name}' créée dans QGIS")
    return layout


def export_layout_to_pdf(layout, output_path: str):
    """Exporte une mise en page QGIS vers PDF"""
    try:
        from qgis.core import QgsLayoutExporter
    except ImportError:
        print("Erreur: PyQGIS non disponible")
        return False

    exporter = QgsLayoutExporter(layout)
    settings = QgsLayoutExporter.PdfExportSettings()
    settings.dpi = CONFIG['dpi']

    result = exporter.exportToPdf(output_path, settings)

    if result == QgsLayoutExporter.Success:
        print(f"PDF exporté: {output_path}")
        return True
    else:
        print(f"Erreur lors de l'export: {result}")
        return False


# =============================================================================
# CLI
# =============================================================================

def main():
    """Point d'entrée principal"""
    import argparse

    parser = argparse.ArgumentParser(
        description='Générateur de plans de servitude - Commune de Bussigny'
    )
    parser.add_argument('--parcelle', '-p', nargs='+', required=True,
                        help='Numéro(s) de parcelle')
    parser.add_argument('--type', '-t', default='autre',
                        choices=list(TYPES_SERVITUDES.keys()),
                        help='Type de servitude')
    parser.add_argument('--plan', help='Numéro du plan cadastral')
    parser.add_argument('--echelle', default='1:500', help='Échelle du plan')
    parser.add_argument('--coord-e', type=float, help='Coordonnée Est du centre')
    parser.add_argument('--coord-n', type=float, help='Coordonnée Nord du centre')
    parser.add_argument('--dossier', help='Référence du dossier')
    parser.add_argument('--nrf', help='Numéro RF')
    parser.add_argument('--output', '-o', help='Chemin du fichier PDF de sortie')
    parser.add_argument('--mode', choices=['reportlab', 'qgis'], default='reportlab',
                        help='Mode de génération (reportlab=standalone, qgis=avec carte)')

    args = parser.parse_args()

    # Créer le plan
    coord = None
    if args.coord_e and args.coord_n:
        coord = (args.coord_e, args.coord_n)

    plan = PlanServitude(
        parcelles=args.parcelle,
        type_servitude=args.type,
        plan_cadastral=args.plan,
        echelle=args.echelle,
        coord_centre=coord,
        dossier_ref=args.dossier,
        nrf=args.nrf
    )

    # Chemin de sortie
    output_path = args.output or str(CONFIG['output_path'] / plan.generate_filename())

    # S'assurer que le dossier existe
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    # Générer
    if args.mode == 'reportlab':
        generate_pdf_reportlab(plan, output_path)
    else:
        print("Mode QGIS: lancez ce script dans la console Python de QGIS")
        print("Ou utilisez: from plan_servitude import PlanServitude, generate_qgis_layout")

    print(f"\nTypes de servitudes disponibles:")
    for key, info in TYPES_SERVITUDES.items():
        print(f"  {key}: {info['nom']}")


if __name__ == '__main__':
    main()
