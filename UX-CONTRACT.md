# UX Contract — Backend Admin Console

Scope: the independently served `backend/admin-ui` console at `/admin`. The Vue application under `frontend/` remains unchanged.

- Locale: Simplified Chinese (`zh-CN`); timestamps use the browser's local timezone.
- Source of truth: NestJS REST responses. Dashboard counts and charts are derived from customers, orders, vehicles, drivers, and dispatch tasks returned by the API.
- Navigation: the sidebar switches between overview and independently named management views. Search and filters stay local to the current view; refresh reloads authoritative API state.
- Create/edit: submit only fields supported by the DTOs. API validation and lifecycle rules remain authoritative. Keep the form open and preserve values on failure; close only after server success.
- Delete: ask for explicit confirmation; show the server's conflict message and refresh after successful deletion.
- Lifecycle: order status is controlled by dispatch tasks; active task, vehicle, and driver status transitions follow backend state machines. Never offer illegal transitions.
- Async states: show initial loading, empty, error with retry, and mutation progress. Never substitute fake demo values when an API is unavailable.
- Security boundary: this local course demo has no authentication or role authorization. The admin console must visibly identify that limitation and must not claim production security.
- Accessibility: semantic landmarks and headings, associated form labels, keyboard-operable controls, visible focus, text labels alongside status color, and responsive table overflow.

