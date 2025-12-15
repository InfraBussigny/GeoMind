"""
Clip Raster algorithm - Clip raster data by vector geometry
Note: Requires rasterio/GDAL for full functionality
"""

from typing import Any, Dict, Optional
from shapely.geometry import shape, mapping
import os


def run(input_geojson: Optional[Dict], params: Dict[str, Any]) -> Dict:
    """
    Clip raster by vector geometry

    Params:
        raster_path: Path to input raster file (required)
        output_path: Path for output raster (optional)
        nodata: NoData value for clipped raster (default: -9999)

    Returns:
        Result dictionary with output path and statistics
    """
    raster_path = params.get('raster_path')
    if not raster_path:
        raise ValueError("Parameter 'raster_path' is required")

    if not os.path.exists(raster_path):
        raise FileNotFoundError(f"Raster file not found: {raster_path}")

    # Try to import rasterio
    try:
        import rasterio
        from rasterio.mask import mask
        import numpy as np
    except ImportError:
        return {
            'success': False,
            'error': "rasterio not installed. Install with: pip install rasterio",
            'hint': "Rasterio requires GDAL. On Windows, use conda or download wheels from https://www.lfd.uci.edu/~gohlke/pythonlibs/"
        }

    if not input_geojson:
        raise ValueError("Input GeoJSON required for clip geometry")

    # Get clip geometry
    features = input_geojson.get('features', [])
    if features:
        geoms = [shape(f['geometry']) for f in features]
    else:
        geoms = [shape(input_geojson)]

    # Output path
    output_path = params.get('output_path')
    if not output_path:
        base, ext = os.path.splitext(raster_path)
        output_path = f"{base}_clipped{ext}"

    nodata = params.get('nodata', -9999)

    # Perform clip
    with rasterio.open(raster_path) as src:
        out_image, out_transform = mask(src, geoms, crop=True, nodata=nodata)
        out_meta = src.meta.copy()

        out_meta.update({
            "driver": "GTiff",
            "height": out_image.shape[1],
            "width": out_image.shape[2],
            "transform": out_transform,
            "nodata": nodata
        })

        with rasterio.open(output_path, "w", **out_meta) as dest:
            dest.write(out_image)

        # Calculate statistics
        valid_data = out_image[out_image != nodata]
        stats = {
            'min': float(np.min(valid_data)) if len(valid_data) > 0 else None,
            'max': float(np.max(valid_data)) if len(valid_data) > 0 else None,
            'mean': float(np.mean(valid_data)) if len(valid_data) > 0 else None,
            'std': float(np.std(valid_data)) if len(valid_data) > 0 else None,
            'valid_pixels': int(len(valid_data)),
            'total_pixels': int(out_image.size)
        }

    return {
        'output_path': output_path,
        'statistics': stats,
        'dimensions': {
            'width': out_meta['width'],
            'height': out_meta['height'],
            'bands': out_image.shape[0]
        }
    }
