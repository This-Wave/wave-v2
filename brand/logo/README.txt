Wave logo: B · Checkpoint pin (chosen 2026-11-05)

Colours: Sacramento #154b3e, Lime #87ea5c, Deep green #0b2a21, Cream #fdfcf8.
Wordmark: DM Sans Bold, -0.04em, converted to outlines (no font needed).

svg/   master vectors (use these wherever possible)
  app-icon.svg            rounded square, lime pin, green wave (the chosen icon)
  app-icon-square.svg     same, square: for App Store / Play / apple-touch (they round it)
  app-icon-maskable.svg   PWA/Android maskable, mark inside the safe zone
  app-icon-lime.svg       inverted: lime square, green pin
  android-foreground.svg  Android adaptive icon foreground (background = #154b3e)
  favicon.svg             browser tab (64 grid); favicon-small.svg = bolder for 16/32px
  mark-*.svg              the pin alone, cropped (green, lime, cream, black, white); *-square = padded square
  lockup-*.svg            pin + wordmark: green (transparent), on-cream, on-green, on-lime, black, white
  wordmark-*.svg          "wave" alone: green, cream, black

png/
  app-icon/   16 32 48 64 96 128 192 256 512 1024
  ios/        120 152 167 180 1024 (square, no transparency, App Store ready)
  android/    maskable 48-512, adaptive foreground/background 432, play-store-512
  favicon/    favicon.ico (16/32/48), favicon-16/32/48.png, apple-touch-icon.png (180)
  mark/       every colour at 64 128 256 512 1024 px tall
  lockup/     every version at 128 256 512 1024 px tall
  wordmark/   green, cream, black at 128 256 512 px tall

Rules: lime is a fill, never text. On lime, use deep green or Sacramento. Keep clear space
around the mark of at least half the pin's width. Don't use the pin below 16px except the favicon.
