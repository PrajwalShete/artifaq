import { SLOT_ID_LENGTH } from '@artifaq/shared/constants';
import { customAlphabet } from 'nanoid';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const generate = customAlphabet(ALPHABET, SLOT_ID_LENGTH);

export function newSlotId(): string {
  return generate();
}

export function r2KeyFor(slotId: string): string {
  return `artifacts/${slotId}/index.html`;
}

export function metaKeyFor(slotId: string): string {
  return `artifacts/${slotId}/meta.json`;
}
