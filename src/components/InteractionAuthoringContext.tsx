import { createContext, useContext } from 'react';
import type { InteractionMechanicsLibrary } from '../domain.js';

export type InteractionAuthoringServices = {
  library: InteractionMechanicsLibrary;
  onLibraryChange?: (library: InteractionMechanicsLibrary) => void | Promise<void>;
  refreshLibrary?: () => void | Promise<void>;
  libraryError?: string;
  libraryEditor?: { presetId?: string; revision: number; projectId: string };
  openLibrary?: (presetId?: string) => void;
};
export const InteractionAuthoringContext = createContext<InteractionAuthoringServices | undefined>(undefined);
export const useInteractionAuthoringContext = () => useContext(InteractionAuthoringContext);
