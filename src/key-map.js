/** Create an internal dictionary that cannot inherit or mutate prototype keys. */
export function createKeyMap() {
  return Object.create(null);
}

/** Copy enumerable own properties into a prototype-safe internal dictionary. */
export function copyKeyMap(source) {
  const target = createKeyMap();
  if (!source || typeof source !== "object") return target;
  for (const key of Object.keys(source)) target[key] = source[key];
  return target;
}

/** Return a conventional plain record while preserving keys such as __proto__. */
export function toPlainRecord(source) {
  return Object.fromEntries(Object.entries(source || {}));
}

/** Merge record-like values without invoking Object.prototype setters. */
export function mergePlainRecords(...sources) {
  const entries = [];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    entries.push(...Object.entries(source));
  }
  return Object.fromEntries(entries);
}

export function hasOwnKey(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}
