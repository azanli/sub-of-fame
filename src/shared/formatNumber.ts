export const formatCompactNumber = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const compact = value / 1_000_000;
    return `${compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const compact = value / 1_000;
    return `${compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1)}k`;
  }
  return value.toLocaleString();
};
