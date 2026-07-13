const prefix = "milk-ledger:";

if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(prefix + key);
      return value == null ? null : { key, value };
    },
    async set(key, value) {
      localStorage.setItem(prefix + key, value);
      return { key, value };
    },
    async delete(key) {
      localStorage.removeItem(prefix + key);
    },
  };
}
