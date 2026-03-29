import { useEffect, useMemo, useState } from "react";
import type { GroceryListItem, StorePriceEntry } from "../types";
import { DEFAULT_STORES } from "../types";
import {
  loadGroceryList,
  loadStorePrices,
  saveGroceryList,
  saveStorePrices,
  setTokenGetter,
} from "../../work/utils/sheetsClient";

interface ShoppingPageProps {
  isAuthenticated: boolean;
  getToken: () => string;
}

const DUMMY_GROCERY_LIST: GroceryListItem[] = [
  { id: "gro-1", item: "Milk", type: "Dairy", quantity: "1 gallon", store: "Walmart" },
  { id: "gro-2", item: "Bananas", type: "Produce", quantity: "6", store: "Publix" },
  { id: "gro-3", item: "Chicken Breast", type: "Protein", quantity: "2 lb", store: "Costco" },
  { id: "gro-4", item: "Rice", type: "Pantry", quantity: "5 lb", store: "ALDI" },
  { id: "gro-5", item: "Spinach", type: "Produce", quantity: "1 bag", store: "Trader Joes" },
];

const DUMMY_STORE_PRICES: StorePriceEntry[] = [
  { id: "pri-1", item: "Milk", store: "Walmart", price: 3.48, unitPrice: 3.48 },
  { id: "pri-2", item: "Milk", store: "Target", price: 3.79, unitPrice: 3.79 },
  { id: "pri-3", item: "Bananas", store: "Publix", price: 0.69, unitPrice: 0.69 },
  { id: "pri-4", item: "Bananas", store: "Whole Foods", price: 0.89, unitPrice: 0.89 },
  { id: "pri-5", item: "Chicken Breast", store: "Costco", price: 9.98, unitPrice: 4.99 },
  { id: "pri-6", item: "Chicken Breast", store: "Winn Dixie", price: 11.18, unitPrice: 5.59 },
  { id: "pri-7", item: "Rice", store: "ALDI", price: 4.25, unitPrice: 0.85 },
  { id: "pri-8", item: "Rice", store: "Walmart", price: 4.69, unitPrice: 0.94 },
  { id: "pri-9", item: "Spinach", store: "Trader Joes", price: 2.49, unitPrice: 2.49 },
  { id: "pri-10", item: "Spinach", store: "Target", price: 2.99, unitPrice: 2.99 },
];

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function ShoppingPage({ isAuthenticated, getToken }: ShoppingPageProps) {
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [groceryItems, setGroceryItems] = useState<GroceryListItem[]>([]);
  const [storePrices, setStorePrices] = useState<StorePriceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newItem, setNewItem] = useState("");
  const [newType, setNewType] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newStore, setNewStore] = useState<string>(DEFAULT_STORES[0]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<GroceryListItem | null>(null);

  const [productFilter, setProductFilter] = useState("");
  const [visibleStores, setVisibleStores] = useState<string[]>(() => [...DEFAULT_STORES]);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      if (!isAuthenticated) {
        setLoading(false);
        setError("Sign in with Google to use Shopping sheet data.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        setTokenGetter(getToken);

        let groceryRows = await loadGroceryList();
        let priceRows = await loadStorePrices();

        if (groceryRows.length === 0) {
          await saveGroceryList(DUMMY_GROCERY_LIST);
          groceryRows = DUMMY_GROCERY_LIST;

          if (priceRows.length === 0) {
            await saveStorePrices(DUMMY_STORE_PRICES);
            priceRows = DUMMY_STORE_PRICES;
          }
        }

        if (!isCancelled) {
          setGroceryItems(groceryRows);
          setStorePrices(priceRows);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load shopping data.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [getToken, isAuthenticated]);

  async function persistGroceryItems(nextItems: GroceryListItem[]): Promise<void> {
    setGroceryItems(nextItems);

    if (!isAuthenticated) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      setTokenGetter(getToken);
      await saveGroceryList(nextItems);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save grocery items.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(item: GroceryListItem): void {
    setEditingId(item.id);
    setEditingDraft({ ...item });
  }

  function cancelEditing(): void {
    setEditingId(null);
    setEditingDraft(null);
  }

  async function saveEditing(): Promise<void> {
    if (!editingId || !editingDraft) {
      return;
    }

    const trimmedItem = editingDraft.item.trim();
    const trimmedType = editingDraft.type.trim();
    const trimmedQuantity = editingDraft.quantity.trim();
    const trimmedStore = editingDraft.store.trim();

    if (!trimmedItem || !trimmedType || !trimmedQuantity || !trimmedStore) {
      return;
    }

    const nextItems = groceryItems.map((item) =>
      item.id === editingId
        ? {
            ...item,
            item: trimmedItem,
            type: trimmedType,
            quantity: trimmedQuantity,
            store: trimmedStore,
          }
        : item,
    );

    await persistGroceryItems(nextItems);
    cancelEditing();
  }

  async function addItem(): Promise<void> {
    const item = newItem.trim();
    const type = newType.trim();
    const quantity = newQuantity.trim();
    const store = newStore.trim();

    if (!item || !type || !quantity || !store) {
      return;
    }

    const nextItems = [
      ...groceryItems,
      {
        id: newId("gro"),
        item,
        type,
        quantity,
        store,
      },
    ];

    await persistGroceryItems(nextItems);
    setNewItem("");
    setNewType("");
    setNewQuantity("");
    setNewStore(DEFAULT_STORES[0]);
  }

  async function deleteItem(itemId: string): Promise<void> {
    const nextItems = groceryItems.filter((item) => item.id !== itemId);
    await persistGroceryItems(nextItems);

    if (editingId === itemId) {
      cancelEditing();
    }
  }

  function toggleStore(storeName: string): void {
    setVisibleStores((prev) => {
      if (prev.includes(storeName)) {
        return prev.filter((store) => store !== storeName);
      }
      return [...prev, storeName];
    });
  }

  const filteredItems = useMemo(() => {
    const search = productFilter.trim().toLowerCase();
    const productSet = new Set<string>();

    groceryItems.forEach((row) => productSet.add(row.item));
    storePrices.forEach((row) => productSet.add(row.item));

    return [...productSet]
      .filter((itemName) => itemName.toLowerCase().includes(search))
      .sort((a, b) => a.localeCompare(b));
  }, [groceryItems, productFilter, storePrices]);

  const priceLookup = useMemo(() => {
    const map = new Map<string, StorePriceEntry>();

    storePrices.forEach((entry) => {
      map.set(`${entry.item.toLowerCase()}::${entry.store.toLowerCase()}`, entry);
    });

    return map;
  }, [storePrices]);

  return (
    <section className="cooking-page-content">
      <div className="cooking-section-card">
        <div className="cooking-section-header">
          <h3>Shopping List</h3>
          <button
            type="button"
            className="secondary"
            onClick={() => setIsListCollapsed((prev) => !prev)}
            aria-expanded={!isListCollapsed}
            aria-controls="shopping-list-panel"
          >
            {isListCollapsed ? "Expand" : "Collapse"}
          </button>
        </div>

        {loading ? <p className="muted">Loading shopping data...</p> : null}
        {error ? <p className="muted cooking-error">{error}</p> : null}

        {!isListCollapsed && !loading && (
          <div id="shopping-list-panel" className="shopping-list-panel">
            <div className="shopping-list-add-row">
              <input
                type="text"
                placeholder="Item"
                value={newItem}
                onChange={(event) => setNewItem(event.target.value)}
              />
              <input
                type="text"
                placeholder="Type"
                value={newType}
                onChange={(event) => setNewType(event.target.value)}
              />
              <input
                type="text"
                placeholder="Quantity"
                value={newQuantity}
                onChange={(event) => setNewQuantity(event.target.value)}
              />
              <select value={newStore} onChange={(event) => setNewStore(event.target.value)}>
                {DEFAULT_STORES.map((storeName) => (
                  <option key={storeName} value={storeName}>{storeName}</option>
                ))}
              </select>
              <button type="button" onClick={addItem} disabled={saving}>Add</button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Store</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groceryItems.map((item) => {
                    const isEditing = editingId === item.id && editingDraft !== null;

                    return (
                      <tr key={item.id}>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingDraft.item}
                              onChange={(event) =>
                                setEditingDraft((prev) => (prev ? { ...prev, item: event.target.value } : prev))
                              }
                            />
                          ) : (
                            item.item
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingDraft.type}
                              onChange={(event) =>
                                setEditingDraft((prev) => (prev ? { ...prev, type: event.target.value } : prev))
                              }
                            />
                          ) : (
                            item.type
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingDraft.quantity}
                              onChange={(event) =>
                                setEditingDraft((prev) => (prev ? { ...prev, quantity: event.target.value } : prev))
                              }
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingDraft.store}
                              onChange={(event) =>
                                setEditingDraft((prev) => (prev ? { ...prev, store: event.target.value } : prev))
                              }
                            />
                          ) : (
                            item.store
                          )}
                        </td>
                        <td>
                          <div className="table-actions">
                            {!isEditing ? (
                              <button
                                type="button"
                                className="icon-button secondary"
                                onClick={() => startEditing(item)}
                                aria-label={`Edit ${item.item}`}
                                title="Edit"
                              >
                                ✏️
                              </button>
                            ) : (
                              <>
                                <button type="button" onClick={saveEditing} disabled={saving}>Save</button>
                                <button type="button" className="secondary" onClick={cancelEditing}>Cancel</button>
                              </>
                            )}
                            <button type="button" className="danger" onClick={() => deleteItem(item.id)} disabled={saving}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="cooking-section-card">
        <div className="cooking-section-header">
          <h3>Store Price Comparison</h3>
        </div>

        <div className="shopping-filters">
          <input
            type="text"
            placeholder="Filter by product"
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value)}
          />
          <div className="shopping-store-filters" role="group" aria-label="Filter stores">
            {DEFAULT_STORES.map((storeName) => (
              <button
                key={storeName}
                type="button"
                className={visibleStores.includes(storeName) ? "active" : "secondary"}
                onClick={() => toggleStore(storeName)}
              >
                {storeName}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="shopping-price-table">
            <thead>
              <tr>
                <th>Item</th>
                {visibleStores.map((storeName) => (
                  <th key={storeName}>{storeName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(2, visibleStores.length + 1)}>
                    No matching products.
                  </td>
                </tr>
              ) : (
                filteredItems.map((itemName) => (
                  <tr key={itemName}>
                    <td>{itemName}</td>
                    {visibleStores.map((storeName) => {
                      const key = `${itemName.toLowerCase()}::${storeName.toLowerCase()}`;
                      const value = priceLookup.get(key);

                      return (
                        <td key={storeName}>
                          {value ? (
                            <div className="shopping-price-cell">
                              <strong>{normalizeMoney(value.price)}</strong>
                              <small>{normalizeMoney(value.unitPrice)} / unit</small>
                            </div>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
