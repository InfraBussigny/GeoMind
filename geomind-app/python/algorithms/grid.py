"""
Grid algorithm - Generate regular grids (rectangular, hexagonal)
"""

from typing import Any, Dict, Optional
from shapely.geometry import shape, mapping, box, Polygon
from shapely.ops import unary_union
import math


def run(input_geojson: Optional[Dict], params: Dict[str, Any]) -> Dict:
    """
    Generate a regular grid within a bounding area

    Params:
        extent: Bounding box as [minx, miny, maxx, maxy] (required if no input)
        cell_size: Size of each grid cell (required)
        grid_type: Type of grid - 'rectangle', 'square', 'hexagon' (default: 'square')
        clip: Whether to clip grid to input geometry (default: False)

    Returns:
        GeoJSON FeatureCollection with grid cells
    """
    cell_size = params.get('cell_size')
    if cell_size is None:
        raise ValueError("Parameter 'cell_size' is required")

    cell_size = float(cell_size)
    grid_type = params.get('grid_type', 'square')
    clip = params.get('clip', False)

    # Get extent
    extent = params.get('extent')
    clip_geom = None

    if input_geojson:
        features = input_geojson.get('features', [])
        if features:
            geoms = [shape(f['geometry']) for f in features]
            clip_geom = unary_union(geoms)
            bounds = clip_geom.bounds
            extent = list(bounds)
        else:
            geom = shape(input_geojson)
            clip_geom = geom
            extent = list(geom.bounds)

    if not extent:
        raise ValueError("Either extent parameter or input geometry required")

    minx, miny, maxx, maxy = extent

    # Generate grid
    if grid_type in ('rectangle', 'square'):
        cells = generate_rectangular_grid(minx, miny, maxx, maxy, cell_size, cell_size)
    elif grid_type == 'hexagon':
        cells = generate_hexagonal_grid(minx, miny, maxx, maxy, cell_size)
    else:
        raise ValueError(f"Unknown grid type: {grid_type}")

    # Clip to input geometry if requested
    result_features = []
    for i, cell in enumerate(cells):
        if clip and clip_geom:
            if not cell.intersects(clip_geom):
                continue
            clipped = cell.intersection(clip_geom)
            if clipped.is_empty:
                continue
            cell = clipped

        result_features.append({
            'type': 'Feature',
            'properties': {
                'cell_id': i,
                'cell_area': round(cell.area, 2)
            },
            'geometry': mapping(cell)
        })

    return {
        'type': 'FeatureCollection',
        'features': result_features,
        'metadata': {
            'grid_type': grid_type,
            'cell_size': cell_size,
            'total_cells': len(result_features)
        }
    }


def generate_rectangular_grid(minx, miny, maxx, maxy, width, height):
    """Generate rectangular grid cells"""
    cells = []
    x = minx
    while x < maxx:
        y = miny
        while y < maxy:
            cell = box(x, y, min(x + width, maxx), min(y + height, maxy))
            cells.append(cell)
            y += height
        x += width
    return cells


def generate_hexagonal_grid(minx, miny, maxx, maxy, size):
    """Generate hexagonal grid cells"""
    cells = []

    # Hexagon dimensions
    w = size * 2
    h = math.sqrt(3) * size

    # Grid offsets
    col_step = w * 0.75
    row_step = h

    col = 0
    x = minx
    while x < maxx + w:
        row = 0
        y_offset = (h / 2) if (col % 2 == 1) else 0
        y = miny + y_offset

        while y < maxy + h:
            hex_cell = create_hexagon(x, y, size)
            cells.append(hex_cell)
            y += row_step
            row += 1

        x += col_step
        col += 1

    return cells


def create_hexagon(cx, cy, size):
    """Create a hexagon centered at (cx, cy)"""
    angles = [math.radians(60 * i + 30) for i in range(6)]
    points = [(cx + size * math.cos(a), cy + size * math.sin(a)) for a in angles]
    return Polygon(points)
