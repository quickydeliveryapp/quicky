// Small stroke icons for the hero admin (24x24, currentColor).
type P = { size?: number };
const base = (size: number) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
});

export const PhoneIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>
);
export const MonitorIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
);
export const MoveIcon = ({ size = 14 }: P) => (
  <svg {...base(size)}><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" /></svg>
);
export const MinusIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M5 12h14" /></svg>
);
export const PlusIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
);
export const ResetIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
);
export const CheckIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const UploadIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
);
