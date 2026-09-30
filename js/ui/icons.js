const S = (vb, body, w = 2.2) =>
  `<svg viewBox="0 0 ${vb} ${vb}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  check: S(24, '<path d="M5 12.5l4.5 4.5L19 7.5"/>', 3),
  up: S(24, '<path d="M6 14l6-6 6 6"/>', 2.4),
  down: S(24, '<path d="M6 10l6 6 6-6"/>', 2.4),
  edit: S(24, '<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  today: S(26, '<path d="M3 21h20M7 21a6 6 0 0 1 12 0M13 5v3M5.2 10.4l2.1 1.6M20.8 10.4l-2.1 1.6"/>'),
  train: S(26, '<path d="M3 13h20M6 8v10M9 6v14M17 6v14M20 8v10"/>'),
  body: S(26, '<circle cx="13" cy="4.8" r="2.3"/><path d="M13 9v7M7.5 11.5L13 9l5.5 2.5M10 23l3-7 3 7"/>'),
  food: S(26, '<path d="M6 3v6c0 1.9 1.3 3 3 3s3-1.1 3-3V3M9 12v11M19.5 23V3c-2.6 1.6-3.8 5.2-3.8 9.5h3.8"/>'),
  profile: S(26, '<circle cx="13" cy="9" r="4"/><path d="M5 22c1-4.4 4.4-6.5 8-6.5s7 2.1 8 6.5"/>'),
  gear: S(24, '<circle cx="12" cy="12" r="6.4"/><circle cx="12" cy="12" r="2.3"/><path stroke-width="3.4" stroke-linecap="butt" d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12M18.36 18.36l-2.12-2.12M7.76 7.76L5.64 5.64"/>', 2),
  chevron: S(24, '<path d="M9 6l6 6-6 6"/>', 2.4),
};
