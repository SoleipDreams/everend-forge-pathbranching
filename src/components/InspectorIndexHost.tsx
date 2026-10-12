import { createContext } from 'react';

/** Optional shell slot for the narrative index, outside the editor viewport. */
export const InspectorIndexHost = createContext<HTMLElement | null>(null);
