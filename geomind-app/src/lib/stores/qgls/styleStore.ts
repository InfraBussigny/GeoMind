import { writable, derived } from 'svelte/store';

// Style definition for sketches
export interface SketchStyle {
  // Fill
  fillColor: string;
  fillOpacity: number;

  // Stroke
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  strokeDash: number[]; // Empty for solid, [10,10] for dashed, etc.

  // Point symbol
  pointRadius: number;
  pointShape: 'circle' | 'square' | 'triangle' | 'cross';
}

// Preset styles
export const stylePresets: { name: string; style: SketchStyle }[] = [
  {
    name: 'Cyber Green',
    style: {
      fillColor: '#00ff88',
      fillOpacity: 0.2,
      strokeColor: '#00ff88',
      strokeWidth: 2,
      strokeOpacity: 1,
      strokeDash: [],
      pointRadius: 6,
      pointShape: 'circle'
    }
  },
  {
    name: 'Rouge Servitude',
    style: {
      fillColor: '#ff4444',
      fillOpacity: 0.3,
      strokeColor: '#cc0000',
      strokeWidth: 2,
      strokeOpacity: 1,
      strokeDash: [],
      pointRadius: 6,
      pointShape: 'circle'
    }
  },
  {
    name: 'Bleu Cadastre',
    style: {
      fillColor: '#4488ff',
      fillOpacity: 0.2,
      strokeColor: '#2266cc',
      strokeWidth: 2,
      strokeOpacity: 1,
      strokeDash: [],
      pointRadius: 6,
      pointShape: 'circle'
    }
  },
  {
    name: 'Orange Projet',
    style: {
      fillColor: '#ff9900',
      fillOpacity: 0.25,
      strokeColor: '#ff6600',
      strokeWidth: 2,
      strokeOpacity: 1,
      strokeDash: [10, 5],
      pointRadius: 6,
      pointShape: 'square'
    }
  },
  {
    name: 'Violet Zone',
    style: {
      fillColor: '#9944ff',
      fillOpacity: 0.2,
      strokeColor: '#7722dd',
      strokeWidth: 2,
      strokeOpacity: 1,
      strokeDash: [],
      pointRadius: 6,
      pointShape: 'triangle'
    }
  },
  {
    name: 'Hachuré',
    style: {
      fillColor: '#888888',
      fillOpacity: 0.1,
      strokeColor: '#444444',
      strokeWidth: 1,
      strokeOpacity: 1,
      strokeDash: [4, 4],
      pointRadius: 4,
      pointShape: 'cross'
    }
  }
];

// Default style (Cyber Green)
const defaultStyle: SketchStyle = { ...stylePresets[0].style };

// Current active style
export const currentStyle = writable<SketchStyle>(defaultStyle);

// Recently used colors
export const recentColors = writable<string[]>(['#00ff88', '#ff4444', '#4488ff', '#ff9900', '#9944ff']);

// Actions
export function setStyle(style: Partial<SketchStyle>): void {
  currentStyle.update(s => ({ ...s, ...style }));
}

export function setFillColor(color: string): void {
  currentStyle.update(s => ({ ...s, fillColor: color }));
  addRecentColor(color);
}

export function setStrokeColor(color: string): void {
  currentStyle.update(s => ({ ...s, strokeColor: color }));
  addRecentColor(color);
}

export function setFillOpacity(opacity: number): void {
  currentStyle.update(s => ({ ...s, fillOpacity: Math.max(0, Math.min(1, opacity)) }));
}

export function setStrokeWidth(width: number): void {
  currentStyle.update(s => ({ ...s, strokeWidth: Math.max(0.5, Math.min(20, width)) }));
}

export function setStrokeDash(dash: number[]): void {
  currentStyle.update(s => ({ ...s, strokeDash: dash }));
}

export function setPointRadius(radius: number): void {
  currentStyle.update(s => ({ ...s, pointRadius: Math.max(2, Math.min(20, radius)) }));
}

export function setPointShape(shape: SketchStyle['pointShape']): void {
  currentStyle.update(s => ({ ...s, pointShape: shape }));
}

export function applyPreset(presetName: string): void {
  const preset = stylePresets.find(p => p.name === presetName);
  if (preset) {
    currentStyle.set({ ...preset.style });
  }
}

export function resetStyle(): void {
  currentStyle.set({ ...defaultStyle });
}

function addRecentColor(color: string): void {
  recentColors.update(colors => {
    const filtered = colors.filter(c => c !== color);
    return [color, ...filtered].slice(0, 8);
  });
}

// Stroke dash presets
export const strokeDashPresets = [
  { name: 'Solide', dash: [] },
  { name: 'Pointillé', dash: [4, 4] },
  { name: 'Tirets', dash: [10, 5] },
  { name: 'Tirets longs', dash: [20, 10] },
  { name: 'Point-tiret', dash: [10, 5, 2, 5] }
];
