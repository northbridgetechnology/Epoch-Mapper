# Sprites

Epoch-Mapper draws everything in the first-person view as **billboarded pixel
sprites** — the Eye of the Beholder / SMT look. Every enemy and NPC gets its
sprite from the def's `sprite` field, resolved in priority order:

1. **Creator upload** — the field holds a PNG data URI (set via *Upload* in the
   Database editor).
2. **Built-in kind** — the field names one of the built-in sprites
   (e.g. `cr_demon`).
3. **Keyword match** — the field is empty; the enemy/NPC **id and name** are
   matched against keywords (e.g. anything named *Lich* or *Bonewalker* gets
   `cr_skeleton`).
4. **Emoji fallback** — nothing matched; the def's `icon`/`portrait` emoji is
   drawn instead.

## Uploading your own sprite

Use the **Sprite** field on an Enemy or NPC in the Database workspace.
*Upload* accepts a file, *Template* downloads a built-in sprite as an editable
PNG example, *Clear* returns to automatic matching.

Requirements (enforced by the uploader):

| Rule | Value |
|---|---|
| Format | PNG, GIF, or WebP — **transparent background required for a good result**. JPEG is rejected (no alpha channel). |
| Dimensions | Anything; downscaled to **64px on the longest edge** (nearest-neighbour, never upscaled). Author at 32–64px for a crisp result. |
| Stored size | Max **64KB** after encoding (uploads that stay too large after downscaling are rejected). |
| Composition | The sprite is fitted into a square box and **bottom-anchored** — feet should touch the bottom edge of the image. Taller-than-wide reads best for humanoids. |
| Animation | An image **exactly twice as wide as it is tall** is read as a two-frame sheet: left half = frame A, right half = frame B, flipped every 0.45s in game. Any other aspect is a single static frame. |

The *Template* button exports at 8× scale; two-frame built-ins export as a 2:1
sheet — the exact layout the uploader reads back in, so a downloaded template
can be recolored and re-uploaded as-is.

Uploaded sprites live inside the ruleset as data URIs, so they travel with
saved sessions, drafts, and exports — no separate asset files.

## Built-in sprite kinds

Creatures (use these in the Sprite field, or let keyword matching pick one):

`cr_skeleton` `cr_zombie` `cr_slime` `cr_ghost` `cr_imp` `cr_demon` `cr_brute`
`cr_beast` `cr_serpent` `cr_frost` `cr_pumpkin` `cr_angel` `cr_hermit`
`cr_hooded` `cr_guard` — plus the critters `bat` `rat` `spider`.

Dungeon dressing / objects (used by sub-cube decoration and the renderer):

`torch` `sconce` `chandelier` `banner` `chains` `cobweb` `barrel` `crate`
`pillar` `altar` `bones` `stalactite` `chest` `chest_open` `lever_off`
`lever_on` `door_panel`.

## Keyword matching

When the Sprite field is empty, the first regex that matches the def's
lower-cased `id + name` picks the sprite:

| Sprite | Matches |
|---|---|
| `cr_skeleton` | skelet, lich, bone |
| `cr_zombie` | zomb, ghoul, fallen, corpse, dead |
| `cr_slime` | slime, ooze, blob, obariyon |
| `cr_ghost` | ghost, wraith, spirit, phantom, specter, mokoi |
| `cr_imp` | pixie, fairy, fae, imp, lilim, incub, succub, apsaras |
| `cr_demon` | baphomet, minotaur, oni, bicorn, demon, devil, fiend |
| `cr_brute` | ogre, troll, giant, brute, golem |
| `cr_beast` | wolf, garou, hound, beast, dog |
| `cr_serpent` | naga, medusa, snake, serpent, lamia |
| `cr_frost` | frost, ice, snow |
| `cr_pumpkin` | pyro, pumpkin, jack-o, lantern |
| `cr_angel` | angel, seraph, deva |
| `cr_hermit` | hermit, elder, sage, crone, witch |
| `cr_guard` | guard, knight, soldier, warden |
| `cr_hooded` | wander, travel, stranger, rogue, hood |
| `rat` / `bat` / `spider` | rat/rodent, bat, spider/arachn |

NPCs that match nothing fall back to `cr_hooded`; enemies fall back to their
emoji icon.

## For integrators (Epoch)

All helpers are exported from the package barrel:

- `creatureSprite(hint, cx, cy, size, key, opacity?)` — one-stop resolver
  (bitmap → built-in → `null`).
- `pixelSprite` / `pixelSpriteRect` — draw a built-in kind.
- `bitmapSprite` / `isBitmapSprite` / `bitmapFrames` — creator-upload rendering.
- `resolveCreatureSprite(hint)` — resolution without rendering.
- `spriteKinds()` / `hasPixelSprite(kind)` / `spriteAspect(kind)` — library
  introspection.
- `fileToSpriteDataUri(file)` — the upload pipeline (validate → downscale →
  encode, sheet-aware).
- `builtinSpritePng(kind, scale?)` / `downloadSpriteTemplate(kind?)` — template
  export.
