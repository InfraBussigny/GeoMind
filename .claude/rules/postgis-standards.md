---
paths: scripts/**/*.sql, **/*postgis*.py, **/*spatial*.py
---

# Standards Requetes Geospatiales

## PostGIS
- Toujours verifier SRID: ST_SRID(geom) = 2056
- Utiliser requetes indexees: WHERE geom && bbox avant operations complexes
- Valider geometries: Inclure WHERE ST_IsValid(geom)
- Documenter SRID attendu en commentaires

## Optimisation
- Utiliser types geometriques specifiques (Point, Polygon) pas Geometry
- Indexer colonnes spatiales: CREATE INDEX idx_geom ON table USING GIST(geom)
- Utiliser ST_DWithin au lieu de ST_Distance pour filtres de distance
- Operations buffer doivent valider SRID input

## Standards Bussigny
- Coordonnees suisses: LV95 (SRID:2056)
- References altitude: LN02 (ancien) -> LHN95 (nouveau)
- Documenter sources donnees et etapes transformation
