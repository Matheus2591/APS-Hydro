export const colors = {
  navy: '#071C2F',
  navySoft: '#153249',
  blue: '#0A7BC2',
  blueDark: '#075A90',
  sky: '#5CC8FF',
  aqua: '#10B7A2',
  ice: '#EAF7FF',
  canvas: '#F4F7F9',
  surface: '#FFFFFF',
  ink: '#102A3D',
  muted: '#668092',
  line: '#DCE6EC',
  amber: '#F5A524',
  amberSoft: '#FFF4DC',
  red: '#E24B4B',
  redSoft: '#FFE7E7',
  green: '#159D73',
  greenSoft: '#E2F7EF',
  white: '#FFFFFF',
  overlay: 'rgba(7, 28, 47, 0.52)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#092238',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
};

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const },
  h2: { fontSize: 19, lineHeight: 25, fontWeight: '700' as const },
  h3: { fontSize: 16, lineHeight: 21, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '600' as const },
};
