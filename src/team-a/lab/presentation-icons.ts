/** One hand-drawn, optical 24 px family; no font glyphs or OS-dependent emoji. */
const paths = {
  car: '<path d="m5 9 1.7-4.2A1.5 1.5 0 0 1 8.1 4h7.8a1.5 1.5 0 0 1 1.4.8L19 9M5 9h14a2 2 0 0 1 2 2v6H3v-6a2 2 0 0 1 2-2ZM4 17v3h3v-3m10 0v3h3v-3M6 12h2m8 0h2M1 8l3 1m16 0 3-1"/>',
  seat: '<path d="M8 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2H8V4Zm1 2-2 8m6-8-2 8h7a2 2 0 0 1 2 2v2H8a4 4 0 0 1-4-4V9M8 18l-1 4m11-4 1 4M7 22h12"/>',
  wave: '<path d="M2 11v2m4-6v10m4-13v16m4-18v20m4-15v10m4-6v2"/>',
  cube: '<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 15l9 5 9-5M3 7v4m18-4v4m-9 1v4m0 4v2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  arrow: '<path d="M3 12h17m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  more: '<circle cx="4" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="20" cy="12" r="1.3"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m7 4 13 8-13 8V4Z"/>',
  route: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M5 16V8a3 3 0 0 1 6 0v8a3 3 0 0 0 6 0V8"/>',
  layout: '<path d="M8 3h8l3 4v12l-3 2H8l-3-2V7l3-4Zm1 5h6m-6 8h6M9 11v2m6-2v2"/>',
} satisfies Record<string, string>;
export const presentationIcon = (name: keyof typeof paths) => `<svg class="cp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
