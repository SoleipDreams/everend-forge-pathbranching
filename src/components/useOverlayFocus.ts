import { useEffect, useRef, type RefObject } from "react";
import { useApplicationActive } from "./useApplicationActivity.js";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary';

/** Modal focus handling, or Escape/restoration for a non-modal guide. */
export function useOverlayFocus(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onDismiss: () => void,
  modal = true,
  initialFocusSelector?: string,
) {
  const applicationActive = useApplicationActive();
  const applicationActiveRef = useRef(applicationActive);
  applicationActiveRef.current = applicationActive;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const container = containerRef.current;
    if (!applicationActive || !active || !container) return;
    let restoreTarget = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    let receivedFocus = modal;
    const visible = (element: HTMLElement) => {
      if (!element.getClientRects().length || element.closest("[hidden]")) return false;
      for (let parent = element.parentElement; parent && parent !== container; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement && !parent.open && !parent.querySelector(":scope > summary")?.contains(element)) return false;
      }
      return true;
    };
    const focusableElements = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => visible(element) && element.getAttribute("aria-hidden") !== "true");
    const focusFirst = () => {
      const preferred = container.querySelector<HTMLElement>(initialFocusSelector ?? "[data-overlay-focus]");
      (preferred && visible(preferred) ? preferred : focusableElements()[0] ?? container).focus();
    };

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
      if (applicationActiveRef.current && receivedFocus && restoreTarget?.isConnected) restoreTarget.focus();
    };
  }, [containerRef, active, applicationActive, modal, initialFocusSelector]);
}
