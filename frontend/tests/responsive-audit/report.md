# Responsive audit — /new_fp

Pages audited: **13**
Viewports: **8**
Total rows: **104**

## Summary

- Rows with **horizontal overflow**: 0
- Total **tap targets < 44px**: 834
- Total **text < 14px nodes**: 824

## Per-page × viewport matrix (overflow flag)

| Page | mobile-s-iphone-se | mobile-m-iphone-13 | mobile-l-pixel-7 | foldable-zfold-folded | foldable-zfold-open | tablet-s-ipad-mini | tablet-l-ipad-pro | desktop-1440 |
|------|---|---|---|---|---|---|---|---|
| `login` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user-dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user-myprofile-tab` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user-settings-tab` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `profile-edit` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `profile-password` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `units` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `admin-dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `admin-users` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `admin-equipment` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `admin-equipment-tree` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `admin-shift-schedules` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `admin-shift-edit` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Findings per page

### `login`  →  /login
overflow=0  small-targets=56  tiny-text=104  errors=16

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 7 | 13 | 2 |
| mobile-m-iphone-13 | ✓ | 7 | 13 | 2 |
| mobile-l-pixel-7 | ✓ | 7 | 13 | 2 |
| foldable-zfold-folded | ✓ | 7 | 13 | 2 |
| foldable-zfold-open | ✓ | 7 | 13 | 2 |
| tablet-s-ipad-mini | ✓ | 7 | 13 | 2 |
| tablet-l-ipad-pro | ✓ | 7 | 13 | 2 |
| desktop-1440 | ✓ | 7 | 13 | 2 |

<details><summary>Sample small tap targets (mobile-s-iphone-se)</summary>

- `button` (58×30px) — "🇬🇧 EN"
- `a` (64×20px) — "Tillbaka"
- `input` (233×24px) — ""
- `input` (213×24px) — ""
- `a` (86×15px) — "Glömt lösenord?"
- `a` (99×15px) — "info@fpanalyzer.se"

</details>

<details><summary>Sample tiny text (mobile-s-iphone-se)</summary>

- `span` (13px) — "🇬🇧 EN"
- `a` (13px) — "Tillbaka"
- `label` (13px) — "E-post"
- `label` (13px) — "Lösenord"
- `a` (12px) — "Glömt lösenord?"
- `span` (12px) — "Behöver du ett konto? Mejla"

</details>

<details><summary>Errors (16)</summary>

- `mobile-s-iphone-se`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `mobile-s-iphone-se`: console.error: Warning: [antd: Card] `bordered` is deprecated. Please use `variant` instead.
- `mobile-m-iphone-13`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `mobile-m-iphone-13`: console.error: Warning: [antd: Card] `bordered` is deprecated. Please use `variant` instead.
- `mobile-l-pixel-7`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `mobile-l-pixel-7`: console.error: Warning: [antd: Card] `bordered` is deprecated. Please use `variant` instead.
- `foldable-zfold-folded`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `foldable-zfold-folded`: console.error: Warning: [antd: Card] `bordered` is deprecated. Please use `variant` instead.
- `foldable-zfold-open`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `foldable-zfold-open`: console.error: Warning: [antd: Card] `bordered` is deprecated. Please use `variant` instead.

</details>

### `user-dashboard`  →  /dashboard
overflow=0  small-targets=42  tiny-text=112  errors=0

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 6 | 16 | 0 |
| mobile-m-iphone-13 | ✓ | 0 | 0 | 0 |
| mobile-l-pixel-7 | ✓ | 6 | 16 | 0 |
| foldable-zfold-folded | ✓ | 6 | 16 | 0 |
| foldable-zfold-open | ✓ | 6 | 16 | 0 |
| tablet-s-ipad-mini | ✓ | 6 | 16 | 0 |
| tablet-l-ipad-pro | ✓ | 6 | 16 | 0 |
| desktop-1440 | ✓ | 6 | 16 | 0 |

<details><summary>Sample small tap targets (mobile-s-iphone-se)</summary>

- `a` (133×36px) — ""
- `button` (38×38px) — "Open menu"
- `div` (55×22px) — "Startsida"
- `div` (60×22px) — "Min profil"
- `div` (77×22px) — "Inställningar"
- `a` (107×16px) — "info@fpanalyzer.se"

</details>

<details><summary>Sample tiny text (mobile-s-iphone-se)</summary>

- `span` (13px) — "Enheter"
- `span` (13px) — "Flödesupptagning"
- `span` (13px) — "Flödesanalys"
- `span` (13px) — "Resultat"
- `span` (13px) — "Ordrar"
- `span` (13px) — "Byt lösenord"

</details>

### `user-myprofile-tab`  →  /dashboard?tab=myprofile
overflow=0  small-targets=84  tiny-text=42  errors=8

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 12 | 6 | 1 |
| mobile-m-iphone-13 | ✓ | 12 | 6 | 1 |
| mobile-l-pixel-7 | ✓ | 0 | 0 | 1 |
| foldable-zfold-folded | ✓ | 12 | 6 | 1 |
| foldable-zfold-open | ✓ | 12 | 6 | 1 |
| tablet-s-ipad-mini | ✓ | 12 | 6 | 1 |
| tablet-l-ipad-pro | ✓ | 12 | 6 | 1 |
| desktop-1440 | ✓ | 12 | 6 | 1 |

<details><summary>Sample small tap targets (mobile-s-iphone-se)</summary>

- `a` (133×36px) — ""
- `button` (38×38px) — "Open menu"
- `div` (55×22px) — "Startsida"
- `div` (60×22px) — "Min profil"
- `div` (77×22px) — "Inställningar"
- `button` (30×30px) — "English"

</details>

<details><summary>Sample tiny text (mobile-s-iphone-se)</summary>

- `span` (13px) — "Science Park Skövde, Växthuset
Kaplangat"
- `span` (13px) — "+46 (0)70 334 4688"
- `a` (13px) — "info@fpanalyzer.se"
- `span` (12px) — "Copyright ©"
- `span` (12px) — "2026"
- `span` (12px) — "FP Analyzer. Alla rättigheter förbehålln"

</details>

<details><summary>Errors (8)</summary>

- `mobile-s-iphone-se`: console.error: Warning: [antd: Table] `index` parameter of `rowKey` function is deprecated. There is no guarantee that it will work as expected.
- `mobile-m-iphone-13`: console.error: Warning: [antd: Table] `index` parameter of `rowKey` function is deprecated. There is no guarantee that it will work as expected.
- `mobile-l-pixel-7`: console.error: Warning: [antd: Table] `index` parameter of `rowKey` function is deprecated. There is no guarantee that it will work as expected.
- `foldable-zfold-folded`: console.error: Warning: [antd: Table] `index` parameter of `rowKey` function is deprecated. There is no guarantee that it will work as expected.
- `foldable-zfold-open`: console.error: Warning: [antd: Table] `index` parameter of `rowKey` function is deprecated. There is no guarantee that it will work as expected.
- `tablet-s-ipad-mini`: console.error: Warning: [antd: Table] `index` parameter of `rowKey` function is deprecated. There is no guarantee that it will work as expected.
- `tablet-l-ipad-pro`: console.error: Warning: [antd: Table] `index` parameter of `rowKey` function is deprecated. There is no guarantee that it will work as expected.
- `desktop-1440`: console.error: Warning: [antd: Table] `index` parameter of `rowKey` function is deprecated. There is no guarantee that it will work as expected.

</details>

### `user-settings-tab`  →  /dashboard?tab=settings
overflow=0  small-targets=77  tiny-text=42  errors=0

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 11 | 6 | 0 |
| mobile-m-iphone-13 | ✓ | 11 | 6 | 0 |
| mobile-l-pixel-7 | ✓ | 11 | 6 | 0 |
| foldable-zfold-folded | ✓ | 0 | 0 | 0 |
| foldable-zfold-open | ✓ | 11 | 6 | 0 |
| tablet-s-ipad-mini | ✓ | 11 | 6 | 0 |
| tablet-l-ipad-pro | ✓ | 11 | 6 | 0 |
| desktop-1440 | ✓ | 11 | 6 | 0 |

<details><summary>Sample small tap targets (mobile-s-iphone-se)</summary>

- `a` (133×36px) — ""
- `button` (38×38px) — "Open menu"
- `div` (55×22px) — "Startsida"
- `div` (60×22px) — "Min profil"
- `div` (77×22px) — "Inställningar"
- `span` (20×14px) — "⋮⋮"

</details>

<details><summary>Sample tiny text (mobile-s-iphone-se)</summary>

- `span` (13px) — "Science Park Skövde, Växthuset
Kaplangat"
- `span` (13px) — "+46 (0)70 334 4688"
- `a` (13px) — "info@fpanalyzer.se"
- `span` (12px) — "Copyright ©"
- `span` (12px) — "2026"
- `span` (12px) — "FP Analyzer. Alla rättigheter förbehålln"

</details>

### `profile-edit`  →  /profile/edit
overflow=0  small-targets=80  tiny-text=48  errors=0

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 10 | 6 | 0 |
| mobile-m-iphone-13 | ✓ | 10 | 6 | 0 |
| mobile-l-pixel-7 | ✓ | 10 | 6 | 0 |
| foldable-zfold-folded | ✓ | 10 | 6 | 0 |
| foldable-zfold-open | ✓ | 10 | 6 | 0 |
| tablet-s-ipad-mini | ✓ | 10 | 6 | 0 |
| tablet-l-ipad-pro | ✓ | 10 | 6 | 0 |
| desktop-1440 | ✓ | 10 | 6 | 0 |

<details><summary>Sample small tap targets (mobile-s-iphone-se)</summary>

- `a` (133×36px) — ""
- `button` (38×38px) — "Open menu"
- `input` (293×42px) — ""
- `input` (293×42px) — ""
- `input` (293×42px) — ""
- `input` (293×42px) — ""

</details>

<details><summary>Sample tiny text (mobile-s-iphone-se)</summary>

- `span` (13px) — "Science Park Skövde, Växthuset
Kaplangat"
- `span` (13px) — "+46 (0)70 334 4688"
- `a` (13px) — "info@fpanalyzer.se"
- `span` (12px) — "Copyright ©"
- `span` (12px) — "2026"
- `span` (12px) — "FP Analyzer. Alla rättigheter förbehålln"

</details>

### `profile-password`  →  /profile/password
overflow=0  small-targets=63  tiny-text=42  errors=0

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 9 | 6 | 0 |
| mobile-m-iphone-13 | ✓ | 9 | 6 | 0 |
| mobile-l-pixel-7 | ✓ | 9 | 6 | 0 |
| foldable-zfold-folded | ✓ | 9 | 6 | 0 |
| foldable-zfold-open | ✓ | 9 | 6 | 0 |
| tablet-s-ipad-mini | ✓ | 0 | 0 | 0 |
| tablet-l-ipad-pro | ✓ | 9 | 6 | 0 |
| desktop-1440 | ✓ | 9 | 6 | 0 |

<details><summary>Sample small tap targets (mobile-s-iphone-se)</summary>

- `a` (133×36px) — ""
- `button` (38×38px) — "Open menu"
- `input` (249×22px) — ""
- `input` (249×22px) — ""
- `input` (249×22px) — ""
- `button` (110×38px) — "Byt lösenord"

</details>

<details><summary>Sample tiny text (mobile-s-iphone-se)</summary>

- `span` (13px) — "Science Park Skövde, Växthuset
Kaplangat"
- `span` (13px) — "+46 (0)70 334 4688"
- `a` (13px) — "info@fpanalyzer.se"
- `span` (12px) — "Copyright ©"
- `span` (12px) — "2026"
- `span` (12px) — "FP Analyzer. Alla rättigheter förbehålln"

</details>

### `units`  →  /units
overflow=0  small-targets=28  tiny-text=84  errors=8

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 4 | 12 | 1 |
| mobile-m-iphone-13 | ✓ | 4 | 12 | 1 |
| mobile-l-pixel-7 | ✓ | 4 | 12 | 1 |
| foldable-zfold-folded | ✓ | 4 | 12 | 1 |
| foldable-zfold-open | ✓ | 4 | 12 | 1 |
| tablet-s-ipad-mini | ✓ | 0 | 0 | 1 |
| tablet-l-ipad-pro | ✓ | 4 | 12 | 1 |
| desktop-1440 | ✓ | 4 | 12 | 1 |

<details><summary>Sample small tap targets (mobile-s-iphone-se)</summary>

- `a` (133×36px) — ""
- `button` (38×38px) — "Open menu"
- `a` (16×16px) — ""
- `a` (107×16px) — "info@fpanalyzer.se"

</details>

<details><summary>Sample tiny text (mobile-s-iphone-se)</summary>

- `span` (11px) — "3"
- `span` (11px) — "Day"
- `span` (11px) — "s"
- `span` (11px) — "3"
- `span` (11px) — "Day"
- `span` (11px) — "s"

</details>

<details><summary>Errors (8)</summary>

- `mobile-s-iphone-se`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `mobile-m-iphone-13`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `mobile-l-pixel-7`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `foldable-zfold-folded`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `foldable-zfold-open`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `tablet-s-ipad-mini`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `tablet-l-ipad-pro`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `desktop-1440`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.

</details>

### `admin-dashboard`  →  /admin/dashboard
overflow=0  small-targets=48  tiny-text=143  errors=8

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 4 | 17 | 1 |
| mobile-m-iphone-13 | ✓ | 4 | 17 | 1 |
| mobile-l-pixel-7 | ✓ | 4 | 17 | 1 |
| foldable-zfold-folded | ✓ | 4 | 17 | 1 |
| foldable-zfold-open | ✓ | 0 | 0 | 1 |
| tablet-s-ipad-mini | ✓ | 4 | 17 | 1 |
| tablet-l-ipad-pro | ✓ | 14 | 29 | 1 |
| desktop-1440 | ✓ | 14 | 29 | 1 |

<details><summary>Sample small tap targets (mobile-s-iphone-se)</summary>

- `button` (38×38px) — "Toggle navigation"
- `button` (54×30px) — "🇬🇧 EN"
- `input` (192×22px) — ""
- `input` (192×22px) — ""

</details>

<details><summary>Sample tiny text (mobile-s-iphone-se)</summary>

- `span` (13px) — "🇬🇧 EN"
- `span` (12px) — "Administrativ översikt"
- `span` (12px) — "· Europe/Stockholm"
- `div` (13px) — "Flödesuppföljning"
- `div` (13px) — "Produktionsdata"
- `span` (13px) — "poster"

</details>

<details><summary>Errors (8)</summary>

- `mobile-s-iphone-se`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `mobile-m-iphone-13`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `mobile-l-pixel-7`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `foldable-zfold-folded`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `foldable-zfold-open`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `tablet-s-ipad-mini`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `tablet-l-ipad-pro`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.
- `desktop-1440`: console.error: Warning: [antd: Card] `bodyStyle` is deprecated. Please use `styles.body` instead.

</details>

### `admin-users`  →  /admin/access/users
overflow=0  small-targets=209  tiny-text=105  errors=7

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 26 | 11 | 1 |
| mobile-m-iphone-13 | ✓ | 26 | 11 | 1 |
| mobile-l-pixel-7 | ✓ | 26 | 11 | 1 |
| foldable-zfold-folded | ✓ | 26 | 11 | 1 |
| foldable-zfold-open | ✓ | 0 | 0 | 0 |
| tablet-s-ipad-mini | ✓ | 27 | 11 | 1 |
| tablet-l-ipad-pro | ✓ | 39 | 25 | 1 |
| desktop-1440 | ✓ | 39 | 25 | 1 |

<details><summary>Sample small tap targets (mobile-s-iphone-se)</summary>

- `button` (38×38px) — "Toggle navigation"
- `button` (54×30px) — "🇬🇧 EN"
- `button` (111×38px) — "Add New"
- `button` (71×30px) — "All Users"
- `button` (129×30px) — "Deactivated Users"
- `button` (103×30px) — "Deleted Users"

</details>

<details><summary>Sample tiny text (mobile-s-iphone-se)</summary>

- `span` (13px) — "🇬🇧 EN"
- `span` (12px) — "Company"
- `span` (12px) — "Yes"
- `span` (12px) — "User"
- `span` (12px) — "No"
- `span` (12px) — "User"

</details>

<details><summary>Errors (7)</summary>

- `mobile-s-iphone-se`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `mobile-m-iphone-13`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `mobile-l-pixel-7`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `foldable-zfold-folded`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `tablet-s-ipad-mini`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `tablet-l-ipad-pro`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `desktop-1440`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.

</details>

### `admin-equipment`  →  /admin/equipment
overflow=0  small-targets=49  tiny-text=37  errors=21

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 11 | 8 | 1 |
| mobile-m-iphone-13 | ✓ | 11 | 8 | 1 |
| mobile-l-pixel-7 | ✓ | 11 | 8 | 1 |
| foldable-zfold-folded | ✓ | 11 | 8 | 1 |
| foldable-zfold-open | ✓ | 5 | 5 | 7 |
| tablet-s-ipad-mini | ✓ | 0 | 0 | 4 |
| tablet-l-ipad-pro | ✓ | 0 | 0 | 4 |
| desktop-1440 | ✓ | 0 | 0 | 2 |

<details><summary>Sample small tap targets (mobile-s-iphone-se)</summary>

- `button` (38×38px) — "Toggle navigation"
- `button` (54×30px) — "🇬🇧 EN"
- `a` (48×22px) — "Admin"
- `button` (148×38px) — "Add equipment"
- `input` (227×22px) — ""
- `button` (30×30px) — ""

</details>

<details><summary>Sample tiny text (mobile-s-iphone-se)</summary>

- `span` (13px) — "🇬🇧 EN"
- `span` (12px) — "CNC Mill"
- `span` (12px) — "active"
- `span` (12px) — "active"
- `span` (12px) — "Copyright ©"
- `span` (12px) — "2026"

</details>

<details><summary>Errors (21)</summary>

- `mobile-s-iphone-se`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `mobile-m-iphone-13`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `mobile-l-pixel-7`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `foldable-zfold-folded`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `foldable-zfold-open`: console.error: Warning: [antd: Modal] `destroyOnClose` is deprecated. Please use `destroyOnHidden` instead.
- `foldable-zfold-open`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `foldable-zfold-open`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `foldable-zfold-open`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `foldable-zfold-open`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `foldable-zfold-open`: console.error: Failed to load resource: the server responded with a status of 429 ()

</details>

### `admin-equipment-tree`  →  /admin/equipment/tree
overflow=0  small-targets=0  tiny-text=0  errors=30

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 0 | 0 | 4 |
| mobile-m-iphone-13 | ✓ | 0 | 0 | 4 |
| mobile-l-pixel-7 | ✓ | 0 | 0 | 4 |
| foldable-zfold-folded | ✓ | 0 | 0 | 4 |
| foldable-zfold-open | ✓ | 0 | 0 | 4 |
| tablet-s-ipad-mini | ✓ | 0 | 0 | 2 |
| tablet-l-ipad-pro | ✓ | 0 | 0 | 4 |
| desktop-1440 | ✓ | 0 | 0 | 4 |

<details><summary>Errors (30)</summary>

- `mobile-s-iphone-se`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `mobile-s-iphone-se`: console.error: Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/s
- `mobile-s-iphone-se`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `mobile-s-iphone-se`: console.error: Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/s
- `mobile-m-iphone-13`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `mobile-m-iphone-13`: console.error: Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/s
- `mobile-m-iphone-13`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `mobile-m-iphone-13`: console.error: Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/s
- `mobile-l-pixel-7`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `mobile-l-pixel-7`: console.error: Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/s

</details>

### `admin-shift-schedules`  →  /admin/shift-schedules
overflow=0  small-targets=0  tiny-text=0  errors=30

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 0 | 0 | 4 |
| mobile-m-iphone-13 | ✓ | 0 | 0 | 4 |
| mobile-l-pixel-7 | ✓ | 0 | 0 | 4 |
| foldable-zfold-folded | ✓ | 0 | 0 | 4 |
| foldable-zfold-open | ✓ | 0 | 0 | 2 |
| tablet-s-ipad-mini | ✓ | 0 | 0 | 4 |
| tablet-l-ipad-pro | ✓ | 0 | 0 | 4 |
| desktop-1440 | ✓ | 0 | 0 | 4 |

<details><summary>Errors (30)</summary>

- `mobile-s-iphone-se`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `mobile-s-iphone-se`: console.error: Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/s
- `mobile-s-iphone-se`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `mobile-s-iphone-se`: console.error: Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/s
- `mobile-m-iphone-13`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `mobile-m-iphone-13`: console.error: Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/s
- `mobile-m-iphone-13`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `mobile-m-iphone-13`: console.error: Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/s
- `mobile-l-pixel-7`: console.error: Failed to load resource: the server responded with a status of 429 ()
- `mobile-l-pixel-7`: console.error: Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/s

</details>

### `admin-shift-edit`  →  /admin/shift-schedules/4/edit
overflow=0  small-targets=98  tiny-text=65  errors=0

| viewport | overflow | targets<44 | text<14 | errors |
|---|---|---|---|---|
| mobile-s-iphone-se | ✓ | 12 | 7 | 0 |
| mobile-m-iphone-13 | ✓ | 12 | 7 | 0 |
| mobile-l-pixel-7 | ✓ | 12 | 7 | 0 |
| foldable-zfold-folded | ✓ | 12 | 7 | 0 |
| foldable-zfold-open | ✓ | 12 | 7 | 0 |
| tablet-s-ipad-mini | ✓ | 12 | 7 | 0 |
| tablet-l-ipad-pro | ✓ | 0 | 0 | 0 |
| desktop-1440 | ✓ | 26 | 23 | 0 |

<details><summary>Sample small tap targets (mobile-s-iphone-se)</summary>

- `button` (38×38px) — "Toggle navigation"
- `button` (54×30px) — "🇬🇧 EN"
- `a` (38×38px) — ""
- `button` (38×38px) — ""
- `input` (277×42px) — ""
- `input` (277×42px) — ""

</details>

<details><summary>Sample tiny text (mobile-s-iphone-se)</summary>

- `span` (13px) — "🇬🇧 EN"
- `div` (10.1px) — "11:00 - 12:00"
- `div` (11.9px) — "drag-mpb1lmgz"
- `span` (12px) — "Copyright ©"
- `span` (12px) — "2026"
- `span` (12px) — "FP Analyzer. All Rights Reserved."

</details>
