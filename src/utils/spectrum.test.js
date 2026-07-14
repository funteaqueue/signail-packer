import { getSpectrumSegments, wrapSpectrumPosition } from './spectrum';

test('wraps draggable spectrum previews through both edges', () => {
  expect(wrapSpectrumPosition(-7)).toBe(93);
  expect(wrapSpectrumPosition(107)).toBe(7);
});

test('preview preserves the 20/30/50 positive-zone proportions when wrapped', () => {
  const segments = getSpectrumSegments(98, 40);
  const widthFor = multiplier => segments
    .filter(segment => segment.multiplier === multiplier)
    .reduce((sum, segment) => sum + segment.end - segment.start, 0);
  expect(widthFor(1)).toBeCloseTo(8);
  expect(widthFor(0.5)).toBeCloseTo(12);
  expect(widthFor(0.25)).toBeCloseTo(20);
  expect(segments.reduce((sum, segment) => sum + segment.end - segment.start, 0)).toBeCloseTo(100);
});
