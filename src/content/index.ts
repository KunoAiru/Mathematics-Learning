import { cardsOf, parseContent } from './parse';
import type { CardDef, Item } from './types';

const files = import.meta.glob('/content/**/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export const ITEMS: Item[] = parseContent(files);
export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const CARDS: CardDef[] = ITEMS.flatMap(cardsOf);
export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));
export const CARDS_BY_ITEM = new Map<string, CardDef[]>();
for (const c of CARDS) {
  const list = CARDS_BY_ITEM.get(c.itemId) ?? [];
  list.push(c);
  CARDS_BY_ITEM.set(c.itemId, list);
}

export const getItem = (id: string): Item => {
  const it = ITEM_BY_ID.get(id);
  if (!it) throw new Error(`unknown item ${id}`);
  return it;
};
