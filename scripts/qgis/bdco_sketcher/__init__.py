# -*- coding: utf-8 -*-
"""
BDCO Sketcher - Plugin QGIS pour styliser les couches BDCO
et creer des plans de servitudes

Auteur: Marc Zermatten / GeoBrain
"""

def classFactory(iface):
    from .bdco_sketcher import BDCOSketcher
    return BDCOSketcher(iface)
