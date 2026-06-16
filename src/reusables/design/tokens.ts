/* Design tokens — mirrors webapp/src/reusables/design/theme.css.
 *
 * Two palettes (light + dark). Components consume them via useTheme()
 * which returns the right one based on ThemeProvider's persisted choice. */

export type Theme = "light" | "dark";

export interface Palette {
  // backgrounds
  bg: string;
  bgGradA: string;
  bgGradB: string;
  surface: string;
  surface2: string;
  surface3: string;
  surfaceHover: string;
  input: string;
  border: string;
  border2: string;

  // text
  text: string;
  text2: string;
  text3: string;
  onBrand: string;

  // brand + accents
  brand: string;
  brand600: string;
  brand700: string;
  brandSoft: string;
  brand300: string;
  green: string;
  greenSoft: string;
  gold: string;
  goldSoft: string;
  pink: string;
  pinkSoft: string;
  online: string;

  // shadows
  shadowSm: { color: string; offsetY: number; radius: number; opacity: number };
  shadowMd: { color: string; offsetY: number; radius: number; opacity: number };
  shadowLg: { color: string; offsetY: number; radius: number; opacity: number };

  // rail
  railTop: string;
  railBottom: string;
  railIcon: string;
  railIconActive: string;
  railActiveBg: string;
}

export const radii = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const spacing = {
  railWidth: 76,
  headerHeight: 60,
  bottomNavHeight: 60,
} as const;

export const light: Palette = {
  bg: "#EEF1F5",
  bgGradA: "#EAF0F8",
  bgGradB: "#EEF1F5",
  surface: "#FFFFFF",
  surface2: "#F6F8FB",
  surface3: "#ECEFF3",
  surfaceHover: "#F0F2F6",
  input: "#EEF1F5",
  border: "#E3E6EB",
  border2: "#D7DBE2",

  text: "#14161A",
  text2: "#5B606B",
  text3: "#8B909B",
  onBrand: "#FFFFFF",

  brand: "#1C7DEF",
  brand600: "#1769D1",
  brand700: "#1257B0",
  brandSoft: "#E7F0FE",
  brand300: "#9CC2FF",
  green: "#20BD7C",
  greenSoft: "#E2F7EE",
  gold: "#E69500",
  goldSoft: "#FFF2DB",
  pink: "#FF5B6B",
  pinkSoft: "#FFE6E9",
  online: "#2ECC71",

  shadowSm: { color: "#141E37", offsetY: 1, radius: 3, opacity: 0.06 },
  shadowMd: { color: "#141E37", offsetY: 8, radius: 24, opacity: 0.08 },
  shadowLg: { color: "#141E37", offsetY: 8, radius: 30, opacity: 0.14 },

  railTop: "#1C7DEF",
  railBottom: "#1466CF",
  railIcon: "rgba(255,255,255,0.78)",
  railIconActive: "#1C7DEF",
  railActiveBg: "#FFFFFF",
};

export const dark: Palette = {
  bg: "#0B0E14",
  bgGradA: "#0D1119",
  bgGradB: "#0B0E14",
  surface: "#151A23",
  surface2: "#1B2230",
  surface3: "#222A3A",
  surfaceHover: "#1E2532",
  input: "#1B2230",
  border: "#262F3F",
  border2: "#313C50",

  text: "#E8EBF1",
  text2: "#99A1B1",
  text3: "#6B7488",
  onBrand: "#FFFFFF",

  brand: "#1C7DEF",
  brand600: "#1769D1",
  brand700: "#1257B0",
  brandSoft: "rgba(60,139,255,0.16)",
  brand300: "#9CC2FF",
  green: "#20BD7C",
  greenSoft: "rgba(32,189,124,0.16)",
  gold: "#E69500",
  goldSoft: "rgba(230,149,0,0.16)",
  pink: "#FF5B6B",
  pinkSoft: "rgba(255,91,107,0.16)",
  online: "#2ECC71",

  shadowSm: { color: "#000000", offsetY: 1, radius: 2, opacity: 0.4 },
  shadowMd: { color: "#000000", offsetY: 4, radius: 16, opacity: 0.5 },
  shadowLg: { color: "#000000", offsetY: 12, radius: 40, opacity: 0.6 },

  railTop: "#14233B",
  railBottom: "#0F1A2E",
  railIcon: "rgba(255,255,255,0.62)",
  railIconActive: "#FFFFFF",
  railActiveBg: "rgba(60,139,255,0.22)",
};
