# Guide d'implémentation CAD Web avec Fabric.js

## Vue d'ensemble

Ce document présente les meilleures pratiques pour implémenter les fonctionnalités CAD avancées dans GeoMind, basées sur des recherches approfondies et l'analyse du code existant.

**Situation actuelle** : Le module CAD existe déjà (`C:\Users\zema\GeoBrain\geomind-app\src\lib\components\CAD\CADModule.svelte`) avec :
- Lecture DXF via `dxf-parser` (v1.1.2)
- Support de Fabric.js (v6.9.0)
- Géoréférencement partiel avec transformation Helmert (4 paramètres)
- Support PostGIS
- Système de calques

---

## 1. Géoréférencement / Calage d'images

### 1.1 État actuel

**Implémentation existante** (lignes 812-933 du CADModule.svelte) :
- Transformation Helmert à 4 paramètres (tx, ty, scale, rotation)
- Minimum 2 points de calage requis
- Calcul du RMS error et des résidus par point
- Interface pour placer les points de contrôle

**Limitations** :
- Helmert ne supporte que translation, rotation et échelle uniforme
- Pas de correction d'inclinaison (skew) ni de mise à l'échelle différentielle
- Pas adapté aux distorsions complexes des plans scannés

### 1.2 Recommandations d'amélioration

#### A. Passer à une transformation affine complète (6 paramètres)

**Pourquoi** : La transformation affine permet translation, rotation, mise à l'échelle (X/Y indépendantes) et inclinaison.

**Formule** :
```
X_world = a0 + a1*x_image + a2*y_image
Y_world = b0 + b1*x_image + b2*y_image
```

Où a0,a1,a2,b0,b1,b2 sont les 6 coefficients calculés à partir des points de contrôle.

**Code de référence** (à ajouter) :

```typescript
interface AffineTransform {
  a0: number; a1: number; a2: number;
  b0: number; b1: number; b2: number;
}

function computeAffineTransform(points: GeorefPoint[]): AffineTransform | null {
  if (points.length < 3) {
    console.error('Minimum 3 points de calage requis pour transformation affine');
    return null;
  }

  // Construction du système d'équations linéaires AX = B
  // Pour n points, on a 2n équations et 6 inconnues
  const n = points.length;
  const A: number[][] = [];
  const Bx: number[] = [];
  const By: number[] = [];

  for (const p of points) {
    // Équations pour X
    A.push([1, p.imageX, p.imageY, 0, 0, 0]);
    Bx.push(p.worldX);

    // Équations pour Y
    A.push([0, 0, 0, 1, p.imageX, p.imageY]);
    By.push(p.worldY);
  }

  // Résolution par moindres carrés (utiliser une lib comme ml-matrix)
  const coeffsX = solveLeastSquares(A.slice(0, n), Bx);
  const coeffsY = solveLeastSquares(A.slice(n), By);

  return {
    a0: coeffsX[0], a1: coeffsX[1], a2: coeffsX[2],
    b0: coeffsY[0], b1: coeffsY[1], b2: coeffsY[2]
  };
}

function applyAffineTransform(
  imageX: number,
  imageY: number,
  transform: AffineTransform
): { worldX: number; worldY: number } {
  return {
    worldX: transform.a0 + transform.a1 * imageX + transform.a2 * imageY,
    worldY: transform.b0 + transform.b1 * imageX + transform.b2 * imageY
  };
}

// Transformation inverse (world -> image)
function computeInverseAffineTransform(t: AffineTransform): AffineTransform {
  const det = t.a1 * t.b2 - t.a2 * t.b1;
  if (Math.abs(det) < 1e-10) {
    throw new Error('Transformation singulière');
  }

  return {
    a0: (t.a2 * t.b0 - t.a0 * t.b2) / det,
    a1: t.b2 / det,
    a2: -t.a2 / det,
    b0: (t.a0 * t.b1 - t.a1 * t.b0) / det,
    b1: -t.b1 / det,
    b2: t.a1 / det
  };
}
```

#### B. Bibliothèque recommandée pour calculs matriciels

**ml-matrix** : https://www.npmjs.com/package/ml-matrix

```bash
npm install ml-matrix
```

Usage :
```typescript
import { Matrix, solve } from 'ml-matrix';

function solveLeastSquares(A: number[][], b: number[]): number[] {
  const matA = new Matrix(A);
  const matB = Matrix.columnVector(b);

  // Résolution (A^T * A)^-1 * A^T * b
  const AtA = matA.transpose().mmul(matA);
  const Atb = matA.transpose().mmul(matB);

  return solve(AtA, Atb).to1DArray();
}
```

#### C. Interface utilisateur améliorée

**Workflow proposé** :

1. **Import image** → Image apparaît sur le canvas
2. **Mode géoréférencement** → Bouton "Géoréférencer" activé
3. **Placement points** :
   - Clic sur image → Marque point image (croix rouge)
   - Saisie coordonnées MN95 dans dialog → Marque point monde
   - Affichage tableau : Point # | X_image | Y_image | E_MN95 | N_MN95 | Résidu
4. **Calcul automatique** dès 3 points :
   - Transformation affine calculée en temps réel
   - RMS error affiché
   - Points avec résidu > seuil colorés en orange
5. **Validation** :
   - Bouton "Appliquer" → Applique transformation à l'image
   - Bouton "Export worldfile" → Génère .pgw ou .tfw

**Code UI (à intégrer)** :

```svelte
{#if georefMode && selectedImageId}
  <div class="georef-controls">
    <h4>Points de calage ({georefPoints.length})</h4>

    <table class="georef-table">
      <thead>
        <tr>
          <th>#</th>
          <th>X image</th>
          <th>Y image</th>
          <th>E (MN95)</th>
          <th>N (MN95)</th>
          <th>Résidu (m)</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each georefPoints as pt, i}
          <tr class:high-residual={pt.residual > 0.5}>
            <td>{i+1}</td>
            <td>{pt.imageX.toFixed(1)}</td>
            <td>{pt.imageY.toFixed(1)}</td>
            <td>
              <input type="number" bind:value={pt.worldX} step="0.01" />
            </td>
            <td>
              <input type="number" bind:value={pt.worldY} step="0.01" />
            </td>
            <td>{pt.residual?.toFixed(3) || '-'}</td>
            <td>
              <button onclick={() => deleteGeorefPoint(i)}>🗑️</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if rmsError !== null}
      <div class="georef-stats">
        <span class:warning={rmsError > 1.0}>
          RMS Error: {rmsError.toFixed(3)} m
        </span>
        {#if georefPoints.length >= 3}
          <span class="ok">Transformation valide</span>
        {/if}
      </div>
    {/if}

    <div class="georef-actions">
      <button class="btn-primary"
              onclick={applyAffineTransform}
              disabled={georefPoints.length < 3}>
        Appliquer transformation
      </button>
      <button class="btn-secondary" onclick={exportWorldfile}>
        Export worldfile
      </button>
    </div>
  </div>
{/if}
```

#### D. Gestion des projections Swiss

**Important** : Tu utilises déjà proj4 et as défini EPSG:2056 (MN95).

**Best practice** : Pour le calage avec MN95, assure-toi :
- Les coordonnées saisies sont en mètres (format : 2533500, 1152000)
- Pas de conversion degré/radian
- Vérification cohérence : E entre 2480000-2840000, N entre 1070000-1300000

**Code validation** :

```typescript
function validateMN95Coords(e: number, n: number): boolean {
  const E_MIN = 2480000, E_MAX = 2840000;
  const N_MIN = 1070000, N_MAX = 1300000;

  if (e < E_MIN || e > E_MAX || n < N_MIN || n > N_MAX) {
    console.warn(`Coordonnées MN95 hors limites: E=${e}, N=${n}`);
    return false;
  }
  return true;
}
```

**Références** :
- [Swisstopo - Transformations 3D](https://www.swisstopo.admin.ch/fr/transformations-3d-planimetrie)
- [Coordinate reference systems Switzerland](https://epsg.io/?q=Switzerland)

---

## 2. Modification dynamique des styles de calques

### 2.1 État actuel

Le code actuel gère déjà :
- `opacity` par calque (ligne 22)
- `strokeWidth` par calque (ligne 23)
- Couleur par calque

### 2.2 Approche recommandée

**Fabric.js permet de modifier dynamiquement les propriétés** via `set()` :

```typescript
// Fonction pour mettre à jour le style d'un calque
function updateLayerStyle(layerName: string, updates: {
  strokeWidth?: number;
  stroke?: string;
  opacity?: number;
}) {
  if (!fabricCanvas) return;

  // Parcourir tous les objets du canvas
  fabricCanvas.getObjects().forEach((obj: any) => {
    // Vérifier si l'objet appartient au calque
    if (obj.data?.layer === layerName) {
      // Appliquer les modifications
      if (updates.strokeWidth !== undefined) {
        obj.set('strokeWidth', updates.strokeWidth);
      }
      if (updates.stroke !== undefined) {
        obj.set('stroke', updates.stroke);
      }
      if (updates.opacity !== undefined) {
        obj.set('opacity', updates.opacity);
      }
    }
  });

  // Rafraîchir le canvas
  fabricCanvas.renderAll();
}
```

**Interface de contrôle** :

```svelte
<div class="layer-controls">
  <label>
    Épaisseur:
    <input
      type="range"
      min="0.5"
      max="5"
      step="0.5"
      bind:value={layer.strokeWidth}
      oninput={() => updateLayerStyle(layer.name, { strokeWidth: layer.strokeWidth })}
    />
    <span>{layer.strokeWidth}px</span>
  </label>

  <label>
    Couleur:
    <input
      type="color"
      bind:value={layer.color}
      oninput={() => updateLayerStyle(layer.name, { stroke: layer.color })}
    />
  </label>

  <label>
    Opacité:
    <input
      type="range"
      min="0"
      max="1"
      step="0.1"
      bind:value={layer.opacity}
      oninput={() => updateLayerStyle(layer.name, { opacity: layer.opacity })}
    />
    <span>{Math.round(layer.opacity * 100)}%</span>
  </label>
</div>
```

**Note importante** : D'après les recherches, il y a un problème connu avec l'opacité dans Fabric.js :
- Quand on change l'opacité d'un objet, le stroke devient semi-transparent aussi
- Si tu veux un stroke à 100% et un fill à 50%, tu dois gérer séparément `strokeOpacity` (non supporté nativement)

**Workaround** :

```typescript
function setLayerOpacity(layerName: string, opacity: number) {
  fabricCanvas.getObjects().forEach((obj: any) => {
    if (obj.data?.layer === layerName) {
      // Pour garder stroke opaque, on utilise une approche RGBA
      if (obj.fill) {
        const fillColor = new fabric.Color(obj.fill);
        fillColor.setAlpha(opacity);
        obj.set('fill', fillColor.toRgba());
      }
      // Garder stroke opaque
      obj.set('opacity', 1);
    }
  });
  fabricCanvas.renderAll();
}
```

**Références** :
- [Fabric.js opacity issues](https://github.com/fabricjs/fabric.js/issues/2835)
- [Fabric.js strokeWidth on the fly](https://github.com/fabricjs/fabric.js/issues/3556)

---

## 3. Outils d'édition CAD

### 3.1 État actuel

Le module a déjà :
- Outils de sélection et pan
- Mesure distance/surface
- Pas d'outils de dessin

### 3.2 Outils à implémenter

#### A. Dessin de ligne

```typescript
let isDrawingLine = false;
let lineStart: { x: number; y: number } | null = null;
let tempLine: any = null;

function startLineTool() {
  selectedTool = 'draw-line';
  fabricCanvas.selection = false;
  isDrawingLine = false;
}

function handleLineDrawing(e: any) {
  const pointer = fabricCanvas.getPointer(e.e);
  const worldCoords = canvasToWorld(pointer.x, pointer.y);

  if (!isDrawingLine) {
    // Premier clic - définir point de départ
    lineStart = worldCoords;
    isDrawingLine = true;

    // Créer ligne temporaire
    tempLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
      stroke: currentLayer.color,
      strokeWidth: currentLayer.strokeWidth,
      selectable: false,
      evented: false,
      strokeDashArray: [5, 5]
    });
    fabricCanvas.add(tempLine);
  } else {
    // Deuxième clic - finaliser ligne
    const line = new fabric.Line([
      lineStart!.x - viewCenter.x,
      viewCenter.y - lineStart!.y,
      worldCoords.x - viewCenter.x,
      viewCenter.y - worldCoords.y
    ], {
      stroke: currentLayer.color,
      strokeWidth: currentLayer.strokeWidth,
      selectable: true,
      data: {
        type: 'LINE',
        layer: currentLayer.name,
        start: lineStart,
        end: worldCoords
      }
    });

    fabricCanvas.remove(tempLine);
    fabricCanvas.add(line);
    fabricCanvas.renderAll();

    // Ajouter à entities
    entities = [...entities, {
      type: 'LINE',
      layer: currentLayer.name,
      color: currentLayer.color,
      handle: generateHandle(),
      data: { start: lineStart, end: worldCoords }
    }];

    // Reset
    isDrawingLine = false;
    lineStart = null;
    tempLine = null;
  }
}

// Mise à jour preview pendant déplacement souris
function updateLinePreview(e: any) {
  if (isDrawingLine && tempLine && lineStart) {
    const pointer = fabricCanvas.getPointer(e.e);
    tempLine.set({ x2: pointer.x, y2: pointer.y });
    fabricCanvas.renderAll();
  }
}
```

#### B. Dessin de polyligne

```typescript
let polylinePoints: { x: number; y: number }[] = [];
let tempPolyline: any = null;

function handlePolylineDrawing(e: any) {
  const pointer = fabricCanvas.getPointer(e.e);
  const worldCoords = canvasToWorld(pointer.x, pointer.y);

  // Ajouter point
  polylinePoints.push(worldCoords);

  // Mettre à jour preview
  if (tempPolyline) {
    fabricCanvas.remove(tempPolyline);
  }

  const canvasPoints = polylinePoints.map(p => ({
    x: p.x - viewCenter.x,
    y: viewCenter.y - p.y
  }));

  tempPolyline = new fabric.Polyline(canvasPoints, {
    stroke: currentLayer.color,
    strokeWidth: currentLayer.strokeWidth,
    fill: 'transparent',
    selectable: false,
    strokeDashArray: [5, 5]
  });

  fabricCanvas.add(tempPolyline);
  fabricCanvas.renderAll();
}

function finishPolyline() {
  if (polylinePoints.length < 2) return;

  const canvasPoints = polylinePoints.map(p => ({
    x: p.x - viewCenter.x,
    y: viewCenter.y - p.y
  }));

  const polyline = new fabric.Polyline(canvasPoints, {
    stroke: currentLayer.color,
    strokeWidth: currentLayer.strokeWidth,
    fill: 'transparent',
    selectable: true,
    data: {
      type: 'POLYLINE',
      layer: currentLayer.name,
      points: polylinePoints
    }
  });

  fabricCanvas.remove(tempPolyline);
  fabricCanvas.add(polyline);

  // Reset
  polylinePoints = [];
  tempPolyline = null;
}
```

#### C. Rectangle et cercle

```typescript
// Rectangle
function drawRectangle(e: any) {
  const pointer = fabricCanvas.getPointer(e.e);

  const rect = new fabric.Rect({
    left: pointer.x - 50,
    top: pointer.y - 50,
    width: 100,
    height: 100,
    stroke: currentLayer.color,
    strokeWidth: currentLayer.strokeWidth,
    fill: 'transparent',
    data: { type: 'RECTANGLE', layer: currentLayer.name }
  });

  fabricCanvas.add(rect);
}

// Cercle
function drawCircle(e: any) {
  const pointer = fabricCanvas.getPointer(e.e);

  const circle = new fabric.Circle({
    left: pointer.x - 50,
    top: pointer.y - 50,
    radius: 50,
    stroke: currentLayer.color,
    strokeWidth: currentLayer.strokeWidth,
    fill: 'transparent',
    data: { type: 'CIRCLE', layer: currentLayer.name }
  });

  fabricCanvas.add(circle);
}
```

### 3.3 Snapping

**Snap to grid** :

```typescript
let gridSize = 10; // pixels
let snapToGrid = true;

function snapPoint(x: number, y: number): { x: number; y: number } {
  if (!snapToGrid) return { x, y };

  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize
  };
}

// Intégrer dans mouse:move
fabricCanvas.on('object:moving', (e: any) => {
  if (snapToGrid && e.target) {
    const snapped = snapPoint(e.target.left, e.target.top);
    e.target.set({
      left: snapped.x,
      top: snapped.y
    });
  }
});
```

**Snap to object** (accrochage aux points) :

```typescript
let snapToObject = true;
let snapTolerance = 10; // pixels

function findNearestSnapPoint(x: number, y: number): { x: number; y: number } | null {
  if (!snapToObject) return null;

  let nearest: { x: number; y: number; dist: number } | null = null;

  fabricCanvas.getObjects().forEach((obj: any) => {
    // Obtenir les points d'accrochage de l'objet
    const snapPoints = getObjectSnapPoints(obj);

    snapPoints.forEach(pt => {
      const dist = Math.hypot(pt.x - x, pt.y - y);
      if (dist < snapTolerance && (!nearest || dist < nearest.dist)) {
        nearest = { x: pt.x, y: pt.y, dist };
      }
    });
  });

  return nearest ? { x: nearest.x, y: nearest.y } : null;
}

function getObjectSnapPoints(obj: any): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];

  if (obj.type === 'line') {
    // Extrémités de la ligne
    points.push({ x: obj.x1, y: obj.y1 });
    points.push({ x: obj.x2, y: obj.y2 });
    // Milieu
    points.push({
      x: (obj.x1 + obj.x2) / 2,
      y: (obj.y1 + obj.y2) / 2
    });
  } else if (obj.type === 'rect') {
    // 4 coins + centre
    const bounds = obj.getBoundingRect();
    points.push({ x: bounds.left, y: bounds.top });
    points.push({ x: bounds.left + bounds.width, y: bounds.top });
    points.push({ x: bounds.left, y: bounds.top + bounds.height });
    points.push({ x: bounds.left + bounds.width, y: bounds.top + bounds.height });
    points.push({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2
    });
  } else if (obj.type === 'circle') {
    // Centre + 4 quadrants
    const bounds = obj.getBoundingRect();
    const cx = bounds.left + bounds.width / 2;
    const cy = bounds.top + bounds.height / 2;
    const r = obj.radius * obj.scaleX;

    points.push({ x: cx, y: cy }); // centre
    points.push({ x: cx + r, y: cy }); // E
    points.push({ x: cx - r, y: cy }); // W
    points.push({ x: cx, y: cy + r }); // S
    points.push({ x: cx, y: cy - r }); // N
  }

  return points;
}

// Afficher indicateur de snap
let snapIndicator: any = null;

function showSnapIndicator(x: number, y: number) {
  if (snapIndicator) {
    fabricCanvas.remove(snapIndicator);
  }

  snapIndicator = new fabric.Circle({
    left: x - 5,
    top: y - 5,
    radius: 5,
    fill: 'transparent',
    stroke: '#00ff00',
    strokeWidth: 2,
    selectable: false,
    evented: false
  });

  fabricCanvas.add(snapIndicator);
  fabricCanvas.renderAll();
}
```

**Références** :
- [Fabric.js snapping demo](https://jsfiddle.net/fabricjs/S9sLu)
- [HackerNoon - Object Snapping](https://hackernoon.com/mastering-object-snapping-in-fabricjs-introducing-the-snappyrect-class)

### 3.4 Undo/Redo

```typescript
let historyStack: any[] = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

function saveState() {
  // Sauvegarder l'état actuel du canvas
  const state = JSON.stringify(fabricCanvas.toJSON(['data']));

  // Supprimer les états "future" si on est au milieu de l'historique
  historyStack = historyStack.slice(0, historyIndex + 1);

  // Ajouter nouvel état
  historyStack.push(state);

  // Limiter taille
  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift();
  } else {
    historyIndex++;
  }
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    loadState(historyStack[historyIndex]);
  }
}

function redo() {
  if (historyIndex < historyStack.length - 1) {
    historyIndex++;
    loadState(historyStack[historyIndex]);
  }
}

function loadState(state: string) {
  fabricCanvas.loadFromJSON(state, () => {
    fabricCanvas.renderAll();
  });
}

// Sauvegarder état après chaque modification
fabricCanvas.on('object:added', saveState);
fabricCanvas.on('object:modified', saveState);
fabricCanvas.on('object:removed', saveState);

// Raccourcis clavier
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    undo();
  }
  if (e.ctrlKey && e.key === 'y') {
    e.preventDefault();
    redo();
  }
});
```

---

## 4. Export DXF

### 4.1 Bibliothèques disponibles

Après recherche approfondie, voici les options :

#### Option 1 : **dxf-writer** (NPM)

**Avantages** :
- Simple à utiliser
- Légère (17 projets l'utilisent)
- API claire

**Inconvénients** :
- Dernière MAJ il y a 3 ans
- Support limité des entités complexes

**Installation** :
```bash
npm install dxf-writer
```

**Usage** :
```typescript
import DxfWriter from 'dxf-writer';

function exportToDXF() {
  const dxf = new DxfWriter();

  // Créer calques
  layers.forEach(layer => {
    dxf.addLayer(layer.name, layer.color, 'CONTINUOUS');
  });

  // Ajouter entités
  fabricCanvas.getObjects().forEach((obj: any) => {
    const data = obj.data;
    const layerName = data?.layer || '0';

    if (obj.type === 'line') {
      dxf.drawLine(
        obj.x1, obj.y1,
        obj.x2, obj.y2,
        layerName
      );
    } else if (obj.type === 'polyline') {
      const points = obj.points.map((p: any) => [p.x, p.y]);
      dxf.drawPolyline(points, layerName);
    } else if (obj.type === 'circle') {
      dxf.drawCircle(
        obj.left + obj.radius,
        obj.top + obj.radius,
        obj.radius,
        layerName
      );
    } else if (obj.type === 'rect') {
      const x = obj.left;
      const y = obj.top;
      const w = obj.width;
      const h = obj.height;

      dxf.drawPolyline([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y]
      ], layerName, true); // true = closed
    }
  });

  // Générer et télécharger
  const dxfString = dxf.toDxfString();
  downloadFile(dxfString, `${fileName || 'drawing'}.dxf`, 'application/dxf');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

#### Option 2 : **@tarikjabiri/dxf** (moderne, TypeScript)

**Avantages** :
- Écrit en TypeScript
- Mieux maintenu
- Documentation complète : https://dxf.vercel.app/
- Support plus d'entités

**Installation** :
```bash
npm install @tarikjabiri/dxf
```

**Usage** :
```typescript
import { DxfWriter, point, line, polyline, circle, rectangle } from '@tarikjabiri/dxf';

function exportToDXFModern() {
  const writer = new DxfWriter();

  // Créer calques
  layers.forEach(layer => {
    writer.addLayer(layer.name, layer.color);
  });

  // Ajouter entités
  fabricCanvas.getObjects().forEach((obj: any) => {
    const layerName = obj.data?.layer || '0';

    if (obj.type === 'line') {
      writer.addLine(
        line(
          point(obj.x1, obj.y1),
          point(obj.x2, obj.y2)
        ).layer(layerName)
      );
    } else if (obj.type === 'circle') {
      writer.addCircle(
        circle(
          point(obj.left + obj.radius, obj.top + obj.radius),
          obj.radius
        ).layer(layerName)
      );
    } else if (obj.type === 'polyline') {
      const pts = obj.points.map((p: any) => point(p.x, p.y));
      writer.addPolyline(polyline(pts).layer(layerName));
    }
  });

  // Export
  const dxfContent = writer.stringify();
  downloadFile(dxfContent, `${fileName || 'drawing'}.dxf`, 'application/dxf');
}
```

**Recommandation** : **@tarikjabiri/dxf** pour sa modernité et son support TypeScript.

#### Option 3 : SVG → DXF (approche hybride)

**Concept** : Utiliser Fabric.js pour exporter en SVG, puis convertir SVG → DXF via API backend.

**Avantages** :
- Fabric.js supporte nativement SVG export
- Conversion SVG → DXF bien documentée

**Inconvénients** :
- Nécessite un backend
- Perte possible de métadonnées (calques, etc.)

**Code** :

```typescript
async function exportViaSVG() {
  // Export SVG
  const svg = fabricCanvas.toSVG();

  // Envoyer au backend pour conversion
  const response = await fetch('http://localhost:3001/api/convert/svg-to-dxf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ svg, layers })
  });

  const blob = await response.blob();
  downloadFile(blob, 'drawing.dxf', 'application/dxf');
}
```

**Backend (Node.js + Vector Express API)** :

Utiliser l'API Vector Express : https://vector.express/

**Référence** :
- [Canvas-based SVG to DXF](https://dev.to/franksandqvist/making-a-canvas-based-svg-designer-app-that-exports-dxf-files-for-manufacturing-4gjo)

### 4.2 Gestion des coordonnées monde dans DXF

**Important** : Si l'image est géoréférencée, tu dois exporter en coordonnées MN95 réelles.

```typescript
function exportGeoreferencedDXF() {
  const writer = new DxfWriter();

  layers.forEach(layer => writer.addLayer(layer.name, layer.color));

  fabricCanvas.getObjects().forEach((obj: any) => {
    const layerName = obj.data?.layer || '0';

    // Convertir coords canvas → monde
    const toWorld = (canvasX: number, canvasY: number) => {
      // Si image géoréférencée, appliquer transformation affine
      if (selectedImage?.isGeoreferenced && selectedImage.transform) {
        return applyAffineTransform(canvasX, canvasY, selectedImage.transform);
      }
      // Sinon, coordonnées canvas relatives
      return {
        worldX: canvasX + viewCenter.x,
        worldY: viewCenter.y - canvasY
      };
    };

    if (obj.type === 'line') {
      const p1 = toWorld(obj.x1, obj.y1);
      const p2 = toWorld(obj.x2, obj.y2);

      writer.addLine(
        line(point(p1.worldX, p1.worldY), point(p2.worldX, p2.worldY))
          .layer(layerName)
      );
    }
    // ... autres entités
  });

  const dxf = writer.stringify();
  downloadFile(dxf, `${fileName}_MN95.dxf`, 'application/dxf');
}
```

**Références** :
- [dxf-writer NPM](https://www.npmjs.com/package/dxf-writer)
- [@tarikjabiri/dxf](https://dxf.vercel.app/)
- [GitHub dxfjs/writer](https://github.com/dxfjs/writer)

---

## 5. Transformation de coordonnées (World ↔ Canvas)

### 5.1 Problème actuel

Le code actuel utilise `viewportTransform` de Fabric.js (ligne 278) pour la conversion, mais ça ne gère pas les transformations affines personnalisées.

### 5.2 Solution recommandée

**Créer des fonctions dédiées** :

```typescript
// Canvas → Monde (sans géoréférencement)
function canvasToWorld(canvasX: number, canvasY: number): { x: number; y: number } {
  const scale = fabricCanvas.getZoom();
  const vpt = fabricCanvas.viewportTransform;

  return {
    x: (canvasX - vpt[4]) / scale + viewCenter.x,
    y: viewCenter.y - (canvasY - vpt[5]) / scale
  };
}

// Monde → Canvas (sans géoréférencement)
function worldToCanvas(worldX: number, worldY: number): { x: number; y: number } {
  const scale = fabricCanvas.getZoom();
  const vpt = fabricCanvas.viewportTransform;

  return {
    x: (worldX - viewCenter.x) * scale + vpt[4],
    y: (viewCenter.y - worldY) * scale + vpt[5]
  };
}

// Image → Monde (AVEC géoréférencement)
function imageToWorld(
  imageX: number,
  imageY: number,
  transform: AffineTransform
): { x: number; y: number } {
  return {
    x: transform.a0 + transform.a1 * imageX + transform.a2 * imageY,
    y: transform.b0 + transform.b1 * imageX + transform.b2 * imageY
  };
}

// Monde → Image (inverse affine)
function worldToImage(
  worldX: number,
  worldY: number,
  transform: AffineTransform
): { x: number; y: number } {
  const inv = computeInverseAffineTransform(transform);
  return imageToWorld(worldX, worldY, inv);
}
```

---

## 6. Recommandations finales

### 6.1 Packages NPM à ajouter

```bash
# Pour transformation affine (calculs matriciels)
npm install ml-matrix

# Pour export DXF moderne
npm install @tarikjabiri/dxf

# (Optionnel) Pour validation de géométries
npm install @turf/turf
```

### 6.2 Structure de fichiers proposée

```
src/lib/components/CAD/
├── CADModule.svelte              # Main component (existant)
├── utils/
│   ├── affineTransform.ts        # Fonctions transformation affine
│   ├── coordinateConversion.ts   # World ↔ Canvas conversions
│   ├── dxfExporter.ts            # Export DXF
│   ├── snapping.ts               # Logique snap
│   └── drawingTools.ts           # Outils de dessin
├── components/
│   ├── GeoreferencingPanel.svelte  # UI calage
│   ├── LayerStylePanel.svelte      # UI styles calques
│   └── DrawingToolbar.svelte       # Barre outils dessin
└── types/
    └── cad.types.ts              # Interfaces TypeScript
```

### 6.3 Prochaines étapes recommandées

1. **Améliorer géoréférencement** :
   - Implémenter transformation affine 6 paramètres
   - Ajouter validation coords MN95
   - Export worldfile (.pgw)

2. **Outils dessin** :
   - Ligne, polyligne, rectangle, cercle
   - Snapping (grille + objets)
   - Undo/Redo

3. **Export DXF** :
   - Installer @tarikjabiri/dxf
   - Implémenter export avec coords géoréférencées
   - Tester import dans QGIS/AutoCAD

4. **Optimisation** :
   - Refactoring en modules séparés
   - Tests unitaires (transformations)
   - Documentation utilisateur

### 6.4 Ressources et références

**Fabric.js** :
- [Fabric.js Transformations](https://fabricjs.com/docs/transformations/)
- [Custom controls API](https://fabricjs.com/docs/old-docs/control-api/)
- [Snapping demo](https://jsfiddle.net/fabricjs/S9sLu)

**Géoréférencement** :
- [Swisstopo Transformations](https://www.swisstopo.admin.ch/fr/transformations-3d-planimetrie)
- [EPSG:2056 MN95](https://epsg.io/2056)
- [Affine transformation theory](https://www.esri.com/about/newsroom/app/uploads/2018/07/Understanding-Raster-Georeferencing.pdf)

**Export DXF** :
- [@tarikjabiri/dxf docs](https://dxf.vercel.app/)
- [dxf-writer NPM](https://www.npmjs.com/package/dxf-writer)
- [SVG to DXF workflow](https://dev.to/franksandqvist/making-a-canvas-based-svg-designer-app-that-exports-dxf-files-for-manufacturing-4gjo)

**Snapping** :
- [HackerNoon - Object Snapping](https://hackernoon.com/mastering-object-snapping-in-fabricjs-introducing-the-snappyrect-class)
- [Fabric.js grid examples](https://codepen.io/Ben_Tran/pen/YYYwNL)

---

## 7. Exemples de code complets

### 7.1 Module de transformation affine

Créer `src/lib/components/CAD/utils/affineTransform.ts` :

```typescript
import { Matrix, solve } from 'ml-matrix';

export interface GeorefPoint {
  imageX: number;
  imageY: number;
  worldX: number;
  worldY: number;
}

export interface AffineTransform {
  a0: number; // Translation X
  a1: number; // Scale/rotation X component
  a2: number; // Skew X component
  b0: number; // Translation Y
  b1: number; // Skew Y component
  b2: number; // Scale/rotation Y component
}

export interface TransformResult {
  transform: AffineTransform;
  inverseTransform: AffineTransform;
  rmsError: number;
  residuals: { dx: number; dy: number; dist: number }[];
}

/**
 * Calcule la transformation affine à partir de points de contrôle
 * Minimum 3 points requis
 */
export function computeAffineTransform(points: GeorefPoint[]): TransformResult | null {
  if (points.length < 3) {
    console.error('Minimum 3 points de calage requis');
    return null;
  }

  const n = points.length;

  // Construction du système pour X
  const AX: number[][] = [];
  const BX: number[] = [];

  for (const p of points) {
    AX.push([1, p.imageX, p.imageY]);
    BX.push(p.worldX);
  }

  // Construction du système pour Y
  const AY: number[][] = [];
  const BY: number[] = [];

  for (const p of points) {
    AY.push([1, p.imageX, p.imageY]);
    BY.push(p.worldY);
  }

  try {
    // Résolution par moindres carrés
    const coeffsX = solveLeastSquares(AX, BX);
    const coeffsY = solveLeastSquares(AY, BY);

    const transform: AffineTransform = {
      a0: coeffsX[0],
      a1: coeffsX[1],
      a2: coeffsX[2],
      b0: coeffsY[0],
      b1: coeffsY[1],
      b2: coeffsY[2]
    };

    // Calcul transformation inverse
    const inverseTransform = computeInverseAffineTransform(transform);

    // Calcul résidus
    const residuals = points.map(p => {
      const transformed = applyAffineTransform(p.imageX, p.imageY, transform);
      const dx = transformed.worldX - p.worldX;
      const dy = transformed.worldY - p.worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return { dx, dy, dist };
    });

    // Calcul RMS error
    const sumSquares = residuals.reduce((sum, r) => sum + r.dist * r.dist, 0);
    const rmsError = Math.sqrt(sumSquares / residuals.length);

    return {
      transform,
      inverseTransform,
      rmsError,
      residuals
    };
  } catch (error) {
    console.error('Erreur calcul transformation affine:', error);
    return null;
  }
}

/**
 * Résolution système linéaire par moindres carrés
 * Résout (A^T * A)^-1 * A^T * B
 */
function solveLeastSquares(A: number[][], B: number[]): number[] {
  const matA = new Matrix(A);
  const matB = Matrix.columnVector(B);

  const AtA = matA.transpose().mmul(matA);
  const AtB = matA.transpose().mmul(matB);

  const solution = solve(AtA, AtB);
  return solution.to1DArray();
}

/**
 * Applique la transformation affine image → monde
 */
export function applyAffineTransform(
  imageX: number,
  imageY: number,
  transform: AffineTransform
): { worldX: number; worldY: number } {
  return {
    worldX: transform.a0 + transform.a1 * imageX + transform.a2 * imageY,
    worldY: transform.b0 + transform.b1 * imageX + transform.b2 * imageY
  };
}

/**
 * Calcule la transformation affine inverse (monde → image)
 */
export function computeInverseAffineTransform(t: AffineTransform): AffineTransform {
  const det = t.a1 * t.b2 - t.a2 * t.b1;

  if (Math.abs(det) < 1e-10) {
    throw new Error('Transformation affine singulière (déterminant nul)');
  }

  return {
    a0: (t.a2 * t.b0 - t.a0 * t.b2) / det,
    a1: t.b2 / det,
    a2: -t.a2 / det,
    b0: (t.a0 * t.b1 - t.a1 * t.b0) / det,
    b1: -t.b1 / det,
    b2: t.a1 / det
  };
}

/**
 * Valide les coordonnées MN95 (EPSG:2056)
 */
export function validateMN95Coords(e: number, n: number): boolean {
  const E_MIN = 2480000;
  const E_MAX = 2840000;
  const N_MIN = 1070000;
  const N_MAX = 1300000;

  if (e < E_MIN || e > E_MAX || n < N_MIN || n > N_MAX) {
    console.warn(`Coordonnées MN95 hors limites: E=${e}, N=${n}`);
    return false;
  }

  return true;
}

/**
 * Export worldfile (format .pgw pour PNG, .tfw pour TIFF)
 * Format: 6 lignes
 * 1: pixel size X
 * 2: rotation (généralement 0)
 * 3: rotation (généralement 0)
 * 4: pixel size Y (négatif)
 * 5: X coord of upper-left pixel
 * 6: Y coord of upper-left pixel
 */
export function generateWorldfile(
  transform: AffineTransform,
  imageWidth: number,
  imageHeight: number
): string {
  // Pour transformation affine simple sans rotation significative
  const pixelSizeX = transform.a1;
  const pixelSizeY = transform.b2;
  const rotationX = transform.a2;
  const rotationY = transform.b1;

  // Coords du pixel (0,0) = coin supérieur gauche
  const upperLeftX = transform.a0;
  const upperLeftY = transform.b0;

  return [
    pixelSizeX.toFixed(10),
    rotationY.toFixed(10),
    rotationX.toFixed(10),
    pixelSizeY.toFixed(10),
    upperLeftX.toFixed(10),
    upperLeftY.toFixed(10)
  ].join('\n');
}
```

### 7.2 Module export DXF

Créer `src/lib/components/CAD/utils/dxfExporter.ts` :

```typescript
import { DxfWriter, point, line, polyline, circle, arc, Layer } from '@tarikjabiri/dxf';
import type { AffineTransform } from './affineTransform';
import { applyAffineTransform } from './affineTransform';

export interface ExportOptions {
  includeGeoreference: boolean;
  transform?: AffineTransform;
  viewCenter: { x: number; y: number };
}

export function exportFabricCanvasToDXF(
  fabricCanvas: any,
  layers: any[],
  options: ExportOptions,
  filename: string
): void {
  const writer = new DxfWriter();

  // Ajouter calques
  layers.forEach(layer => {
    writer.addLayer(layer.name, DxfWriter.ACI.WHITE); // ou mapper couleur
  });

  // Fonction conversion coords
  const convertCoords = (canvasX: number, canvasY: number) => {
    if (options.includeGeoreference && options.transform) {
      // Appliquer transformation affine
      return applyAffineTransform(canvasX, canvasY, options.transform);
    } else {
      // Coordonnées canvas relatives
      return {
        worldX: canvasX + options.viewCenter.x,
        worldY: options.viewCenter.y - canvasY
      };
    }
  };

  // Parcourir objets Fabric.js
  fabricCanvas.getObjects().forEach((obj: any) => {
    const layerName = obj.data?.layer || '0';

    try {
      if (obj.type === 'line') {
        const p1 = convertCoords(obj.x1, obj.y1);
        const p2 = convertCoords(obj.x2, obj.y2);

        writer.addLine(
          line(point(p1.worldX, p1.worldY), point(p2.worldX, p2.worldY))
            .layer(layerName)
        );
      }
      else if (obj.type === 'polyline' || obj.type === 'polygon') {
        const pts = obj.points.map((p: any) => {
          const world = convertCoords(p.x, p.y);
          return point(world.worldX, world.worldY);
        });

        writer.addPolyline(
          polyline(pts)
            .layer(layerName)
            .closed(obj.type === 'polygon')
        );
      }
      else if (obj.type === 'circle') {
        const center = convertCoords(
          obj.left + obj.radius * obj.scaleX,
          obj.top + obj.radius * obj.scaleY
        );
        const radius = obj.radius * obj.scaleX; // Supposer scale uniforme

        writer.addCircle(
          circle(point(center.worldX, center.worldY), radius)
            .layer(layerName)
        );
      }
      else if (obj.type === 'rect') {
        // Rectangle → polyline fermée
        const corners = [
          { x: obj.left, y: obj.top },
          { x: obj.left + obj.width * obj.scaleX, y: obj.top },
          { x: obj.left + obj.width * obj.scaleX, y: obj.top + obj.height * obj.scaleY },
          { x: obj.left, y: obj.top + obj.height * obj.scaleY },
          { x: obj.left, y: obj.top } // Fermer
        ];

        const pts = corners.map(c => {
          const world = convertCoords(c.x, c.y);
          return point(world.worldX, world.worldY);
        });

        writer.addPolyline(
          polyline(pts).layer(layerName).closed(true)
        );
      }
      else {
        console.warn(`Type d'objet non supporté pour export DXF: ${obj.type}`);
      }
    } catch (error) {
      console.error(`Erreur export objet ${obj.type}:`, error);
    }
  });

  // Générer DXF string
  const dxfContent = writer.stringify();

  // Télécharger
  downloadFile(dxfContent, filename, 'application/dxf');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

---

## Conclusion

Ce guide fournit une feuille de route complète pour améliorer le module CAD de GeoMind. Les recommandations sont basées sur :

1. **Analyse du code existant** : Ton implémentation actuelle avec Helmert transform
2. **Recherches approfondies** : Meilleures pratiques Fabric.js, transformation affine, export DXF
3. **Standards Swiss** : Validation MN95, proj4, worldfile

**Prochaine action recommandée** : Implémenter la transformation affine 6 paramètres pour remplacer Helmert, car elle supportera mieux les distorsions des plans scannés.

Marc, tu veux que je commence par implémenter une de ces fonctionnalités ? Ou tu préfères que je sauvegarde ce guide dans ta mémoire ?
