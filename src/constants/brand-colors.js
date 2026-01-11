/**
 * MAB AI Strategies Twitter SEO Agent
 * Brand Colors and Visual Identity
 *
 * These colors are used consistently across the dashboard and any
 * generated visual content.
 */

/**
 * Primary brand colors as hex values
 */
export const COLORS = {
  // Primary background - Deep ocean blue
  oceanBlue: '#0A2540',

  // Cards and panels - Slightly lighter blue
  deepBlue: '#1E3A5F',

  // Accents and highlights - Champagne gold
  champagne: '#D4AF37',

  // Primary text color - Warm cream
  cream: '#F5F5DC',

  // Hover states - Mid-tone ocean
  oceanAccent: '#1A4B7A',

  // Additional utility colors
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6'
};

/**
 * CSS custom properties format
 */
export const CSS_VARIABLES = `
:root {
  --ocean-blue: ${COLORS.oceanBlue};
  --deep-blue: ${COLORS.deepBlue};
  --champagne: ${COLORS.champagne};
  --cream: ${COLORS.cream};
  --ocean-accent: ${COLORS.oceanAccent};
  --success: ${COLORS.success};
  --warning: ${COLORS.warning};
  --error: ${COLORS.error};
  --info: ${COLORS.info};
}
`;

/**
 * Chart.js color configuration
 */
export const CHART_COLORS = {
  primary: COLORS.champagne,
  secondary: COLORS.oceanAccent,
  accent: COLORS.cream,
  background: COLORS.deepBlue,
  border: `${COLORS.champagne}33`, // 20% opacity
  gridLines: `${COLORS.champagne}1A`, // 10% opacity
  gradient: {
    start: COLORS.champagne,
    end: COLORS.cream
  }
};

/**
 * Tailwind CSS color classes (for dashboard)
 */
export const TAILWIND_CLASSES = {
  bgPrimary: 'bg-[#0A2540]',
  bgSecondary: 'bg-[#1E3A5F]',
  textPrimary: 'text-[#F5F5DC]',
  textAccent: 'text-[#D4AF37]',
  borderAccent: 'border-[#D4AF37]',
  hoverBg: 'hover:bg-[#1A4B7A]'
};

/**
 * Gradient configurations
 */
export const GRADIENTS = {
  // Main background gradient
  background: `linear-gradient(135deg, ${COLORS.oceanBlue} 0%, ${COLORS.deepBlue} 100%)`,

  // Card gradient
  card: `linear-gradient(145deg, ${COLORS.deepBlue}, ${COLORS.oceanBlue})`,

  // Text gradient for large numbers
  textGold: `linear-gradient(135deg, ${COLORS.champagne} 0%, ${COLORS.cream} 100%)`,

  // Hover glow effect
  glowGold: `0 0 20px ${COLORS.champagne}66`
};

/**
 * Shadow configurations
 */
export const SHADOWS = {
  card: '0 8px 32px rgba(0, 0, 0, 0.4)',
  cardHover: '0 12px 48px rgba(0, 0, 0, 0.5)',
  goldGlow: `0 0 20px ${COLORS.champagne}66`
};

/**
 * RGB values for programmatic use
 */
export const RGB = {
  oceanBlue: { r: 10, g: 37, b: 64 },
  deepBlue: { r: 30, g: 58, b: 95 },
  champagne: { r: 212, g: 175, b: 55 },
  cream: { r: 245, g: 245, b: 220 },
  oceanAccent: { r: 26, g: 75, b: 122 }
};

/**
 * Convert hex to rgba with opacity
 * @param {string} hex - Hex color code
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} RGBA color string
 */
export function hexToRgba(hex, opacity = 1) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default COLORS;
