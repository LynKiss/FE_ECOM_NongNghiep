import { useState, useEffect, useCallback } from 'react';
import { clientApi } from '../lib/client-api';
import { useClientSession } from './useClientSession';

export type CartItem = {
  id: string;
  productId: string;
  productName: string;
  primaryImageUrl: string | null;
  quantity: number;
  unitPrice: string;
  priceAtAdded: string;
  priceChanged: boolean;
  isUnavailable: boolean;
  stockIssue: 'unavailable' | 'out_of_stock' | 'insufficient_stock' | string | null;
  lineTotal: string;
  availableQuantity: number | null;
};

export type Cart = {
  id: string;
  items: CartItem[];
  totalItems: number;
  totalQuantity: number;
  totalAmount: string;
  cartHash: string;
  validationStatus: 'ok' | 'needs_review' | 'blocked';
};

export type GuestItemMeta = {
  productName: string;
  primaryImageUrl: string | null;
  unitPrice: number;
  availableQuantity: number | null;
};

const GUEST_CART_KEY = 'guest_cart';

function loadGuestItems(): CartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch { return []; }
}

function saveGuestItems(items: CartItem[]) {
  try { localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items)); } catch {}
}

function buildGuestCart(items: CartItem[]): Cart {
  const normalizedItems = items.map((item) => {
    const unitPrice = String(item.unitPrice);
    return {
      ...item,
      unitPrice,
      priceAtAdded: item.priceAtAdded ?? unitPrice,
      priceChanged: Boolean(item.priceChanged),
      isUnavailable: Boolean(item.isUnavailable),
      stockIssue: item.stockIssue ?? null,
      lineTotal: String(Number(unitPrice) * item.quantity),
    };
  });
  const totalAmount = normalizedItems.reduce((s, i) => s + Number(i.lineTotal), 0);
  const totalQuantity = normalizedItems.reduce((s, i) => s + i.quantity, 0);
  const hasBlockedItem = normalizedItems.some((item) => item.isUnavailable || item.stockIssue);
  const hasPriceChange = normalizedItems.some((item) => item.priceChanged);
  const cartHash = `guest:${normalizedItems
    .map((item) => `${item.productId}:${item.quantity}:${item.unitPrice}`)
    .sort()
    .join('|')}`;
  return {
    id: 'guest',
    items: normalizedItems,
    totalItems: normalizedItems.length,
    totalQuantity,
    totalAmount: String(totalAmount),
    cartHash,
    validationStatus: hasBlockedItem ? 'blocked' : hasPriceChange ? 'needs_review' : 'ok',
  };
}

let globalCartListeners = new Set<() => void>();
let globalCart: Cart | null = null;

function emitCartChange() {
  for (const l of globalCartListeners) l();
}

export async function refreshGlobalCart() {
  try {
    const data = await clientApi.get<Cart>('/cart');
    globalCart = data;
  } catch {
    globalCart = null;
  }
  emitCartChange();
}

export function clearGuestCart() {
  localStorage.removeItem(GUEST_CART_KEY);
  globalCart = null;
  emitCartChange();
}

export function useCart() {
  const { session } = useClientSession();
  const [cart, setCart] = useState<Cart | null>(globalCart);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const listener = () => setCart(globalCart);
    globalCartListeners.add(listener);
    return () => { globalCartListeners.delete(listener); };
  }, []);

  const syncGuestCart = useCallback(() => {
    const items = loadGuestItems();
    globalCart = items.length > 0 ? buildGuestCart(items) : null;
    emitCartChange();
  }, []);

  const fetchCart = useCallback(async () => {
    if (!session) {
      syncGuestCart();
      return globalCart;
    }
    setLoading(true);
    try {
      const data = await clientApi.get<Cart>('/cart');
      globalCart = data;
      emitCartChange();
      return data;
    } catch {
      globalCart = null;
      emitCartChange();
      return null;
    } finally {
      setLoading(false);
    }
  }, [session, syncGuestCart]);

  useEffect(() => {
    if (session) {
      if (!globalCart) void fetchCart();
    } else {
      syncGuestCart();
    }
  }, [session, fetchCart, syncGuestCart]);

  const addItem = useCallback(
    async (productId: string, quantity: number, meta?: GuestItemMeta) => {
      if (!session) {
        if (!meta) return;
        const items = loadGuestItems();
        const existing = items.find((i) => i.id === productId);
        if (existing) {
          existing.quantity += quantity;
          existing.lineTotal = String(Number(existing.unitPrice) * existing.quantity);
        } else {
          items.push({
            id: productId, productId,
            productName: meta.productName,
            primaryImageUrl: meta.primaryImageUrl,
            quantity,
            unitPrice: String(meta.unitPrice),
            priceAtAdded: String(meta.unitPrice),
            priceChanged: false,
            isUnavailable: false,
            stockIssue: null,
            lineTotal: String(meta.unitPrice * quantity),
            availableQuantity: meta.availableQuantity,
          });
        }
        saveGuestItems(items);
        globalCart = buildGuestCart(items);
        emitCartChange();
        return;
      }
      await clientApi.post('/cart/items', { productId, quantity });
      await fetchCart();
    },
    [session, fetchCart],
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      if (!session) {
        const items = loadGuestItems();
        if (quantity <= 0) {
          const newItems = items.filter((i) => i.id !== itemId);
          saveGuestItems(newItems);
          globalCart = newItems.length > 0 ? buildGuestCart(newItems) : null;
        } else {
          const item = items.find((i) => i.id === itemId);
          if (item) {
            item.quantity = quantity;
            item.lineTotal = String(Number(item.unitPrice) * quantity);
            saveGuestItems(items);
            globalCart = buildGuestCart(items);
          }
        }
        emitCartChange();
        return;
      }
      await clientApi.patch(`/cart/items/${itemId}`, { quantity });
      await fetchCart();
    },
    [session, fetchCart],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!session) {
        const items = loadGuestItems().filter((i) => i.id !== itemId);
        saveGuestItems(items);
        globalCart = items.length > 0 ? buildGuestCart(items) : null;
        emitCartChange();
        return;
      }
      await clientApi.delete(`/cart/items/${itemId}`);
      await fetchCart();
    },
    [session, fetchCart],
  );

  return { cart, loading, fetchCart, addItem, updateItem, removeItem };
}
