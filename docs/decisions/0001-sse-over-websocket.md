# ADR-0001: SSE over WebSocket for v1

Date: 2026-06-24  
Status: accepted

## Context

DispatchLab v1 streams courier positions and tracking state from the Go backend to the Angular operator console. The operator does not send commands back in the vertical slice (no reassign, pause, or chat).

## Decision

Use **Server-Sent Events (SSE)** on `GET /api/stream` for all server→client updates. Keep REST endpoints for snapshot reads. Defer WebSocket until bidirectional operator commands are in scope.

## Alternatives considered

- **WebSocket** — rejected for v1; adds connection lifecycle complexity without bidirectional need yet.
- **Polling** — rejected; creates request storms and stale visibility gap under load.
- **Long polling** — rejected; SSE provides simpler auto-reconnect semantics in browsers.

## Consequences

+ `EventSource` auto-reconnect maps cleanly to connected/reconnecting/disconnected UI.
+ HTTP/1.1 friendly; works through many proxies without upgrade headers.
+ Separate from REST snapshot — mirrors DecisionDesk's split between CRUD provider and summary stream.
- No server-initiated binary payloads; JSON text only.
- Bidirectional features require ADR supersession or WebSocket addition.

## References

- [architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)
- `backend/internal/sse/`
- `frontend/src/app/services/dispatch/dispatch-stream.service.ts`
