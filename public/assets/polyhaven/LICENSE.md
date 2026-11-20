# Surface assets — Poly Haven, CC0 1.0

- Leafy Grass: https://polyhaven.com/a/leafy_grass — Rob Tuytel.
- Asphalt 02: https://polyhaven.com/a/asphalt_02 — Rob Tuytel.
- Pavement 03: https://polyhaven.com/a/pavement_03 — Charlotte Baglioni (photography), Dario Barresi (processing).

- Painted Plaster Wall: https://polyhaven.com/a/painted_plaster_wall - Amal Kumar. Added 2026-11-17; colour 1024px, normal/roughness 512px.

License: https://polyhaven.com/license
CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/legalcode

Downloaded 2026-11-15 from the official Poly Haven API/download service.
`sources.json` records original URLs/checksums and the locally served derivatives.
Colour images were converted to WebP 1024px; normal/roughness maps to WebP 512px.
No network requests to the provider are made by the running application.
Original JPGs are retained locally in `.local/asset-sources/polyhaven`, outside the build.

Reproduce: `node scripts/fetch-surface-assets.mjs`, then
`python scripts/prepare-surface-assets.py` (Pillow required).
