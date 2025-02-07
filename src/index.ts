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

type AllowedEvent = "click" | "mousedown" | "mouseup";

interface AddOptions {
  allowedEvents?: AllowedEvent[];
  callback?: (element: HTMLElement) => void;
}

interface RemoveOptions {
  callback?: (element: HTMLElement) => void;
}

// The public restrictFocus API interface
export interface RestrictFocusAPI {
  /**
   * A WeakMap of HTMLElements to the last focused element within that element.
   */
  lastFocusedElementByBoundary: WeakMap<HTMLElement, HTMLElement>;

  /**
   * An array of HTMLElements that are currently acting as focus boundaries.
   */
  boundaries: Array<HTMLElement>;

  /**
   * Returns a Set of all focusable elements within a given element.
   * @param element The HTML element to search within.
   */
  focusableElements: (element: HTMLElement) => Set<HTMLElement>;

  /**
   * Returns a Set of all child elements within a given element.
   * @param element The HTML element to search within.
   */
  allChildElements: (element: HTMLElement) => Set<HTMLElement>;

  /**
   * The currently focused element.
   * If the activeElement is not connected, then it will return either the last focused element within the activeBoundary, the first focusable element within the activeBoundary, or undefined.
   */
  activeElement: HTMLElement | undefined;

  /**
   * The currently active boundary element.
   */
  activeBoundary: HTMLElement | undefined;

  /**
   * Adds an element as a focus boundary
   * @param element The HTML element to add as a boundary.
   * @param options Configuration options for the boundary.
   * @param options.allowedEvents List of events that are allowed to propagate.
   * @param options.callback Optional callback function called after adding the boundary.
   */
  add(
    element: HTMLElement,
    options?: {
      allowedEvents?: string[];
      callback?: (element: HTMLElement) => void;
    }
  ): void;

  /**
   * Removes an element as a focus boundary
   * @param element The HTML element to remove as a boundary
   * @param options Configuration options for the boundary
   * @param options.callback Optional callback function called after removing the boundary
   */
  remove(
    element: HTMLElement,
    options?: { callback?: (element: HTMLElement) => void }
  ): void;

  /**
   * A collection of utility functions.
   * @property ShadowTreeWalker A class for walking the shadow DOM tree.
   * @property isFocusable A function to determine if an element is focusable.
   */
  utilities: {
    ShadowTreeWalker: typeof ShadowTreeWalker;
    isFocusable: typeof isFocusable;
  };
}

/**
 * Manages focus restriction within specified DOM boundaries
 */
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
      // return window.restrictFocus as RestrictFocus;
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
            // If there is no activeBoundary, then do nothing as we're not restricting focus.
            if (!self.activeBoundary) return;

            // If the activeElement is not connected, then do nothing.
            if (!self.activeElement || !self.activeElement.isConnected) {
              return;
            }

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
              e.preventDefault();
              self.activeElement = tabToElem;
            }
          }
        }

        function preventOutsideClick(e: MouseEvent | TouchEvent) {
          // If no activeBoundary is specified, then do nothing.
          if (!self.activeBoundary) return;

          // Event is happening inside the activeBoundary, so do nothing.
          if (e.composedPath().includes(self.activeBoundary)) return;

          // If we expressly allow this type of event, then let it pass through.
          const allowedEvents = self.allowEventsOnElement.get(
            self.activeBoundary
          );
          if (allowedEvents?.includes(e.type)) {
            // Allowing the event outside the restrictedFocus list effectively pierces the focus,
            // meaning we actually want to remove restricted focusing on the active boundary.
            self.remove(self.activeBoundary);
            return;
          } else {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }
        }

        const eventOpts = { capture: true, bubbles: true, cancelable: true };

        window.addEventListener("focusin", handleFocusIn, eventOpts);
        window.addEventListener("keydown", handleKeyDown, eventOpts);
        (
          ["touchstart", "touchend", "mousedown", "mouseup", "click"] as const
        ).forEach((eventType) => {
          window.addEventListener(eventType, preventOutsideClick, eventOpts);
        });
      }
    }

    return RestrictFocus.instance;
  }

  // ----------------- API ----------------- //

  /**
   * Currently focused element
   */
  private _activeElement?: HTMLElement;

  /**
   * A WeakMap of HTMLElements to an array of allowed events.
   */
  private allowEventsOnElement = new WeakMap();

  /**
   * Maps elements to their original tabIndex
   */
  private origTabIndexSet = new WeakSet();

  public lastFocusedElementByBoundary = new WeakMap();

  public boundaries: Array<HTMLElement> = [];

  public focusableElements(element: HTMLElement) {
    const walker = new ShadowTreeWalker(element, { checkFocusable: true });
    return new Set(
      Array.from(walker.walk()).sort((a, b) => b.tabIndex - a.tabIndex)
    );
  }

  public allChildElements(element: HTMLElement) {
    const walker = new ShadowTreeWalker(element, { checkFocusable: false });
    return walker.walk();
  }

  private boundaryDefaultActiveElement(boundary: HTMLElement | undefined) {
    if (!boundary) return;

    // If the lastFocusedElementByBoundary has a reference to the boundary, then return it.
    if (this.lastFocusedElementByBoundary.has(boundary)) {
      const elem = this.lastFocusedElementByBoundary.get(boundary);
      if (elem && elem.isConnected) {
        // Set the activeElement for future reference.
        this.activeElement = elem;
        return elem;
      }
    }

    // If all else failse, get the first focusable element within the boundary.
    if (boundary) {
      return Array.from(this.focusableElements(boundary))[0];
    }
  }

  get activeElement() {
    // If the _activeElement is already set and connected, then return it.
    if (this._activeElement && this._activeElement.isConnected) {
      return this._activeElement;
    }

    // Otherwise, return the last focused element within the activeBoundary.
    return this.boundaryDefaultActiveElement(this.activeBoundary);
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

  public add(
    element: HTMLElement,
    options: AddOptions = { allowedEvents: [], callback: undefined }
  ) {
    // Do nothing if the most recently added boundary is the same as the one we're trying to add.
    if (this.activeBoundary === element) return;

    const previouslyFocused = this.activeElement;
    this.boundaries.push(element);
    this.allowEventsOnElement.set(element, options.allowedEvents);

    const focusableElems = Array.from(this.focusableElements(element));

    if (!element.matches(":focus-within")) {
      // If we are not currently focused somewhere within the activeElement, focus on the first boundary element.
      this.activeElement = focusableElems[0];
    } else {
      // If we are focused within the activeElement, then set the activeElement to the currently focused element at the time when the boundary was added.
      this.activeElement = focusableElems.find((elem) =>
        elem.matches(":focus")
      );
    }

    this.fireEvent({
      element,
      eventName: "added",
      previouslyFocused: previouslyFocused,
      currentFocused: this.activeElement,
    });

    // @ts-ignore
    options?.callback?.call(element, element);
  }

  public remove(
    element: HTMLElement,
    options: RemoveOptions = { callback: undefined }
  ) {
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
    this.activeElement = this.boundaryDefaultActiveElement(this.activeBoundary);

    this.fireEvent({
      element,
      eventName: "removed",
      currentFocused: this.activeElement,
    });

    // @ts-ignore
    options?.callback?.call(element, element);
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

  public utilities = { ShadowTreeWalker, isFocusable };
}

// Create and export the singleton instance
const instance = RestrictFocus.getInstance();

// Default export provides the same singleton instance as window.restrictFocus
// Just offers a more TypeScript-friendly import method
export default instance;

export { ShadowTreeWalker, isFocusable };
