"""
Simplify algorithm - Reduce geometry complexity while preserving shape
"""

from typing import Any, Dict, Optional
from shapely.geometry import shape, mapping


def run(input_geojson: Optional[Dict], params: Dict[str, Any]) -> Dict:
    """
    Simplify geometries using Douglas-Peucker algorithm

    Params:
        tolerance: Simplification tolerance in map units (required)
        preserve_topology: Whether to preserve topology (default: True)

    Returns:
        GeoJSON FeatureCollection with simplified geometries
    """
    if not input_geojson:
        raise ValueError("Input GeoJSON required for simplify operation")

    tolerance = params.get('tolerance')
    if tolerance is None:
        raise ValueError("Parameter 'tolerance' is required")

    tolerance = float(tolerance)
    preserve_topology = params.get('preserve_topology', True)

    features = input_geojson.get('features', [])

    if not features:
        # Single geometry
        geom = shape(input_geojson)
        original_coords = count_coordinates(geom)
        simplified = geom.simplify(tolerance, preserve_topology=preserve_topology)
        new_coords = count_coordinates(simplified)

        return {
            'type': 'FeatureCollection',
            'features': [{
                'type': 'Feature',
                'properties': {
                    'tolerance': tolerance,
                    'original_vertices': original_coords,
                    'simplified_vertices': new_coords,
                    'reduction_percent': round((1 - new_coords / max(original_coords, 1)) * 100, 1)
                },
                'geometry': mapping(simplified)
            }]
        }

    # Process features
    result_features = []
    total_original = 0
    total_simplified = 0

    for feature in features:
        geom = shape(feature['geometry'])
        original_coords = count_coordinates(geom)
        simplified = geom.simplify(tolerance, preserve_topology=preserve_topology)
        new_coords = count_coordinates(simplified)

        total_original += original_coords
        total_simplified += new_coords

        props = feature.get('properties', {}).copy()
        props.update({
            'original_vertices': original_coords,
            'simplified_vertices': new_coords
        })

        result_features.append({
            'type': 'Feature',
            'properties': props,
            'geometry': mapping(simplified)
        })

    return {
        'type': 'FeatureCollection',
        'features': result_features,
        'metadata': {
            'tolerance': tolerance,
            'total_original_vertices': total_original,
            'total_simplified_vertices': total_simplified,
            'reduction_percent': round((1 - total_simplified / max(total_original, 1)) * 100, 1)
        }
    }


def count_coordinates(geom) -> int:
    """Count total coordinates in a geometry"""
    try:
        if hasattr(geom, 'exterior'):
            # Polygon
            count = len(geom.exterior.coords)
            for interior in geom.interiors:
                count += len(interior.coords)
            return count
        elif hasattr(geom, 'coords'):
            # LineString, LinearRing
            return len(geom.coords)
        elif hasattr(geom, 'geoms'):
            # Multi-geometry
            return sum(count_coordinates(g) for g in geom.geoms)
        else:
            # Point
            return 1
    except:
        return 0
