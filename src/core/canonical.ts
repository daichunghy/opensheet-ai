import { createHash } from "node:crypto";

function canonicalizeValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not allow non-finite numbers.");
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeValue(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries
      .map(([key, item]) => {
        if (item === undefined) {
          throw new TypeError(`Canonical JSON does not allow undefined at key ${key}.`);
        }
        return `${JSON.stringify(key)}:${canonicalizeValue(item)}`;
      })
      .join(",")}}`;
  }

  throw new TypeError(`Canonical JSON does not support ${typeof value}.`);
}

export function canonicalize(value: unknown): string {
  return canonicalizeValue(value);
}

export function digestJson(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}
