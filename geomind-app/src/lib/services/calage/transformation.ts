/**
 * Transformation Service for Georeferencing
 * Implements Helmert (4-param) and Affine (6-param) transformations
 */

import { Matrix } from 'ml-matrix';
import type { CalibrationPoint, TransformResult } from '$lib/stores/calageStore';

// ============================================
// TYPES
// ============================================

export interface HelmertParams {
  tx: number;      // Translation X
  ty: number;      // Translation Y
  scale: number;   // Scale factor
  rotation: number; // Rotation in degrees
}

export interface AffineParams {
  a: number;  // Scale X + rotation
  b: number;  // Shear Y
  c: number;  // Translation X
  d: number;  // Shear X
  e: number;  // Scale Y + rotation
  f: number;  // Translation Y
}

export interface Residual {
  pointId: string;
  dx: number;
  dy: number;
  dist: number;
}

// ============================================
// HELMERT TRANSFORMATION (4 parameters)
// Preserves shape, uniform scale, rotation
// Requires minimum 2 points
// ============================================

export function computeHelmert(points: CalibrationPoint[]): HelmertParams | null {
  if (points.length < 2) return null;

  // Filter points with both image and world coordinates
  const validPoints = points.filter(
    p => p.imageX !== undefined && p.imageY !== undefined &&
         p.worldX !== undefined && p.worldY !== undefined
  );

  if (validPoints.length < 2) return null;

  // Compute centroids
  let sumImgX = 0, sumImgY = 0, sumWorldX = 0, sumWorldY = 0;
  for (const p of validPoints) {
    sumImgX += p.imageX;
    sumImgY += p.imageY;
    sumWorldX += p.worldX;
    sumWorldY += p.worldY;
  }

  const n = validPoints.length;
  const centImgX = sumImgX / n;
  const centImgY = sumImgY / n;
  const centWorldX = sumWorldX / n;
  const centWorldY = sumWorldY / n;

  // Compute scale and rotation using least squares
  let num1 = 0, num2 = 0, denom = 0;
  for (const p of validPoints) {
    const dx_img = p.imageX - centImgX;
    const dy_img = p.imageY - centImgY;
    const dx_world = p.worldX - centWorldX;
    const dy_world = p.worldY - centWorldY;

    num1 += dx_img * dx_world + dy_img * dy_world;
    num2 += dx_img * dy_world - dy_img * dx_world;
    denom += dx_img * dx_img + dy_img * dy_img;
  }

  if (denom === 0) return null;

  const a = num1 / denom;
  const b = num2 / denom;
  const scale = Math.sqrt(a * a + b * b);
  const rotation = Math.atan2(b, a) * 180 / Math.PI;

  const cosR = Math.cos(rotation * Math.PI / 180);
  const sinR = Math.sin(rotation * Math.PI / 180);

  const tx = centWorldX - scale * (centImgX * cosR - centImgY * sinR);
  const ty = centWorldY - scale * (centImgX * sinR + centImgY * cosR);

  return { tx, ty, scale, rotation };
}

// ============================================
// AFFINE TRANSFORMATION (6 parameters)
// Handles non-uniform scale, rotation, shear
// Requires minimum 3 points
// ============================================

export function computeAffine(points: CalibrationPoint[]): AffineParams | null {
  if (points.length < 3) return null;

  // Filter points with both image and world coordinates
  const validPoints = points.filter(
    p => p.imageX !== undefined && p.imageY !== undefined &&
         p.worldX !== undefined && p.worldY !== undefined
  );

  if (validPoints.length < 3) return null;

  // Build matrices for least squares: A * [a,b,c,d,e,f]^T = B
  // For each point: worldX = a*imgX + b*imgY + c
  //                 worldY = d*imgX + e*imgY + f
  const A_data: number[][] = [];
  const Bx: number[] = [];
  const By: number[] = [];

  for (const p of validPoints) {
    A_data.push([p.imageX, p.imageY, 1]);
    Bx.push(p.worldX);
    By.push(p.worldY);
  }

  try {
    const A = new Matrix(A_data);
    const Bx_mat = Matrix.columnVector(Bx);
    const By_mat = Matrix.columnVector(By);

    // Solve using pseudo-inverse (least squares)
    const At = A.transpose();
    const AtA = At.mmul(A);
    const AtA_inv = new Matrix(AtA.to2DArray()).pseudoInverse();

    const coeffsX = AtA_inv.mmul(At).mmul(Bx_mat);
    const coeffsY = AtA_inv.mmul(At).mmul(By_mat);

    return {
      a: coeffsX.get(0, 0),
      b: coeffsX.get(1, 0),
      c: coeffsX.get(2, 0),
      d: coeffsY.get(0, 0),
      e: coeffsY.get(1, 0),
      f: coeffsY.get(2, 0)
    };
  } catch (err) {
    console.error('[Calage] Affine transform error:', err);
    return null;
  }
}

// ============================================
// APPLY TRANSFORMATIONS
// ============================================

export function applyHelmert(
  params: HelmertParams,
  imageX: number,
  imageY: number
): { worldX: number; worldY: number } {
  const cosR = Math.cos(params.rotation * Math.PI / 180);
  const sinR = Math.sin(params.rotation * Math.PI / 180);

  const worldX = params.tx + params.scale * (imageX * cosR - imageY * sinR);
  const worldY = params.ty + params.scale * (imageX * sinR + imageY * cosR);

  return { worldX, worldY };
}

export function applyAffine(
  params: AffineParams,
  imageX: number,
  imageY: number
): { worldX: number; worldY: number } {
  const worldX = params.a * imageX + params.b * imageY + params.c;
  const worldY = params.d * imageX + params.e * imageY + params.f;

  return { worldX, worldY };
}

// ============================================
// CALCULATE RESIDUALS AND RMS
// ============================================

export function calculateResiduals(
  points: CalibrationPoint[],
  transformType: 'helmert' | 'affine',
  helmertParams?: HelmertParams | null,
  affineParams?: AffineParams | null
): Residual[] {
  const residuals: Residual[] = [];

  for (const p of points) {
    if (p.imageX === undefined || p.imageY === undefined ||
        p.worldX === undefined || p.worldY === undefined) {
      continue;
    }

    let transformed: { worldX: number; worldY: number };

    if (transformType === 'helmert' && helmertParams) {
      transformed = applyHelmert(helmertParams, p.imageX, p.imageY);
    } else if (transformType === 'affine' && affineParams) {
      transformed = applyAffine(affineParams, p.imageX, p.imageY);
    } else {
      continue;
    }

    const dx = transformed.worldX - p.worldX;
    const dy = transformed.worldY - p.worldY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    residuals.push({
      pointId: p.id,
      dx,
      dy,
      dist
    });
  }

  return residuals;
}

export function calculateRMS(residuals: Residual[]): number {
  if (residuals.length === 0) return 0;

  const sumSquaredDist = residuals.reduce((sum, r) => sum + r.dist * r.dist, 0);
  return Math.sqrt(sumSquaredDist / residuals.length);
}

// ============================================
// FULL TRANSFORM COMPUTATION
// ============================================

export function computeTransform(
  points: CalibrationPoint[],
  type: 'helmert' | 'affine'
): TransformResult | null {
  if (type === 'helmert') {
    const params = computeHelmert(points);
    if (!params) return null;

    const residuals = calculateResiduals(points, 'helmert', params, null);
    const rms = calculateRMS(residuals);

    return {
      type: 'helmert',
      tx: params.tx,
      ty: params.ty,
      scale: params.scale,
      rotation: params.rotation,
      rms,
      residuals
    };
  } else {
    const params = computeAffine(points);
    if (!params) return null;

    const residuals = calculateResiduals(points, 'affine', null, params);
    const rms = calculateRMS(residuals);

    // Extract approximate scale and rotation from affine params
    const scaleX = Math.sqrt(params.a * params.a + params.d * params.d);
    const scaleY = Math.sqrt(params.b * params.b + params.e * params.e);
    const rotation = Math.atan2(params.d, params.a) * 180 / Math.PI;

    return {
      type: 'affine',
      a: params.a,
      b: params.b,
      c: params.c,
      d: params.d,
      e: params.e,
      f: params.f,
      tx: params.c,
      ty: params.f,
      scale: (scaleX + scaleY) / 2,
      rotation,
      rms,
      residuals
    };
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getRMSQuality(rms: number): 'excellent' | 'good' | 'acceptable' | 'poor' {
  if (rms < 0.03) return 'excellent';   // < 3 cm
  if (rms < 0.10) return 'good';        // < 10 cm
  if (rms < 0.20) return 'acceptable';  // < 20 cm
  return 'poor';
}

export function getRMSColor(rms: number): string {
  const quality = getRMSQuality(rms);
  switch (quality) {
    case 'excellent': return '#00ff88';  // Green
    case 'good': return '#4ecdc4';       // Teal
    case 'acceptable': return '#ffc107'; // Yellow/Warning
    case 'poor': return '#ff4444';       // Red
  }
}

// Extract Helmert-equivalent params from Affine
export function affineToHelmert(params: AffineParams): HelmertParams {
  const scaleX = Math.sqrt(params.a * params.a + params.d * params.d);
  const scaleY = Math.sqrt(params.b * params.b + params.e * params.e);
  const rotation = Math.atan2(params.d, params.a) * 180 / Math.PI;

  return {
    tx: params.c,
    ty: params.f,
    scale: (scaleX + scaleY) / 2,
    rotation
  };
}
