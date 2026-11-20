import type { FlowerKind } from '../greetings/flowers';

/** Local demo state only. One serialized value owns stock, carried flowers and plots. */
export const REFILL_MS = 60_000;
export const STOCK_PER_KIND = 16;
export const MAX_BASKET = 5;
export const PLANT_SLOTS = 24;
export const FLOWER_KINDS: readonly FlowerKind[] = ['rose', 'daisy', 'sunflower', 'cosmos', 'lavender', 'tulip', 'lotus', 'chrysanthemum', 'bidens'];

export type PlantedBouquet = { flowers: FlowerKind[]; plantedAt: number; operationId: string; signature: string; recipient: string; message: string };
export type FlowerLoopState = {
  version: 1;
  epochStart: number;
  lastNow: number;
  stock: Record<FlowerKind, number>;
  basket: FlowerKind[];
  planted: (PlantedBouquet | null)[];
};
export type FlowerLoopResult = {
  state: FlowerLoopState;
  ok: boolean;
  reason?: 'invalid-flower' | 'basket-full' | 'stock-empty' | 'invalid-index' | 'invalid-slot' | 'invalid-operation' | 'occupied' | 'basket-empty';
  duplicate?: boolean;
  slot?: number;
};

function validTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function isKind(value: unknown): value is FlowerKind {
  return typeof value === 'string' && (FLOWER_KINDS as readonly string[]).includes(value);
}
function flowers(value: unknown): FlowerKind[] {
  return Array.isArray(value) ? value.filter(isKind).slice(0, MAX_BASKET) : [];
}
function operation(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(value);
}
export function flowerLabel(value: unknown): string { return typeof value==='string' ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,60) : ''; }
/** Short wish kept with a planted bouquet; same cleaning as labels, longer limit. */
export function flowerNote(value: unknown): string { return typeof value==='string' ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,240) : ''; }
function fullStock(): Record<FlowerKind, number> {
  return { rose: STOCK_PER_KIND, daisy: STOCK_PER_KIND, sunflower: STOCK_PER_KIND, cosmos: STOCK_PER_KIND, lavender: STOCK_PER_KIND, tulip: STOCK_PER_KIND, lotus: STOCK_PER_KIND, chrysanthemum: STOCK_PER_KIND, bidens: STOCK_PER_KIND };
}
function epoch(now: number): number { return Math.floor(now / REFILL_MS) * REFILL_MS; }

/** Missing/unknown versions migrate only the caller's old basket, never old plot metadata. */
export function createFlowerLoop(now: number, initialBasket: unknown = []): FlowerLoopState {
  const time = validTime(now) ? now : 0;
  const basket = flowers(initialBasket);
  const stock = fullStock();
  for (const kind of basket) stock[kind]--;
  return { version: 1, epochStart: epoch(time), lastNow: time, stock, basket, planted: Array(PLANT_SLOTS).fill(null) };
}

/** Validate persisted data before passing it to the transition functions. Never trust extra fields. */
export function readFlowerLoop(raw: unknown, now: number, initialBasket: unknown = []): FlowerLoopState {
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 1) return createFlowerLoop(now, initialBasket);
  const data = raw as Record<string, unknown>;
  const time = validTime(now) ? now : validTime(data.lastNow) ? data.lastNow : 0;
  // A future saved clock must not leave refill frozen after a device clock correction.
  const lastNow = validTime(data.lastNow) ? Math.min(data.lastNow, time) : time;
  const epochStart = validTime(data.epochStart) && data.epochStart % REFILL_MS === 0
    ? Math.min(data.epochStart, epoch(lastNow)) : epoch(lastNow);
  const rawStock = data.stock && typeof data.stock === 'object' ? data.stock as Record<string, unknown> : {};
  const stock = fullStock();
  for (const kind of FLOWER_KINDS) {
    const value = rawStock[kind] ?? ((kind!=='rose'&&kind!=='daisy'&&kind!=='sunflower')?STOCK_PER_KIND:undefined);
    stock[kind] = typeof value === 'number' && Number.isSafeInteger(value) ? Math.max(0, Math.min(STOCK_PER_KIND, value)) : 0;
  }
  const used = new Set<string>();
  const planted = Array.from({ length: PLANT_SLOTS }, (_, index): PlantedBouquet | null => {
    const item: unknown = Array.isArray(data.planted) ? data.planted[index] : null;
    if (!item || typeof item !== 'object') return null;
    const value = item as Record<string, unknown>;
    const bouquet = flowers(value.flowers);
    if (!bouquet.length || !operation(value.operationId) || used.has(value.operationId)) return null;
    used.add(value.operationId);
    return { flowers: bouquet, plantedAt: validTime(value.plantedAt) ? Math.min(value.plantedAt, time) : time, operationId: value.operationId, signature: flowerLabel(value.signature) || 'Một người bạn VJU', recipient: flowerLabel(value.recipient), message: flowerNote(value.message) };
  });
  return advanceFlowerLoop({ version: 1, epochStart, lastNow, stock, basket: flowers(data.basket), planted }, time);
}

/** O(1) even after tab sleep: one stock reset, no catch-up loop or extra flowers. */
export function advanceFlowerLoop(state: FlowerLoopState, now: number): FlowerLoopState {
  const time = validTime(now) ? Math.max(state.lastNow, now) : state.lastNow;
  const nextEpoch = epoch(time);
  if (time === state.lastNow && nextEpoch === state.epochStart) return state;
  return { ...state, lastNow: time, epochStart: nextEpoch, stock: nextEpoch > state.epochStart ? fullStock() : state.stock };
}

export function pickFlower(state: FlowerLoopState, kind: unknown, now: number): FlowerLoopResult {
  const current = advanceFlowerLoop(state, now);
  if (!isKind(kind)) return { state: current, ok: false, reason: 'invalid-flower' };
  if (current.basket.length >= MAX_BASKET) return { state: current, ok: false, reason: 'basket-full' };
  if (current.stock[kind] <= 0) return { state: current, ok: false, reason: 'stock-empty' };
  return { state: { ...current, stock: { ...current.stock, [kind]: current.stock[kind] - 1 }, basket: [...current.basket, kind] }, ok: true };
}

/** Removing flowers discards them; it cannot replenish a bed or alter a planted bouquet. */
export function removeFlower(state: FlowerLoopState, index: number, now: number): FlowerLoopResult {
  const current = advanceFlowerLoop(state, now);
  if (!Number.isInteger(index) || index < 0 || index >= current.basket.length) return { state: current, ok: false, reason: 'invalid-index' };
  return { state: { ...current, basket: current.basket.filter((_, i) => i !== index) }, ok: true };
}

export function clearBasket(state: FlowerLoopState, now: number): FlowerLoopResult {
  const current = advanceFlowerLoop(state, now);
  return { state: current.basket.length ? { ...current, basket: [] } : current, ok: true };
}

/** Caller creates one operationId per planting intent and retains it when retrying. */
export function plantFlowers(state: FlowerLoopState, slot: number, operationId: string, now: number, signature: unknown = '', recipient: unknown = '', message: unknown = ''): FlowerLoopResult {
  const current = advanceFlowerLoop(state, now);
  if (!operation(operationId)) return { state: current, ok: false, reason: 'invalid-operation' };
  const previous = current.planted.findIndex(item => item?.operationId === operationId);
  if (previous >= 0) return { state: current, ok: true, duplicate: true, slot: previous };
  if (!Number.isInteger(slot) || slot < 0 || slot >= PLANT_SLOTS) return { state: current, ok: false, reason: 'invalid-slot' };
  if (current.planted[slot]) return { state: current, ok: false, reason: 'occupied' };
  if (!current.basket.length) return { state: current, ok: false, reason: 'basket-empty' };
  const planted = current.planted.slice();
  planted[slot] = { flowers: [...current.basket], plantedAt: current.lastNow, operationId, signature: flowerLabel(signature) || 'Một người bạn VJU', recipient: flowerLabel(recipient), message: flowerNote(message) };
  return { state: { ...current, basket: [], planted }, ok: true, slot, duplicate: false };
}
