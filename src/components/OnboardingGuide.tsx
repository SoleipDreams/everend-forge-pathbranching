import { Check, ChevronRight, X } from "lucide-react";
import { useRef } from "react";
import { onboardingUiCopy, useInterfaceLocale, type Locale } from "../i18n.js";
import { useOverlayFocus } from "./useOverlayFocus.js";
import "../accessibleUi.css";

export function OnboardingGuide({
  steps,
  onDismiss,
  onRestart,
  onOpenStories,
  locale,
  visible = true,
}: {
  steps: Array<{ id: string; title: string; description: string; complete: boolean }>;
  onDismiss: () => void;
  onRestart: () => void;
  onOpenStories: () => void;
  locale?: Locale;
  visible?: boolean;
}) {
  const interfaceLocale = useInterfaceLocale();
  const copy = onboardingUiCopy(locale ?? interfaceLocale);
  const guideRef = useRef<HTMLElement>(null);
  useOverlayFocus(guideRef, visible, onDismiss, false);
  const activeIndex = steps.findIndex((step) => !step.complete);
  const complete = activeIndex === -1;
  const current = complete ? steps[steps.length - 1] : steps[activeIndex];
  if (!current || !visible) return null;
  return (
    <aside ref={guideRef} className={`onboarding-guide${complete ? " completed" : ""}`} aria-label={copy.label}>
      <header className="onboarding-guide-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <strong>{complete ? <span role="status"><Check size={13} aria-hidden="true" /> {copy.completeTitle}</span> : current.title}</strong>
        </div>
        <button type="button" className="onboarding-guide-close" onClick={onDismiss} aria-label={copy.close}><X size={15} /></button>
      </header>
      {!complete ? <>
        <p className="onboarding-guide-description">{current.description}</p>
        {current.id === "open-stories" ? <button type="button" onClick={onOpenStories}>{copy.openStories}</button> : null}
        <ol className="onboarding-guide-steps">
          {steps.map((step, index) => <li key={step.id} aria-current={index === activeIndex ? "step" : undefined} className={`${step.complete ? "complete" : ""} ${index === activeIndex ? "active" : ""}`}><span className="onboarding-guide-step-icon" aria-hidden="true">{step.complete ? <Check size={12} /> : index + 1}</span><span>{step.title}</span>{index === activeIndex ? <ChevronRight size={13} aria-hidden="true" /> : null}</li>)}
        </ol>
        <small className="onboarding-guide-progress">{copy.progress(steps.filter((step) => step.complete).length, steps.length)}</small>
      </> : <button type="button" className="onboarding-guide-restart" onClick={onRestart}>{copy.restart}</button>}
    </aside>
  );
}
