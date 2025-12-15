#!/usr/bin/env python3
"""
QGlS Processor - Main entry point for Python geoprocessing
Communicates with Node.js via stdin/stdout using JSON

Usage:
    python qgls_processor.py <algorithm> <params_json>

Input: GeoJSON via stdin
Output: GeoJSON via stdout
"""

import sys
import json
import traceback
from typing import Any, Dict, Optional

# Import algorithms
from algorithms import (
    buffer,
    dissolve,
    simplify,
    voronoi,
    convex_hull,
    centroid,
    grid,
    clip_raster
)

# Algorithm registry
ALGORITHMS = {
    'buffer': buffer.run,
    'dissolve': dissolve.run,
    'simplify': simplify.run,
    'voronoi': voronoi.run,
    'convex_hull': convex_hull.run,
    'centroid': centroid.run,
    'grid': grid.run,
    'clip_raster': clip_raster.run,
}


def process(algorithm: str, params: Dict[str, Any], input_geojson: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Execute a geoprocessing algorithm

    Args:
        algorithm: Algorithm name
        params: Algorithm parameters
        input_geojson: Input GeoJSON (optional, some algorithms don't need input)

    Returns:
        Result dictionary with 'success', 'data' or 'error' keys
    """
    if algorithm not in ALGORITHMS:
        return {
            'success': False,
            'error': f"Unknown algorithm: {algorithm}",
            'available': list(ALGORITHMS.keys())
        }

    try:
        result = ALGORITHMS[algorithm](input_geojson, params)
        return {
            'success': True,
            'data': result
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }


def main():
    """Main entry point - CLI interface"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: qgls_processor.py <algorithm> [params_json]',
            'available': list(ALGORITHMS.keys())
        }))
        sys.exit(1)

    algorithm = sys.argv[1]

    # Parse parameters
    params = {}
    if len(sys.argv) >= 3:
        try:
            params = json.loads(sys.argv[2])
        except json.JSONDecodeError as e:
            print(json.dumps({
                'success': False,
                'error': f'Invalid params JSON: {e}'
            }))
            sys.exit(1)

    # Read input GeoJSON from stdin if available
    input_geojson = None
    if not sys.stdin.isatty():
        try:
            stdin_data = sys.stdin.read()
            if stdin_data.strip():
                input_geojson = json.loads(stdin_data)
        except json.JSONDecodeError as e:
            print(json.dumps({
                'success': False,
                'error': f'Invalid input GeoJSON: {e}'
            }))
            sys.exit(1)

    # Process
    result = process(algorithm, params, input_geojson)

    # Output result
    print(json.dumps(result))
    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()
