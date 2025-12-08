# -*- coding: utf-8 -*-
from .stats_assainissement_bussigny import StatsAssainissementBussignyPlugin

def classFactory(iface):
    """Point d'entrée du plugin pour QGIS."""
    return StatsAssainissementBussignyPlugin(iface)
