export interface Appearance {
  skinTone: number;
  hairstyle: number;
  hairColor: number;
  shirtColor: number;
  trousersColor: number;
  accessory: number;
}
export const APPEARANCE_KEY = 'last-stop-appearance-v1';
export const APPEARANCE_OPTIONS = {
  skinTone: [
    { label: 'Porcelain', color: '#f4d6bd' },
    { label: 'Peach', color: '#e2ba85' },
    { label: 'Honey', color: '#c78e62' },
    { label: 'Copper', color: '#a96f4c' },
    { label: 'Umber', color: '#7b4b38' },
    { label: 'Ebony', color: '#4c302b' },
  ],
  hairstyle: [
    { label: 'Crop' },
    { label: 'Side part' },
    { label: 'Curls' },
    { label: 'Bob' },
    { label: 'Ponytail' },
  ],
  hairColor: [
    { label: 'Espresso', color: '#38322e' },
    { label: 'Chestnut', color: '#704b38' },
    { label: 'Auburn', color: '#a25a3c' },
    { label: 'Golden', color: '#d5ae62' },
    { label: 'Silver', color: '#b7c4cf' },
    { label: 'Plum', color: '#775680' },
  ],
  shirtColor: [
    { label: 'Apricot', color: '#db9763' },
    { label: 'Cobalt', color: '#527ed0' },
    { label: 'Teal', color: '#4e9894' },
    { label: 'Fern', color: '#71975b' },
    { label: 'Berry', color: '#b45b6d' },
    { label: 'Violet', color: '#9974b4' },
    { label: 'Cloud', color: '#dae2df' },
    { label: 'Sunflower', color: '#d3b254' },
  ],
  trousersColor: [
    { label: 'Slate', color: '#344f51' },
    { label: 'Denim', color: '#354c79' },
    { label: 'Charcoal', color: '#3c3e4d' },
    { label: 'Olive', color: '#586342' },
    { label: 'Walnut', color: '#745541' },
    { label: 'Sand', color: '#b6a078' },
  ],
  accessory: [{ label: 'None' }, { label: 'Cap' }, { label: 'Backpack' }],
} satisfies Record<keyof Appearance, { label: string; color?: string }[]>;
export const APPEARANCE_LABELS: Record<keyof Appearance, string> = {
  skinTone: 'Skin tone',
  hairstyle: 'Hairstyle',
  hairColor: 'Hair color',
  shirtColor: 'Shirt color',
  trousersColor: 'Trousers color',
  accessory: 'Accessory',
};
export const DEFAULT_APPEARANCE: Appearance = {
  skinTone: 1,
  hairstyle: 0,
  hairColor: 0,
  shirtColor: 0,
  trousersColor: 0,
  accessory: 1,
};
export const appearanceFields = Object.keys(APPEARANCE_OPTIONS) as (keyof Appearance)[];
export function normalizeAppearance(value: unknown, fallback = DEFAULT_APPEARANCE): Appearance {
  const source = value && typeof value === 'object' ? (value as Partial<Appearance>) : {};
  const result = { ...fallback };
  for (const key of appearanceFields) {
    const index = source[key];
    if (
      typeof index === 'number' &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < APPEARANCE_OPTIONS[key].length
    )
      result[key] = index;
  }
  return result;
}
export function randomAppearance(): Appearance {
  return Object.fromEntries(
    appearanceFields.map((key) => [key, Math.floor(Math.random() * APPEARANCE_OPTIONS[key].length)]),
  ) as unknown as Appearance;
}
