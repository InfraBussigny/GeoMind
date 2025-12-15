"""
Voronoi algorithm - Generate Voronoi polygons from points
"""

from typing import Any, Dict, Optional
from shapely.geometry import shape, mapping, Point, MultiPoint, box
from shapely.ops import voronoi_diagram
import numpy as np


def run(input_geojson: Optional[Dict], params: Dict[str, Any]) -> Dict:
    """
    Generate Voronoi polygons from point features

    Params:
        envelope: Bounding envelope as [minx, miny, maxx, maxy] (optional)
        buffer: Buffer around points extent (default: 10% of extent)

    Returns:
        GeoJSON FeatureCollection with Voronoi polygons
    """
    if not input_geojson:
        raise ValueError("Input GeoJSON required for voronoi operation")

    features = input_geojson.get('features', [])

    if not features:
        raise ValueError("No features provided for Voronoi diagram")

    # Extract points
    points = []
    point_props = []

    for feature in features:
        geom = shape(feature['geometry'])
        if geom.geom_type == 'Point':
            points.append(geom)
            point_props.append(feature.get('properties', {}))
        elif geom.geom_type == 'MultiPoint':
            for pt in geom.geoms:
                points.append(pt)
                point_props.append(feature.get('properties', {}))
        else:
            # Use centroid for non-point geometries
            points.append(geom.centroid)
            point_props.append(feature.get('properties', {}))

    if len(points) < 3:
        raise ValueError("At least 3 points required for Voronoi diagram")

    # Create multipoint
    multipoint = MultiPoint(points)

    # Calculate envelope
    envelope = params.get('envelope')
    if envelope:
        env_geom = box(envelope[0], envelope[1], envelope[2], envelope[3])
    else:
        # Use buffered extent
        buffer_pct = params.get('buffer', 0.1)
        bounds = multipoint.bounds
        dx = (bounds[2] - bounds[0]) * buffer_pct
        dy = (bounds[3] - bounds[1]) * buffer_pct
        env_geom = box(
            bounds[0] - dx,
            bounds[1] - dy,
            bounds[2] + dx,
            bounds[3] + dy
        )

    # Generate Voronoi diagram
    voronoi = voronoi_diagram(multipoint, envelope=env_geom)

    # Match polygons to original points
    result_features = []
    voronoi_polys = list(voronoi.geoms)

    for i, point in enumerate(points):
        # Find the Voronoi polygon containing this point
        for poly in voronoi_polys:
            if poly.contains(point):
                props = point_props[i].copy() if i < len(point_props) else {}
                props['voronoi_area'] = round(poly.area, 2)
                props['source_point'] = [point.x, point.y]

                result_features.append({
                    'type': 'Feature',
                    'properties': props,
                    'geometry': mapping(poly)
                })
                break

    return {
        'type': 'FeatureCollection',
        'features': result_features,
        'metadata': {
            'input_points': len(points),
            'output_polygons': len(result_features)
        }
    }
