export const DEFAULT_STORES = [
  "Walmart",
  "Target",
  "Publix",
  "Costco",
  "ALDI",
  "Trader Joes",
  "Whole Foods",
  "Winn Dixie",
] as const;

export type DefaultStore = (typeof DEFAULT_STORES)[number];

export interface GroceryListItem {
  id: string;
  item: string;
  type: string;
  quantity: string;
  store: string;
}

export interface StorePriceEntry {
  id: string;
  item: string;
  store: string;
  price: number;
  unitPrice: number;
}
