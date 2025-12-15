"""
Centroid algorithm - Calculate centroids of geometries
"""

from typing import Any, Dict, Optional
from shapely.geometry import shape, mapping


def run(input_geojson: Optional[Dict], params: Dict[str, Any]) -> Dict:
    """
    Calculate centroids of input geometries

    Params:
        weighted: Use weighted centroid for polygons (default: False)
        inside: Force centroid to be inside polygon using representative_point (default: False)

    Returns:
        GeoJSON FeatureCollection with centroid points
    """
    if not input_geojson:
        raise ValueError("Input GeoJSON required for centroid operation")

    inside = params.get('inside', False)
    features = input_geojson.get('features', [])

    if not features:
        # Single geometry
        geom = shape(input_geojson)
        if inside:
            centroid = geom.representative_point()
        else:
            centroid = geom.centroid

        return {
            'type': 'FeatureCollection',
            'features': [{
                'type': 'Feature',
                'properties': {
                    'original_type': geom.geom_type,
                    'original_area': round(geom.area, 2) if hasattr(geom, 'area') else None
                },
                'geometry': mapping(centroid)
            }]
        }

    # Process features
    result_features = []

    for feature in features:
        geom = shape(feature['geometry'])

        if inside:
            centroid = geom.representative_point()
        else:
            centroid = geom.centroid

        props = feature.get('properties', {}).copy()
        props.update({
            'original_type': geom.geom_type,
            'centroid_x': round(centroid.x, 3),
            'centroid_y': round(centroid.y, 3)
        })

        if geom.geom_type in ('Polygon', 'MultiPolygon'):
            props['original_area'] = round(geom.area, 2)
        if geom.geom_type in ('LineString', 'MultiLineString'):
            props['original_length'] = round(geom.length, 2)

        result_features.append({
            'type': 'Feature',
            'properties': props,
            'geometry': mapping(centroid)
        })

    return {
        'type': 'FeatureCollection',
        'features': result_features
    }
