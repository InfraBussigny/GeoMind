# -*- coding: utf-8 -*-
"""
Lord Z Almighty - Le Seigneur Z pointe sur vos parcelles
"""

def classFactory(iface):
    from .lord_z_almighty import LordZAlmighty
    return LordZAlmighty(iface)
