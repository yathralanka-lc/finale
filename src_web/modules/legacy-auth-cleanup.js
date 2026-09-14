const LEGACY_AUTH_KEYS = Object.freeze([
  'yathralanka_pending_users',
  'yathralanka_users',
  'yathralanka_users_db',
  'yathralanka_users_v2',
  'yathralanka_current_user',
  'yathralanka_active_user'
]);

const SENSITIVE_LEGACY_FIELDS = Object.freeze(['password', 'token', 'activationToken', 'resetToken']);

export function removeSensitiveLegacyFields(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(removeSensitiveLegacyFields);

  const cleaned = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (!SENSITIVE_LEGACY_FIELDS.includes(key)) cleaned[key] = removeSensitiveLegacyFields(entry);
  });
  return cleaned;
}

export function scrubLegacyBrowserAuth(storage) {
  if (!storage) return [];
  const changedKeys = [];
  LEGACY_AUTH_KEYS.forEach((key) => {
    const raw = storage.getItem(key);
    if (!raw) return;
    try {
      const serialized = JSON.stringify(removeSensitiveLegacyFields(JSON.parse(raw)));
      if (serialized !== raw) {
        storage.setItem(key, serialized);
        changedKeys.push(key);
      }
    } catch {
      storage.removeItem(key);
      changedKeys.push(key);
    }
  });
  return changedKeys;
}

export { LEGACY_AUTH_KEYS };
