import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { Expense } from '@/features/expenses/types';
import type { IncomeEntry, WalletTransfer } from '@/features/finance/types';
import { uuid } from './network';

/**
 * Changes made while offline. Each op is applied to what the screens show
 * right away, then sent to the server in order once the connection returns.
 * Records carry an id made on the device, so a retry after a lost response
 * can never create a second copy.
 */
export type OutboxPayload =
  | { kind: 'expense.create'; expense: Expense }
  | { kind: 'expense.update'; expense: Expense }
  | { kind: 'expense.delete'; id: string }
  | { kind: 'income.create'; entry: IncomeEntry }
  | { kind: 'income.delete'; id: string }
  | { kind: 'transfer.create'; transfer: WalletTransfer }
  | { kind: 'transfer.delete'; id: string };

export type OutboxOp = OutboxPayload & {
  opId: string;
  createdAt: string;
  /** How this change moves wallet balances (cents), so balances stay right offline. */
  walletDeltas: Record<string, number>;
};

type State = { userId: string | null; ops: OutboxOp[] };

const storageKey = (userId: string) => `expensense:outbox:v1:${userId}`;
const available = typeof window !== 'undefined';
let state: State = { userId: null, ops: [] };
const listeners = new Set<() => void>();

function emit() { listeners.forEach((listener) => listener()); }
function persist() {
  if (!available || !state.userId) return;
  AsyncStorage.setItem(storageKey(state.userId), JSON.stringify(state.ops)).catch(() => undefined);
}
function setOps(ops: OutboxOp[]) { state = { ...state, ops }; persist(); emit(); }

const recordId = (op: OutboxPayload) =>
  op.kind === 'expense.create' || op.kind === 'expense.update' ? op.expense.id
    : op.kind === 'income.create' ? op.entry.id
      : op.kind === 'transfer.create' ? op.transfer.id
        : op.id;
const family = (op: OutboxPayload) => op.kind.split('.')[0];

function addDeltas(target: Record<string, number>, source: Record<string, number>) {
  const next = { ...target };
  Object.entries(source).forEach(([walletId, cents]) => {
    next[walletId] = (next[walletId] ?? 0) + cents;
    if (next[walletId] === 0) delete next[walletId];
  });
  return next;
}

/** Loads the signed-in user's queue. A different user never sees another's pending changes. */
export async function loadOutbox(userId: string | null) {
  if (state.userId === userId) return;
  state = { userId, ops: [] };
  emit();
  if (!userId || !available) return;
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (state.userId === userId) setOps(raw ? (JSON.parse(raw) as OutboxOp[]) : []);
  } catch {
    // An unreadable queue is treated as empty rather than blocking the app.
  }
}

export function enqueue(payload: OutboxPayload, walletDeltas: Record<string, number>) {
  const id = recordId(payload);
  const kindFamily = family(payload);
  const related = state.ops.filter((op) => family(op) === kindFamily && recordId(op) === id);
  const others = state.ops.filter((op) => !related.includes(op));
  const pendingCreate = related.find((op) => op.kind.endsWith('.create'));
  const foldedDeltas = related.reduce((sum, op) => addDeltas(sum, op.walletDeltas), walletDeltas);

  if (payload.kind.endsWith('.delete') && pendingCreate) {
    // Created and deleted while offline: the server never needs to hear about it.
    setOps(others);
    return;
  }
  if (payload.kind === 'expense.update' && pendingCreate) {
    // Editing something not yet uploaded just changes what will be uploaded.
    setOps([...others, { ...pendingCreate, expense: payload.expense, walletDeltas: foldedDeltas } as OutboxOp]);
    return;
  }
  setOps([...others, { ...payload, opId: uuid(), createdAt: new Date().toISOString(), walletDeltas: foldedDeltas } as OutboxOp]);
}

export function getOutbox() { return state.ops; }

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const snapshot = () => state.ops;

/** Pending changes, re-rendering whenever the queue changes. */
export function useOutbox() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export type FlushOutcome = 'done' | 'offline' | 'failed';
export type FlushResult = { synced: number; dropped: string[]; stoppedOffline: boolean };

let flushing: Promise<FlushResult> | null = null;

/**
 * Sends pending changes in order. Stops at the first network failure (the rest
 * waits for the next attempt); a change the server rejects is dropped and
 * reported, so one bad change can never block everything behind it.
 */
export function flushOutbox(execute: (op: OutboxOp) => Promise<{ outcome: FlushOutcome; message?: string }>): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { synced: 0, dropped: [], stoppedOffline: false };
    const userId = state.userId;
    while (state.userId === userId && state.ops.length) {
      const op = state.ops[0];
      const { outcome, message } = await execute(op);
      if (state.userId !== userId) break;
      if (outcome === 'offline') { result.stoppedOffline = true; break; }
      if (outcome === 'done') result.synced += 1;
      else result.dropped.push(message ?? 'A change could not be saved.');
      setOps(state.ops.filter((item) => item.opId !== op.opId));
    }
    return result;
  })().finally(() => { flushing = null; });
  return flushing;
}

/** Applies pending changes to a server list so screens show them immediately. */
export function applyOps<T extends { id: string }>(items: T[], ops: OutboxOp[], familyName: 'expense' | 'income' | 'transfer', pick: (op: OutboxOp) => T | null): T[] {
  let next = items;
  ops.forEach((op) => {
    if (family(op) !== familyName) return;
    const id = recordId(op);
    if (op.kind.endsWith('.delete')) { next = next.filter((item) => item.id !== id); return; }
    const record = pick(op);
    if (!record) return;
    next = next.some((item) => item.id === id) ? next.map((item) => item.id === id ? record : item) : [record, ...next];
  });
  return next;
}

/** Net balance change per wallet from everything still waiting to sync. */
export function pendingWalletDeltas(ops: OutboxOp[]) {
  return ops.reduce<Record<string, number>>((sum, op) => addDeltas(sum, op.walletDeltas), {});
}
