# ADR-0003: POA Centro geographic scenario

Date: 2026-06-24  
Status: accepted

## Context

The product narrative targets a fictional **Operador Logístico POA Centro** monitoring last-mile deliveries in a dense urban core. The scenario should feel credible to Brazilian logistics operators without requiring paid map APIs or a routing engine in v1.

## Decision

Anchor simulation to **Centro Histórico, Porto Alegre** using the official SMU/GIS bounding box, real landmark coordinates (Mercado Público, Rua dos Andradas, Usina do Gasômetro, Cais Mauá), and fictional restaurant names on real streets. Couriers follow waypoint polylines inside the bbox; ETAs derive from haversine distance at simulated speed.

## Alternatives considered

- **Generic fictional city** — rejected; weaker product story and portfolio signal.
- **São Paulo centro** — rejected; author is in POA; local landmarks improve demo authenticity.
- **OSRM routing in v1** — rejected; out of scope; adds external dependency and non-deterministic traffic.

## Consequences

+ README and UI reference recognizable POA locations.
+ OpenStreetMap tiles align with scenario coordinates without API keys.
- Straight-line segment movement between waypoints, not road-snapped paths.
- v5 roadmap adds OSRM/GraphHopper when real routing is needed.

## References

- [GIS SMU Centro Histórico PROGR](https://gis-smamus.portoalegre.rs.gov.br/server/rest/services/01_PUBLICACOES/progr_centro_historico/FeatureServer/0)
- `backend/internal/scenario/poa_centro.json`
