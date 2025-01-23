// @ts-nocheck

import ShadowTreeWalker, { isFocusable } from "./shadowTreeWalker";

declare global {
  interface Window {
    restrictFocus: RestrictFocusAPI;
  }
}

interface EventDetail {
  element: HTMLElement;
  previouslyFocusedElement?: HTMLElement;
  currentElementWithFocus?: HTMLElement;
}

// The public restrictFocus API interface
export interface RestrictFocusAPI {
  // // Add your methods here
  // paused: boolean;
  // allFns: Map<symbol, Callback>;
  // pausedFns: Map<symbol, boolean>;
  // inWatchers: Watcher;
  // outWatchers: Watcher;
  // processedElems: WeakMap<Element, Set<symbol>>;
  // processingQueued: boolean;
  // outElems: Map<Element, Map<string, Set<Callback>>>;
  // getSymbol(fn: Callback): symbol | undefined;
  // getFn(symbol: symbol): Callback | undefined;
  // setAction(selector: string, fn: Callback, watcherType: Watcher): symbol;
  // in(selector: string, fn: Callback, processNow?: boolean): symbol;
  // out(selector: string, fn: Callback): symbol;
  // clear(symbol: symbol): void;
  // pause(symbol: symbol): symbol;
  // pauseAll(): void;
  // resume(symbol: symbol, processNow?: boolean): symbol;
  // resumeAll(): void;
}

class RestrictFocus implements RestrictFocusAPI {
  private static instance: RestrictFocus | null = null;

  // Private constructor to prevent 'new' operator
  private constructor() {
    if (typeof window !== "undefined" && window.restrictFocus) {
      throw new Error("restrictFocus is already initialized");
    }
  }

  // Static method to get or create the instance
  public static getInstance(): RestrictFocus {
    if (typeof window !== "undefined" && window.restrictFocus) {
      return window.restrictFocus as RestrictFocus;
    }

    if (!RestrictFocus.instance) {
      const self = (RestrictFocus.instance = new RestrictFocus());

      if (typeof window !== "undefined") {
        Object.defineProperty(window, "restrictFocus", {
          value: RestrictFocus.instance,
          configurable: false,
          writable: false,
        });

        function handleFocusIn(e: FocusEvent) {
          const focusedElement = e
            .composedPath()
            .find((node) => node instanceof HTMLElement);
          self.activeElement = focusedElement;
        }

        function handleKeyDown(e: KeyboardEvent) {
          if (e.key === "Tab") {
            e.preventDefault();

            // TODO: Flesh this out.
            if (!self.activeElement || !self.activeElement.isConnected) {
              return;
            }

            if (!self.activeBoundary) return;

            const focusableElems = self.focusableElements(self.activeBoundary);
            const focusableElemsArray = Array.from(focusableElems);

            // If the activeBoundary element is focusable, add it to the start of the list of focusable elements.
            if (
              !focusableElems.has(self.activeBoundary) &&
              isFocusable(self.activeBoundary)
            ) {
              focusableElemsArray.unshift(self.activeBoundary);
            }

            // TODO: Need to sort tabindexes.

            // Focus to the previous/next focusable element.
            let index = focusableElemsArray.indexOf(self.activeElement);
            console.log({ index, focused: self.activeElement });
            let tabToElem: HTMLElement | unknown;
            if (e.shiftKey) {
              tabToElem =
                focusableElemsArray[index - 1] ||
                focusableElemsArray[focusableElemsArray.length - 1];
            } else {
              tabToElem =
                focusableElemsArray[index + 1] || focusableElemsArray[0];
            }

            if (tabToElem instanceof HTMLElement) {
              self.activeElement = tabToElem;
            }
          }
        }

        function preventOutsideClick(e: MouseEvent) {
          // If no activeElement is specified, then do nothing.
          if (!restrictFocus.activeElement) return;

          // Event is happening inside the activeElement, so do nothing.
          if (e.composedPath().includes(restrictFocus.activeElement)) return;

          // If we expressly allow this type of event, then let it pass through.
          const allowedEvents = self.allowEventsOnElement.get(
            restrictFocus.activeElement
          );
          if (allowedEvents?.includes(e.type)) {
            // Allowing the event outside the restrictedFocus list effectively pierces the focus,
            // meaning we actually want to disable restricted focusing on this particular element.
            restrictFocus.remove(restrictFocus.activeElement);
            return;
          } else {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }
        }

        window.addEventListener("focusin", handleFocusIn, { capture: true });
        window.addEventListener("keydown", handleKeyDown, { capture: true });
        ["touchstart", "touchend", "mousedown", "mouseup", "click"].forEach(
          (eventType) => {
            // window.addEventListener(eventType, preventOutsideClick, {
            //   capture: true,
            // });
          }
        );
      }
    }

    return RestrictFocus.instance;
  }

  // ----------------- API ----------------- //

  private _activeElement?: HTMLElement;
  private allowEventsOnElement = new WeakMap();
  private origTabIndexSet = new WeakSet();
  private lastFocusedElementByBoundary = new WeakMap();

  public boundaries: Array<HTMLElement> = [];

  focusableElements(element: HTMLElement) {
    return new ShadowTreeWalker(element, { checkFocusable: true });
  }

  allChildElements(element: HTMLElement, asArray?: boolean) {
    return new ShadowTreeWalker(element, { checkFocusable: false });
  }

  get activeElement() {
    return this._activeElement;
  }

  set activeElement(element: HTMLElement | undefined) {
    this._activeElement = element;

    // Keep track of the last focused element within the activeBoundary.
    if (this.activeBoundary) {
      this.lastFocusedElementByBoundary.set(this.activeBoundary, element);
    }

    // If the activeElement is not already focused then focus on it.
    if (this._activeElement && !this._activeElement.matches(":focus")) {
      this.activeElement?.focus();
    }
  }

  get activeBoundary() {
    return this.boundaries
      .slice()
      .reverse()
      .find((boundary) => boundary.isConnected);
  }

  add(
    element: HTMLElement,
    options = { allowedEvents: [], callback: undefined }
  ) {
    const previouslyFocused = this.activeElement;
    this.boundaries.push(element);
    this.allowEventsOnElement.set(element, options.allowedEvents);

    // If we are not currently focused somewhere within the activeElement, focus on the first boundary element.
    if (!element.matches(":focus-within")) {
      const focusableElems = Array.from(this.focusableElements(element));
      this.activeElement = focusableElems[0];
    }

    this.fireEvent({
      element,
      eventName: "added",
      previouslyFocused: previouslyFocused,
      currentFocused: this.activeElement,
    });

    // @ts-ignore
    options?.callback?.call(element, element);
    return this;
  }

  remove(element: HTMLElement, options = { callback: undefined }) {
    let deleteIndex;
    for (let i = this.boundaries.length - 1; i > -1; i--) {
      if (this.boundaries[i] === element) {
        deleteIndex = i;
        break;
      }
    }
    if (typeof deleteIndex !== "undefined") {
      this.boundaries.splice(deleteIndex, 1);
    }

    // Revert tabIndex to original value.
    if (this.origTabIndexSet.has(element)) {
      this.origTabIndexSet.delete(element);
      element.tabIndex = -1;
    }

    // Remove lastFocusedElementByBoundary reference.
    this.lastFocusedElementByBoundary.delete(element);

    // Focus on the current boundary's last focused element. If there is none, focus on the first focusable element.
    this.activeElement =
      this.lastFocusedElementByBoundary.get(this.activeBoundary) ||
      Array.from(this.focusableElements(this.activeBoundary))[0];

    this.fireEvent({
      element,
      eventName: "removed",
      currentFocused: this.activeElement,
    });

    // @ts-ignore
    options?.callback?.call(element, element);
    return this;
  }

  private fireEvent({
    element,
    eventName,
    previouslyFocused,
    currentFocused,
  }: {
    element: HTMLElement;
    eventName: string;
    previouslyFocused?: HTMLElement;
    currentFocused?: HTMLElement;
  }) {
    const detail: EventDetail = {
      element,
      previouslyFocusedElement: undefined,
      currentElementWithFocus: undefined,
    };
    if (previouslyFocused) detail.previouslyFocusedElement = previouslyFocused;
    if (currentFocused) detail.currentElementWithFocus = currentFocused;

    const event = new CustomEvent(`restrict-focus:${eventName}`, { detail });
    window.dispatchEvent(event);
    element.dispatchEvent(event);
  }
}

// Create and export the singleton instance
const instance = RestrictFocus.getInstance();

// Default export provides the same singleton instance as window.restrictFocus
// Just offers a more TypeScript-friendly import method
export default instance;
