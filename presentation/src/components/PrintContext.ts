import { createContext, useContext } from 'react';

/** True when a slide is rendered inside the static print/PDF deck. */
export const PrintContext = createContext(false);
export const useIsPrint = () => useContext(PrintContext);

/** Resolve a public asset path so it works under dev, preview, and file builds. */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
