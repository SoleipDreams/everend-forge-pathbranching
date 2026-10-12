import { useCallback, useEffect, useRef } from "react";

/** Optional, app-owned learning seam. Never serialize it into universe files. */
export type LearningText = { es: string; en: string };
export type LearningStep = {
  id: string; title: LearningText; body: LearningText;
  character: "brio" | "temple"; section: string; target?: string;
  event?: string; sameDocument?: boolean;
};
export type LearningLesson = {
  id: string; title: LearningText; summary: LearningText;
  section: string; steps: LearningStep[];
};
export type LearningAdapter = {
  introduction: LearningStep[]; lessons: LearningLesson[];
  section: string; available: boolean; busy?: boolean; subjectId?: string;
  openSection: (section: string, userInitiated?: boolean) => void;
};
export type LearningEvent = { event: string; universePath: string; subjectId?: string };
export type LearningHost = {
  register: (adapter: LearningAdapter) => () => void;
  report: (event: LearningEvent) => void;
};

export const learningText = (es: string, en: string): LearningText => ({ es, en });

/** Stable callbacks keep registrations independent of editor render frequency. */
export function useLearningAdapter(host: LearningHost | undefined, adapter: LearningAdapter) {
  const current = useRef(adapter);
  current.current = adapter;
  useEffect(() => host?.register({ ...adapter, openSection: (section, userInitiated) => current.current.openSection(section, userInitiated) }),
    [host?.register, adapter.introduction, adapter.lessons, adapter.available, adapter.busy, adapter.section, adapter.subjectId]);
}

export function useLearningReporter(host: LearningHost | undefined, universePath?: string) {
  const current = useRef({ host, universePath });
  current.current = { host, universePath };
  return useCallback((event: string, subjectId?: string, path?: string) => {
    const context = current.current;
    const root = path ?? context.universePath;
    if (root) context.host?.report({ event, subjectId, universePath: root });
  }, []);
}
