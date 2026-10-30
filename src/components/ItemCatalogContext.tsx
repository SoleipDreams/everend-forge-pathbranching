import { createContext, useContext } from 'react';
import type { ItemCatalogLibrary } from '../itemCatalog.js';
export const ItemCatalogContext = createContext<{ library: ItemCatalogLibrary; error?: string; refresh: () => Promise<void>; save: (library: ItemCatalogLibrary) => Promise<void> } | undefined>(undefined);
export const useItemCatalog = () => useContext(ItemCatalogContext);
