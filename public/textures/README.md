# Textures — provenance

Tiling PBR surface maps (normal + roughness, 1k JPG) that give the procedural
night surfaces micro-relief and varied specular under the lighting.

All **CC0** (public domain) from **Poly Haven** (https://polyhaven.com):

| Files | Poly Haven asset | Used by |
|-------|------------------|---------|
| `concrete_nor_gl_1k.jpg`, `concrete_rough_1k.jpg`, `concrete_ao_1k.jpg` | `concrete_floor_02` | Building base + skyline masses |
| `metal_nor_gl_1k.jpg`, `metal_rough_1k.jpg` | `metal_plate` | Frame steel truss |

Maps are normal/roughness **data** (kept in linear color space, never sRGB).
No albedo/diffuse map is used — the dark night `color` is preserved; the maps only
add surface relief + specular variation. KTX2/Basis compression is a later (M8) task.
