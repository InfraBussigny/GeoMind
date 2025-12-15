"""
Convex Hull algorithm - Generate convex hull polygons
"""

from typing import Any, Dict, Optional
from shapely.geometry import shape, mapping, MultiPoint
from shapely.ops import unary_union


def run(input_geojson: Optional[Dict], params: Dict[str, Any]) -> Dict:
    """
    Generate convex hull from input geometries

    Params:
        group_by: Field to group features before calculating hulls (optional)

    Returns:
        GeoJSON FeatureCollection with convex hull polygon(s)
    """
    if not input_geojson:
        raise ValueError("Input GeoJSON required for convex_hull operation")

    features = input_geojson.get('features', [])
    group_by = params.get('group_by')

    if not features:
        raise ValueError("No features provided for convex hull")

    if group_by:
        # Group by field
        from collections import defaultdict
        groups = defaultdict(list)

        for feature in features:
            key = feature.get('properties', {}).get(group_by, '__none__')
            geom = shape(feature['geometry'])
            groups[key].append(geom)

        result_features = []
        for key, geoms in groups.items():
            combined = unary_union(geoms)
            hull = combined.convex_hull

            result_features.append({
                'type': 'Feature',
                'properties': {
                    group_by: key,
                    'feature_count': len(geoms),
                    'hull_area': round(hull.area, 2)
                },
                'geometry': mapping(hull)
            })
    else:
        # Single hull for all features
        geoms = [shape(f['geometry']) for f in features]
        combined = unary_union(geoms)
        hull = combined.convex_hull

        result_features = [{
            'type': 'Feature',
            'properties': {
                'feature_count': len(features),
                'hull_area': round(hull.area, 2)
            },
            'geometry': mapping(hull)
        }]

    return {
        'type': 'FeatureCollection',
        'features': result_features
    }
