# Design Context

## Admin console (`backend/admin-ui`)

- Audience: dispatch operators and system administrators using the local course-demo environment.
- Job: scan order and fleet health, then reach a record-management workflow with minimal navigation.
- Visual language: dark maritime navy surfaces, restrained cyan signals, clear Chinese labels, and high-contrast data typography. Inspired by the supplied logistics dashboard reference without copying its non-existent warehouse or GPS metrics.
- Layout: fixed-width navigation rail on wide screens; compact horizontal navigation on narrow screens; one content canvas with purposeful sections rather than nested cards.
- Tokens: background `#08151c`, surface `#10232d`, raised surface `#17313d`, text `#eaf4f5`, muted `#9ab0b8`, accent `#36d5ce`, warning `#f0b24a`, danger `#f07373`.
- Typography: system Chinese sans-serif for labels and prose; tabular system monospace for quantities and identifiers.
- Runtime owner: `backend/admin-ui/admin.css` is canonical for this independent backend-served surface. The existing Vue frontend has its own runtime styles and remains unchanged.
- Data policy: render only values returned by the existing REST API; do not synthesize warehouse inventory, GPS positions, or financial metrics.

