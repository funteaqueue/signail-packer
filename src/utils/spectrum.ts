export type SpectrumMultiplier = 1 | 0.5 | 0.25 | -0.25 | -0.5 | -1;

export interface SpectrumSegment {
  start: number;
  end: number;
  multiplier: SpectrumMultiplier;
  color: string;
  label: string;
}

export const SPECTRUM_ZONE_COLORS: Record<string, string> = {
  '1': '#22c55e',
  '0.5': '#84cc16',
  '0.25': '#d4d84f',
  '-0.25': '#facc15',
  '-0.5': '#f97316',
  '-1': '#ef4444',
};

const LABELS: Record<string, string> = {
  '1': '+100%',
  '0.5': '+50%',
  '0.25': '+25%',
  '-0.25': '-25%',
  '-0.5': '-50%',
  '-1': '-100%',
};

export const wrapSpectrumPosition = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return ((value % 100) + 100) % 100;
};

export const clampSpectrumRange = (value: number): number => {
  if (!Number.isFinite(value)) return 20;
  return Math.min(50, Math.max(1, value));
};

const bands = (rangeValue: number): Array<{ inner: number; outer: number; multiplier: SpectrumMultiplier }> => {
  const range = clampSpectrumRange(rangeValue);
  const positiveRadius = range / 2;
  const negativeWidth = (50 - positiveRadius) / 3;
  return [
    { inner: 0, outer: range * 0.10, multiplier: 1 },
    { inner: range * 0.10, outer: range * 0.25, multiplier: 0.5 },
    { inner: range * 0.25, outer: positiveRadius, multiplier: 0.25 },
    { inner: positiveRadius, outer: positiveRadius + negativeWidth, multiplier: -0.25 },
    { inner: positiveRadius + negativeWidth, outer: positiveRadius + negativeWidth * 2, multiplier: -0.5 },
    { inner: positiveRadius + negativeWidth * 2, outer: 50, multiplier: -1 },
  ];
};

const split = (
  start: number,
  end: number,
  multiplier: SpectrumMultiplier,
): SpectrumSegment[] => {
  const length = end - start;
  if (length <= 0) return [];
  const normalizedStart = wrapSpectrumPosition(start);
  const normalizedEnd = normalizedStart + length;
  const meta = {
    multiplier,
    color: SPECTRUM_ZONE_COLORS[String(multiplier)],
    label: LABELS[String(multiplier)],
  };
  if (normalizedEnd <= 100) return [{ start: normalizedStart, end: normalizedEnd, ...meta }];
  return [
    { start: normalizedStart, end: 100, ...meta },
    { start: 0, end: normalizedEnd - 100, ...meta },
  ];
};

export const getSpectrumSegments = (targetValue: number, rangeValue: number): SpectrumSegment[] => {
  const target = wrapSpectrumPosition(targetValue);
  const result: SpectrumSegment[] = [];
  bands(rangeValue).forEach(({ inner, outer, multiplier }) => {
    if (inner === 0) {
      result.push(...split(target - outer, target + outer, multiplier));
    } else {
      result.push(...split(target - outer, target - inner, multiplier));
      result.push(...split(target + inner, target + outer, multiplier));
    }
  });
  return result.filter(item => item.end - item.start > 0.000001).sort((a, b) => a.start - b.start);
};
