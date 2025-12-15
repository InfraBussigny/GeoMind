/**
 * Calage (Georeferencing) Services
 * Barrel export for all calage-related services
 */

// Transformation algorithms
export {
  computeHelmert,
  computeAffine,
  applyHelmert,
  applyAffine,
  calculateResiduals,
  calculateRMS,
  computeTransform,
  getRMSQuality,
  getRMSColor,
  affineToHelmert,
  type HelmertParams,
  type AffineParams,
  type Residual
} from './transformation';

// File export functions
export {
  generateWorldFile,
  worldFileToString,
  getWorldFileExtension,
  exportCalibrationPointsToGeoJSON,
  exportImageBoundsToGeoJSON,
  downloadAsFile,
  downloadAsJSON,
  downloadWorldFile,
  exportToShapefile,
  exportToGeoPackage,
  exportGeoreferencedData,
  type ExportOptions,
  type WorldFileParams,
  type GeoJSONFeatureCollection,
  type GeoJSONFeature
} from './fileExport';
