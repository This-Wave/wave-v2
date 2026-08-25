# Wave — Accessibility checks that need a real device

**Last updated:** 2026-08-25
**Covers:** review 10-a11y L1 (Dynamic Type) and the C16 verify list.

Most of review 10 is closed in code. What remains cannot honestly be closed from a
keyboard: font scaling and screen-reader behaviour depend on the OS renderer, and the
only way to know is to turn the setting on and look. This page says exactly where to
look, so the spot-check is targeted rather than "try the app at big text".

---

## 1. Dynamic Type / font scaling (L1)

**Good news first:** nothing in the app sets `allowFontScaling={false}`, so text
scales by default everywhere. That is the setting people usually get wrong, and Wave
does not have it.

**The risk is clipping, not refusal to scale.** The v6 system fixes container heights
by design, and at large text sizes the content inside can outgrow them. These are the
places to check, in rough order of how much it would hurt:

| Component | Height | Why it matters |
|-----------|--------|----------------|
| `v6/SearchCapsule` | `h-16` | Holds **two** stacked lines ("What do you need" + the value). The tightest ratio in the app, and it is the home screen hero |
| `ui/CodeInput` | `h-[58px]`, 26px numerals | Delivery PIN entry. Clipped digits here mean a failed handover at a checkpoint |
| `v6/Field` | `h-12` | Every single-line form input |
| `v6/Sheet` action buttons | `h-12` | Confirm/cancel — the actions in a sheet must stay tappable and readable |
| `ui/BottomTabBar` | `h-16` | Labels under icons; long words at large sizes |
| `v6/TopBar` | `h-16` / `h-14` | Screen titles |
| `ui/HeroAction` | `h-12` | Home actions |

**How to check:** iOS Settings → Accessibility → Display & Text Size → Larger Text,
drag to maximum (turn on Larger Accessibility Sizes). Android Settings →
Accessibility → Font size, largest.

Walk: Home → shop list → basket → checkout → order tracking → PIN screen, and the
rider's accept → deliver flow.

**Record for each:** is text clipped, does a button lose its label, does a row's text
collide with its trailing icon?

> Deliberately **not** "fixed" blind. The remedy is either a flexible height or a
> `maxFontSizeMultiplier` cap, and which one is right depends on how bad it actually
> looks — capping is a real accessibility compromise and should not be applied on
> suspicion. Capping *everything* pre-emptively would be worse than the problem.

---

## 2. Screen reader (VoiceOver / TalkBack)

Closed in code, verify on device:

- [ ] **PIN entry does not speak the digits.** The cells are hidden from the screen
      reader in entry mode and the input announces "3 of 6 digits entered" instead.
      A rider stands next to the student and everyone else waiting — the PIN being
      read aloud defeats the point of having one.
- [ ] The same screen still announces *something* useful on focus (the label and the
      count), so a blind rider can tell how far through they are.
- [ ] Toast dismiss control has a usable label.
- [ ] Tab badge counts are announced (not just the number, but what it counts).
- [ ] Desktop web panel scrim can be dismissed without a mouse.
- [ ] Shop "Serving" toggle announces its state, not just its name.

---

## 3. Reduced motion (M2 — closed in code)

Implemented: the skeleton pulse holds steady instead of looping, the root crossfade is
skipped, and **all screen transitions become `none`** — the last is the one that
matters most, since a full-screen slide is what actually triggers vestibular
discomfort.

Verify:

- [ ] iOS Settings → Accessibility → Motion → Reduce Motion **on**: screens appear
      without sliding, skeletons do not pulse.
- [ ] Toggle it **while the app is open** — the app subscribes to the change, so it
      should take effect without a restart.
- [ ] Android Settings → Accessibility → Remove animations: same.
- [ ] With it **off**, transitions still animate as before (no accidental regression).

---

## 4. Contrast

The v6 rule is enforced by convention rather than tooling: **lime is fill-only, and
always carries ink on top**. White on lime is ~1.8:1 and fails WCAG outright.

- [ ] No lime text anywhere on screen
- [ ] No placeholder grey (`#c1c1c1`) used for real content — it is a placeholder
      colour and fails as body text
