import EventEmitter from 'events';

// Singleton in-process emitter for WebSocket push
// In multi-instance deployments, replace with Redis pub/sub
export const wsEmitter = new EventEmitter();
wsEmitter.setMaxListeners(500);

export default wsEmitter;
