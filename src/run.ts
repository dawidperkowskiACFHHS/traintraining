const adjectives = ['moonlit', 'wandering', 'bramble', 'saffron', 'silver', 'mossy', 'sunlit', 'starlit'];
const nouns = ['getaway', 'sparrow', 'platform', 'lantern', 'compass', 'valley', 'postcard', 'detour'];
export function freshSeed() {
  const values = crypto.getRandomValues(new Uint32Array(3));
  return `${adjectives[values[0] % adjectives.length]}-${nouns[values[1] % nouns.length]}-${values[2].toString(36)}`;
}
