let eventHandler = null;

export function setEventEmitter(handler) {
  eventHandler = handler;
}

export function emitEvent(type, payload = {}) {
  if (eventHandler) {
    eventHandler({ type, ...payload });
    return true;
  }

  return false;
}

export function hasEventEmitter() {
  return !!eventHandler;
}
