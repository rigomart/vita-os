import { platformCrypto } from "./platform-crypto";

/**
 * Identity for a newly created record.
 *
 * An ID is opaque — nothing reads it — with one exception that matters: reads
 * order by timestamp and break ties on the ID, so two records written in the same
 * millisecond must come back in the order they were written. Convex got that from
 * its own insertion order; here the ID carries it.
 *
 * The shape is a 48-bit millisecond timestamp followed by 80 bits of randomness,
 * both in Crockford base32, which sorts lexicographically in time order. Within
 * one millisecond the random part is incremented rather than redrawn, so a
 * Thread change writing several Activity Log entries keeps them in order.
 */
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

let lastTime = -1;
let lastRandom: number[] = [];

function randomCharacters(): number[] {
  const bytes = platformCrypto().getRandomValues(new Uint8Array(RANDOM_LENGTH));
  return Array.from(bytes, (byte) => byte % ENCODING.length);
}

/** The next value after this one, so same-millisecond IDs keep ascending. */
function incremented(characters: number[]): number[] {
  const next = [...characters];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const value = (next[index] ?? 0) + 1;
    if (value < ENCODING.length) {
      next[index] = value;
      return next;
    }
    next[index] = 0;
  }
  // Every position rolled over, which only happens after 32^16 IDs in one
  // millisecond. Starting fresh is the honest answer.
  return randomCharacters();
}

function encodeTime(milliseconds: number): string {
  let remaining = milliseconds;
  let encoded = "";
  for (let index = 0; index < TIME_LENGTH; index += 1) {
    encoded = ENCODING[remaining % ENCODING.length] + encoded;
    remaining = Math.floor(remaining / ENCODING.length);
  }
  return encoded;
}

export function newRecordId(now: number = Date.now()): string {
  if (now === lastTime) {
    lastRandom = incremented(lastRandom);
  } else {
    lastTime = now;
    lastRandom = randomCharacters();
  }

  return encodeTime(now) + lastRandom.map((value) => ENCODING[value]).join("");
}
