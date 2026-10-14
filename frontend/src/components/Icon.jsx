// Inline SVG icon set (no external icon dependency). Keeps bundle small and
// avoids network/CDN icon fetches. Each icon is a 24x24 stroke path.

const paths = {
  brain: 'M9.5 2a2.5 2.5 0 0 0-2.5 2.5v.5a3 3 0 0 0-2 2.83A3 3 0 0 0 4 13a3 3 0 0 0 1 5.5v.5A2.5 2.5 0 0 0 7.5 21a2.5 2.5 0 0 0 2.5-2.5V4.5A2.5 2.5 0 0 0 9.5 2Zm5 0A2.5 2.5 0 0 1 17 4.5v.5a3 3 0 0 1 2 2.83A3 3 0 0 1 20 13a3 3 0 0 1-1 5.5v.5a2.5 2.5 0 0 1-5 0V4.5A2.5 2.5 0 0 1 14.5 2Z',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7 14h10',
  cpu: 'M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2M6 6h12v12H6zM10 10h4v4h-4z',
  scroll: 'M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8M8 3v16M8 3h10a2 2 0 0 1 2 2v4M16 21a2 2 0 0 0 2-2V9h-6',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z',
  trophy: 'M6 4h12v4a6 6 0 0 1-12 0V4ZM6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3M9 18h6M8 22h8M12 16v2',
  film: 'M3 4h18v16H3zM7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  code: 'm16 18 6-6-6-6M8 6l-6 6 6 6',
  sigma: 'M18 7V4H6l6 8-6 8h12v-3',
  swords: 'm14.5 17.5 4-4M3 3l6 6M3 9V3h6M20.5 3 14 9.5M21 9V3h-6M3 21l6-6M3 15v6h6',
  medal: 'M7.5 2 12 8l4.5-6M8 13a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM12 17v4l-2-1-2 1M16 17v4',
  crown: 'M3 6l4 4 5-6 5 6 4-4v12H3z',
  zap: 'M13 2 3 14h7l-1 8 10-12h-7l1-8z',
  target: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  flame: 'M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 1-3-3 2-4 5-4 7a7 7 0 0 0 14 0c0-5-4-8-7-13Z',
  fire: 'M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 1-3-3 2-4 5-4 7a7 7 0 0 0 14 0c0-5-4-8-7-13Z',
  'check-circle': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8 12l3 3 5-6',
  'trending-up': 'M3 17l6-6 4 4 7-7M14 7h6v6',
  shield: 'M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  chart: 'M3 3v18h18M8 16v-5M13 16V8M18 16v-9',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.07-.33.1-.66.1-1Z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 6v6l4 2',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  edit: 'M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  users: 'M16 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M18 21a7 7 0 0 0-5-6.7',
  star: 'm12 2 3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  bolt: 'M13 2 3 14h7l-1 8 10-12h-7l1-8z',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8.2 13.5 7 22l5-3 5 3-1.2-8.5',
};

export default function Icon({ name, className = 'w-5 h-5', ...props }) {
  const d = paths[name] || paths.star;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d={d} />
    </svg>
  );
}
