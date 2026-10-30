import { createContext, useContext } from 'react';
import type { Condition } from '../domain.js';
import type { ConditionReferenceDraft } from '../conditionReferenceCreation.js';

export const ConditionReferenceCreationContext = createContext<{ propertiesConfig?: Record<string, unknown>; create: (draft: ConditionReferenceDraft, onCreated: (condition: Condition) => void) => void } | undefined>(undefined);
export const useConditionReferenceCreation = () => useContext(ConditionReferenceCreationContext);
