/**
 * Portion units shared by the picker and every place a logged portion is shown.
 * Stored serving_unit keys: 'serving' (one whole serving, shown as "serve"),
 * 'grams', 'piece', 'oz', or a food's own unit (e.g. 'cup').
 */

const trim = (n: number) => String(+n.toFixed(2));

/** "150 g", "2 pieces", "1 serve", "1.5 oz", "0.5 cup". */
export function formatPortion(quantity: number | string, servingUnit: string | null | undefined) {
  const n = Number(quantity) || 0;
  const qty = trim(n);
  switch (servingUnit || 'serving') {
    case 'g':
    case 'gram':
    case 'grams':
      return `${qty} g`;
    case 'serving':
      return `${qty} serve${n === 1 ? '' : 's'}`;
    case 'piece':
      return `${qty} piece${n === 1 ? '' : 's'}`;
    default:
      return `${qty} ${servingUnit}`;
  }
}
