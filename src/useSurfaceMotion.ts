import { useLayoutEffect, useRef } from "react";

/** Animate the existing surface so editor state, selection and scroll survive. */
export function useSurfaceMotion<T extends HTMLElement>(value: string | undefined) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element?.animate || !element.getClientRects().length) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    const animation = element.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], {
      duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    });
    const cancel = () => animation.cancel();
    preference.addEventListener("change", cancel);
    return () => { cancel(); preference.removeEventListener("change", cancel); };
  }, [value]);
  return ref;
}
