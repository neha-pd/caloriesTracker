import { wsEmitter } from '../services/wsEmitter.js';
export async function wsRoutes(app) {
    // WebSocket: /ws/log/:logEntryId
    // Client subscribes after uploading image to receive real-time nutrition result
    app.get('/log/:logEntryId', { websocket: true }, (socket, request) => {
        const { logEntryId } = request.params;
        const handler = (data) => {
            if (socket.readyState === socket.OPEN) {
                socket.send(JSON.stringify(data));
            }
        };
        wsEmitter.on(`log:${logEntryId}`, handler);
        app.log.info(`WS client subscribed to log:${logEntryId}`);
        socket.on('close', () => {
            wsEmitter.off(`log:${logEntryId}`, handler);
            app.log.info(`WS client disconnected from log:${logEntryId}`);
        });
        socket.on('error', (err) => {
            app.log.error({ err }, 'WebSocket error');
            wsEmitter.off(`log:${logEntryId}`, handler);
        });
    });
}
//# sourceMappingURL=websocket.js.map