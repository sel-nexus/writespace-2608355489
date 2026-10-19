/** Share standard utility classes without extending Tailwind or writing CSS. */
export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
export const buttonStyles = {
  primary: `${focusRing} inline-flex min-h-11 items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-indigo-700 motion-safe:transition-colors`,
  secondary: `${focusRing} inline-flex min-h-11 items-center justify-center rounded-full border border-indigo-200 bg-white px-5 py-2.5 font-medium text-indigo-700 hover:bg-indigo-50 motion-safe:transition-colors`,
  ghost: `${focusRing} inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-slate-600 hover:bg-slate-100 motion-safe:transition-colors`,
  destructive: `${focusRing} inline-flex min-h-11 items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600 hover:bg-red-100 motion-safe:transition-colors`,
};
export const fieldStyle = `${focusRing} w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 disabled:bg-slate-100`;
export const displayFont = "font-['Georgia',serif]";
