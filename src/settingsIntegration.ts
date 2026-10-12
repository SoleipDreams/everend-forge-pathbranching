/** Optional public integration seam; standalone applications never import the private shell. */
export type SettingsCopy = { en: string; es: string };
export type SettingsControl = {
  id: string; label: SettingsCopy; description?: SettingsCopy; keywords?: string[];
  /** Existing accessible label, when it differs from the catalog label. */
  match?: string[];
};
export type SettingsPage = {
  id: string; owner: string; group: SettingsCopy; title: SettingsCopy;
  description?: SettingsCopy; requiresUniverse?: boolean; controls: SettingsControl[];
};
export type SettingsDraft = {
  dirty: boolean; busy?: boolean; save: () => Promise<void>; discard: () => void;
};
export type SettingsHost = {
  visible: boolean; page: string; target: HTMLElement | null; focusControl?: string;
  open: (page?: string, control?: string) => void;
  requestClose?: (after?: () => void) => void;
  register: (owner: string, pages: SettingsPage[]) => () => void;
  registerDraft: (id: string, draft: SettingsDraft) => () => void;
  /** Notify presentation caches only; this is not a document reload or live sync. */
  profileSaved: (path: string) => void;
};
export const settingsText = (value: SettingsCopy, locale: "en" | "es") => value[locale];
export function normalizeSettingsSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}
export function findSettings(pages: SettingsPage[], query: string) {
  const terms = normalizeSettingsSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return [];
  return pages.flatMap(page => page.controls.filter(control => {
    const text = normalizeSettingsSearch([
      ...Object.values(page.title), ...Object.values(page.group), ...Object.values(page.description ?? {}),
      ...Object.values(control.label), ...Object.values(control.description ?? {}),
      ...(control.keywords ?? []), ...(control.match ?? []),
    ].join(" "));
    return terms.every(term => text.includes(term));
  }).map(control => ({ page, control })));
}

