"""
QGlS Algorithms - Geoprocessing algorithms using Shapely and optionally PyQGIS

This package provides various spatial analysis algorithms that can be called
from Node.js via the qgls_processor.py script.
"""

from . import buffer
from . import dissolve
from . import simplify
from . import voronoi
from . import convex_hull
from . import centroid
from . import grid
from . import clip_raster

__all__ = [
    'buffer',
    'dissolve',
    'simplify',
    'voronoi',
    'convex_hull',
    'centroid',
    'grid',
    'clip_raster'
]
