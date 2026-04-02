export const SB = {
  cream: '#FAF7F0',
  creamDeep: '#FFFBF0',
  border: '#E0D8C8',
  borderLight: '#EDE6D6',
  cardShadow: {
    shadowColor: '#8B7A5A',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  teal: '#1D9E75',
  tealLight: '#E1F5EE',
  tealText: '#0F6E56',
  amber: '#E8A020',
  amberLight: '#FAF0D4',
  coral: '#D85A30',
  coralLight: '#FAECE7',
  sage: '#7BAE7F',
  sageLight: '#EDF4EE',
  ink: '#1a1a1a',
  inkMid: '#444',
  inkMuted: '#888',
  inkFaint: '#A08040',
};

export const CARD_ROTATIONS = [-2, 1.5, -1]; // degrees

export function getCardRotation(id: string): number {
  return CARD_ROTATIONS[id.charCodeAt(0) % 3];
}

export const STICKERS = [
  { key: 'star',   label: 'fave',       bg: '#FFF3D6', border: '#F5C842', text: '#8B6A00', fontWeight: '700' },
  { key: 'sunny',  label: 'sunny day',  bg: '#FFFBEF', border: '#F5C842', text: '#A07800', fontWeight: '400' },
  { key: 'heart',  label: 'loved it',   bg: '#FFECEC', border: '#F0A090', text: '#993C1D', fontWeight: '700' },
  { key: 'pinned', label: 'been here',  bg: '#E1F5EE', border: '#1D9E75', text: '#0F6E56', fontWeight: '400' },
  { key: 'farout', label: 'far out',    bg: '#EDF4EE', border: '#7BAE7F', text: '#3B6D11', fontWeight: '400' },
  { key: 'again',  label: 'do it again',bg: '#EEF0FF', border: '#8B8FE8', text: '#3A3DA0', fontWeight: '700' },
  { key: 'wild',   label: 'wild one',   bg: '#FAECE7', border: '#D85A30', text: '#993C1D', fontWeight: '400' },
] as const;
