/**
 * Responsive layout for the student flow.
 *
 * - Native phone: always the mobile UI.
 * - Web narrow: same mobile UI.
 * - Web wide: left nav + full-bleed main stage (+ optional right panel).
 */
export const layout = {
  sidebarWidth: 240,
  /** Right inspector panel on desktop. */
  rightPanelWidth: 420,
  /** Soft ceiling for optional centered marketing blocks — not the main stage. */
  pageMaxWidth: 1600,
  narrowMaxWidth: 520,
  searchMaxWidth: 720,
  gutterMobile: 24,
  gutterDesktop: 32,
  desktopLayoutAt: 900,
  desktopGutterAt: 640,
  pagePadY: 32,
  shopGrid: {
    twoUp: 480,
    threeUp: 720,
    fourUp: 980,
    fiveUp: 1280,
  },
} as const;

export function shopColumnCount(contentWidth: number): number {
  if (contentWidth >= layout.shopGrid.fiveUp) return 5;
  if (contentWidth >= layout.shopGrid.fourUp) return 4;
  if (contentWidth >= layout.shopGrid.threeUp) return 3;
  if (contentWidth >= layout.shopGrid.twoUp) return 2;
  return 1;
}

export function gutterForWidth(contentWidth: number): number {
  return contentWidth >= layout.desktopGutterAt ? layout.gutterDesktop : layout.gutterMobile;
}

export function shopCardWidth(contentWidth: number, columns: number, gap = 16): number {
  const gutter = gutterForWidth(contentWidth);
  const inner = Math.max(0, contentWidth - gutter * 2);
  if (columns <= 1) return inner;
  return (inner - gap * (columns - 1)) / columns;
}
