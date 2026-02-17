// All internal storage is in mm. These helpers convert for display.

export const UNIT_LABELS = {
  mm: 'mm',
  inches: 'in',
  'ft-in': 'ft-in',
};

export function mmToInches(mm) {
  return mm / 25.4;
}

export function inchesToMm(inches) {
  return inches * 25.4;
}

export function mmToFtIn(mm) {
  const totalInches = mm / 25.4;
  const ft = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { ft, inches };
}

export function ftInToMm(ft, inches = 0) {
  return (ft * 12 + inches) * 25.4;
}

export function formatDimension(mm, unit = 'mm') {
  if (!mm && mm !== 0) return '—';
  switch (unit) {
    case 'inches':
      return `${mmToInches(mm).toFixed(2)} in`;
    case 'ft-in': {
      const { ft, inches } = mmToFtIn(mm);
      return `${ft}'-${inches.toFixed(1)}"`;
    }
    default:
      return `${Math.round(mm)} mm`;
  }
}

export function parseDimension(value, unit = 'mm') {
  const str = String(value).trim();
  if (!str) return 0;

  switch (unit) {
    case 'inches':
      return inchesToMm(parseFloat(str) || 0);
    case 'ft-in': {
      // Accept formats: 2'6" or 2-6 or 2 6
      const match = str.match(/(\d+)['\-\s]+(\d+\.?\d*)/);
      if (match) return ftInToMm(parseInt(match[1]), parseFloat(match[2]));
      return inchesToMm(parseFloat(str) || 0);
    }
    default:
      return parseFloat(str) || 0;
  }
}

export function sqmmToSqft(sqmm) {
  return sqmm / 92903.04;
}

export function formatArea(sqmm, unit = 'mm') {
  if (unit === 'mm') return `${(sqmm / 1e6).toFixed(4)} m²`;
  return `${sqmmToSqft(sqmm).toFixed(2)} sqft`;
}

export function runningFeet(mm) {
  return mm / 304.8;
}
