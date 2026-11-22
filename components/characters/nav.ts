// Moves between lives without reloading the page: the screens read the address (?id=) and listen to popstate, so a normal link would change the address
// and leave the old life on screen. Normal behavior (new tab, copy link) is kept for modified clicks.
import type { MouseEvent } from "react";
export const soft = (url: string) => (e: MouseEvent) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  window.history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
