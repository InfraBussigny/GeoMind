"""
Buffer algorithm - Create buffer zones around geometries
"""

from typing import Any, Dict, Optional
from shapely import from_geojson, to_geojson
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
import json


def run(input_geojson: Optional[Dict], params: Dict[str, Any]) -> Dict:
    """
    Create buffer zones around input geometries

    Params:
        distance: Buffer distance in map units (required)
        segments: Number of segments for circular approximation (default: 16)
        cap_style: End cap style - 'round', 'flat', 'square' (default: 'round')
        join_style: Join style - 'round', 'mitre', 'bevel' (default: 'round')
        dissolve: Whether to dissolve overlapping buffers (default: False)

    Returns:
        GeoJSON FeatureCollection with buffered geometries
    """
    if not input_geojson:
        raise ValueError("Input GeoJSON required for buffer operation")

    distance = params.get('distance')
    if distance is None:
        raise ValueError("Parameter 'distance' is required")

    distance = float(distance)
    segments = int(params.get('segments', 16))
    cap_style = params.get('cap_style', 'round')
    join_style = params.get('join_style', 'round')
    dissolve = params.get('dissolve', False)

    # Map style names to Shapely constants
    cap_styles = {'round': 1, 'flat': 2, 'square': 3}
    join_styles = {'round': 1, 'mitre': 2, 'bevel': 3}

    cap = cap_styles.get(cap_style, 1)
    join = join_styles.get(join_style, 1)

    features = input_geojson.get('features', [])
    if not features:
        # Single geometry
        geom = shape(input_geojson)
        buffered = geom.buffer(distance, resolution=segments, cap_style=cap, join_style=join)
        return {
            'type': 'FeatureCollection',
            'features': [{
                'type': 'Feature',
                'properties': {'buffer_distance': distance},
                'geometry': mapping(buffered)
            }]
        }

    # Process features
    buffered_geoms = []
    buffered_features = []

    for feature in features:
        geom = shape(feature['geometry'])
        buffered = geom.buffer(distance, resolution=segments, cap_style=cap, join_style=join)
        buffered_geoms.append(buffered)

        if not dissolve:
            buffered_features.append({
                'type': 'Feature',
                'properties': {**feature.get('properties', {}), 'buffer_distance': distance},
                'geometry': mapping(buffered)
            })

    if dissolve:
        dissolved = unary_union(buffered_geoms)
        buffered_features = [{
            'type': 'Feature',
            'properties': {'buffer_distance': distance, 'dissolved': True},
            'geometry': mapping(dissolved)
        }]

    return {
        'type': 'FeatureCollection',
        'features': buffered_features
    }
