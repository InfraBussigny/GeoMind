"""
Dissolve algorithm - Merge geometries based on attribute or all together
"""

from typing import Any, Dict, Optional
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from collections import defaultdict


def run(input_geojson: Optional[Dict], params: Dict[str, Any]) -> Dict:
    """
    Dissolve (merge) geometries

    Params:
        field: Attribute field to group by (optional - if not provided, dissolves all)

    Returns:
        GeoJSON FeatureCollection with dissolved geometries
    """
    if not input_geojson:
        raise ValueError("Input GeoJSON required for dissolve operation")

    field = params.get('field')
    features = input_geojson.get('features', [])

    if not features:
        return input_geojson

    if field:
        # Group by field value
        groups = defaultdict(list)
        for feature in features:
            key = feature.get('properties', {}).get(field, '__none__')
            groups[key].append(shape(feature['geometry']))

        result_features = []
        for key, geoms in groups.items():
            dissolved = unary_union(geoms)
            result_features.append({
                'type': 'Feature',
                'properties': {field: key, 'dissolved_count': len(geoms)},
                'geometry': mapping(dissolved)
            })
    else:
        # Dissolve all
        geoms = [shape(f['geometry']) for f in features]
        dissolved = unary_union(geoms)
        result_features = [{
            'type': 'Feature',
            'properties': {'dissolved_count': len(geoms)},
            'geometry': mapping(dissolved)
        }]

    return {
        'type': 'FeatureCollection',
        'features': result_features
    }
