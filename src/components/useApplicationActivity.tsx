import { createContext, useContext, useEffect, type DependencyList, type EffectCallback } from "react";

/** Standalone windows are active; embedding hosts can suspend global interaction. */
export const ApplicationActivity = createContext(true);
export const useApplicationActive = () => useContext(ApplicationActivity);

/** Keep local UI state mounted while removing document/window event listeners. */
export function useApplicationEffect(effect: EffectCallback, dependencies: DependencyList) {
  const active = useApplicationActive();
  useEffect(() => active ? effect() : undefined, [active, ...dependencies]);
}
