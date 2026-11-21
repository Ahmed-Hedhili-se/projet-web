# Earth textures — credits

| File | Content | Size |
|---|---|---|
| `earth_atmos_2048.webp` | Day map (land + oceans) | 2048 × 1024 |
| `earth_lights_2048.webp` | City lights at night | 2048 × 1024 |
| `earth_clouds_1024.png` | Cloud layer | 1024 × 512 |
| `earth_specular_2048.webp` | Ocean mask (white = water), used for glints | 2048 × 1024 |
| `earth_normal_2048.webp` | Relief (normal map) | 2048 × 1024 |

Source: three.js examples (`examples/textures/planets`, release r170, MIT-licensed repository),
derived from NASA Visible Earth / Blue Marble imagery (public domain).
Stored locally so the site works offline and does not depend on a third-party server.
Converted to WebP to reduce their weight (the cloud layer stays PNG because it uses transparency).
