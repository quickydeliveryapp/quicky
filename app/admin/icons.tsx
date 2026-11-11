// Small line icons used by the dashboard design. All inherit colour from the parent (currentColor).
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
type P = { size?: number };

export const IBag = ({ size = 28 }: P) => (<svg {...base} width={size} height={size}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>);
export const IClock = ({ size = 28 }: P) => (<svg {...base} width={size} height={size}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const IRider = ({ size = 28 }: P) => (<svg {...base} width={size} height={size}><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M6 17h5l3-6h-4M14 11l2 6M13 6h3l1 3" /></svg>);
export const IShop = ({ size = 28 }: P) => (<svg {...base} width={size} height={size}><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12.5V20h13v-7.5" /><path d="M10 20v-4.5h4V20" /></svg>);
export const ICash = ({ size = 22 }: P) => (<svg {...base} width={size} height={size}><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6.5 9.5v.01M17.5 14.5v.01" /></svg>);
export const ICheck = ({ size = 20 }: P) => (<svg {...base} width={size} height={size}><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.7 2.7L16 9.5" /></svg>);
export const ICross = ({ size = 20 }: P) => (<svg {...base} width={size} height={size}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></svg>);
export const IArrow = ({ size = 16 }: P) => (<svg {...base} width={size} height={size} strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const ISearch = ({ size = 18 }: P) => (<svg {...base} width={size} height={size}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
