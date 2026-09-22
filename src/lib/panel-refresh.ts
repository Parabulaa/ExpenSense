const skippedRoutes = new Set<string>();

export function skipNextPanelRefresh(route: string) {
  skippedRoutes.add(route);
}

export function consumeSkippedPanelRefresh(route: string) {
  if (!skippedRoutes.has(route)) return false;
  skippedRoutes.delete(route);
  return true;
}
