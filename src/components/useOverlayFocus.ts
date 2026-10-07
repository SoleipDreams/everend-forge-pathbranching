import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal focus handling, or Escape/restoration for a non-modal guide. */
export function useOverlayFocus(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onDismiss: () => void,
  modal = true,
  initialFocusSelector?: string,
) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;
    let restoreTarget = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    let receivedFocus = modal;
    const focusableElements = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
    const focusFirst = () => (container.querySelector<HTMLElement>(initialFocusSelector ?? "[data-overlay-focus]") ?? focusableElements()[0] ?? container).focus();

    const handleFocus = (event: FocusEvent) => {
      if (container.contains(event.target as Node)) {
        receivedFocus = true;
      } else if (modal) {
        focusFirst();
      } else if (event.target instanceof HTMLElement) {
        restoreTarget = event.target;
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!modal && !container.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismissRef.current();
      } else if (modal && event.key === "Tab") {
        const elements = focusableElements();
        const first = elements[0] ?? container;
        const last = elements[elements.length - 1] ?? container;
        if (elements.length === 0 || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocus, true);
    if (modal) focusFirst();
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocus, true);
      if (receivedFocus && restoreTarget?.isConnected) restoreTarget.focus();
    };
  }, [containerRef, active, modal, initialFocusSelector]);
}
