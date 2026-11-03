import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Authoritative shared chart theme config for all NovaShop Admin charts.
 * Reads existing design tokens and updates live when theme toggles with no reload.
 */
export function getChartTheme(isDark = false) {
  if (isDark) {
    return {
      isDark: true,
      grid: '#2D2722',
      axisLabel: '#C4BCB1',
      axisLabelActive: '#FBF9F5',
      guide: '#4A433B',
      primary: '#F0ECE4',
      secondary: '#9E968E',
      netLine: '#F0ECE4',
      grossLine: '#9E968E',
      areaNet: 'rgba(240, 236, 228, 0.06)',
      areaGross: 'rgba(158, 150, 142, 0.04)',
      dotStroke: '#1E1B18',
      tooltipBg: '#282420',
      tooltipBorder: '#4A433B',
      tooltipText: '#FBF9F5',
      tooltipSubtext: '#C4BCB1',
      track: '#2A2622',
    };
  }

  // Light Mode (strictly preserves original appearance)
  return {
    isDark: false,
    grid: '#F0ECE6',
    axisLabel: '#AFA89E',
    axisLabelActive: '#2B2723',
    guide: '#C9C2B8',
    primary: '#1B1816',
    secondary: '#B9B4AD',
    netLine: '#C9C2B8',
    grossLine: '#2B2723',
    areaNet: 'rgba(201, 194, 184, 0.12)',
    areaGross: 'rgba(43, 39, 35, 0.035)',
    dotStroke: '#FFFFFF',
    tooltipBg: '#FFFFFF',
    tooltipBorder: '#E9E3DB',
    tooltipText: '#2B2723',
    tooltipSubtext: '#8A847C',
    track: '#EEE9E2',
  };
}

/**
 * React hook that binds to ThemeContext and returns active chart tokens live.
 */
export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return useMemo(() => getChartTheme(isDark), [isDark]);
}

export default useChartTheme;
