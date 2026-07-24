/** Broadcast menu mutations to public clients + admin rooms */
export function createRealtime(io) {
  return {
    menuChanged(event, payload = {}) {
      const msg = { event, at: new Date().toISOString(), ...payload };
      io.emit('menu:changed', msg);
    },
  };
}
