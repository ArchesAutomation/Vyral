const paths: Record<string, string> = {
  home: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  inspiration: "m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z",
  content: "M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h4",
  generation: "m13 2-9 12h7l-1 8 10-12h-7z",
  editor: "M3 5h18v12H3z M8 21h8 M12 17v4 M10 8l5 3-5 3z",
  experiments:
    "M9 3h6 M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3 M8 14h8",
  publishing: "m3 11 18-8-8 18-2-8-8-2z M11 13l10-10",
  analytics: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  intelligence: "M12 3a9 9 0 1 0 9 9 M12 7v5l3 2 M18 2v6 M15 5h6",
  assets: "M3 6h7l2 2h9v12H3z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  plus: "M12 5v14 M5 12h14",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6",
  upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
  play: "m8 4 13 8-13 8z",
  close: "m6 6 12 12 M6 18 18 6",
  check: "m5 12 4 4L19 6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2",
};
export default function Icon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.content} />
    </svg>
  );
}
