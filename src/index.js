// Get list of all elements within a specific element(s).
// NOTE: Only works with shodow DOM nodes if the shadow DOM is open.
export function getAllElements(elements, list = new Set()) {
  if (!Array.isArray(elements)) elements = [elements];

  elements.forEach((element) => {
    if (element.nodeType === Node.ELEMENT_NODE) list.add(element);

    if (element.shadowRoot) {
      getAllElements(element.shadowRoot, list);
    } else {
      element.querySelectorAll("*").forEach((node) => {
        if (node.shadowRoot) {
          getAllElements(node, list);
        } else if (node.tagName === "SLOT") {
          node.assignedElements().forEach((assignedElement) => {
            return getAllElements(assignedElement, list);
          });
        } else {
          if (node.nodeType === Node.ELEMENT_NODE) list.add(node);
        }
      });
    }
  });

  return list;
}

// Get a list of all elements which can be focused on within a specific parent element.
export function getFocusableElements(element) {
  const elements = Array.from(getAllElements(element));
  return (
    elements
      .filter((node) => {
        if (!node.isConnected) return;
        if (node.disabled) return;
        if (node.hasAttribute("disabled")) return;
        // Cannot be focused if it is an <a> tag with no `href` attribute.
        if (node.tagName === "A" && !node.href) return;

        // `contenteditable` areas may not have a tabIndex set, so we have to check for both simultaneously.
        if (
          node.tabIndex < 0 &&
          !node.isContentEditable &&
          !node.hasAttribute("contenteditable")
        )
          return;

        // This should be the last possible check, as it is an expensive DOM function.
        const { width, height } = node.getBoundingClientRect();
        if (!width || !height) return;

        // If all checks pass, then the node is focusable.
        return node;
      })
      // Sort the elements, because a node with a tabindex == 0 should come before one with tabindex == 1.
      .sort((a, b) => {
        const aIndex = a.tabIndex === -1 ? 0 : a.tabIndex;
        const bIndex = b.tabIndex === -1 ? 0 : b.tabIndex;
        return aIndex - bIndex;
      })
  );
}

const focusableElements = {
  get list() {
    return getFocusableElements(restrictFocus.activeElement);
  },

  // Second argument can be a cached list of elements (useful if you just looked it up elsewhere) ... use with caution.
  previous(currentElement, elements = this.list) {
    const index = elements.indexOf(currentElement);
    if (index === 0) {
      return elements[elements.length - 1];
    } else {
      return elements[index - 1];
    }
  },

  // Second argument can be a cached list of elements (useful if you just looked it up elsewhere) ... use with caution.

  // FIXME: we can just use document.activeElement.shadowRoot.activeElement?.shadowRoot.activeElement...
  next(currentElement, elements = this.list) {
    // TODO: (⚡) Rather than worry about whether or not a focusable element is actually _ABLE TO BE FOCUSED ON_ (ex. may be hidden) we can just try to actually `focus()` on it and then check document.activeElement. If document.activeElement is not the same thing as the element we just focused on, then it obviously cannot be focused on ;-)
    const index = elements.indexOf(currentElement);
    if (index === elements.length - 1) {
      return elements[0];
    } else {
      return elements[index + 1];
    }
  },

  first(elements = this.list) {
    const element = elements[0];
    return element;
  },

  last(elements = this.list) {
    const element = elements[elements.length - 1];
    return element;
  },
};

window.focusableElements = focusableElements;

const movementKeys = [
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
];

// Get the activeElement, regardless of whether it is in tha main document or some arbitrarily deep shadowDOM.
export function getActiveElement() {
  let activeElement = document.activeElement;
  while (activeElement.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }
  return activeElement;
}

function handleBlur(event) {
  // If no activeElement is specified, then do nothing.
  if (!restrictFocus.activeElement) return;

  // We're using a modifier key, so even if we're using the tab key we likely don't mean to tab.
  if (event.key && (event.altKey || event.ctrlKey || event.metaKey)) return;

  // If we're blurring within restrictFocus.activeElement, then do nothing, just use native behavior.
  if (restrictFocus.activeElement.contains(event.relatedTarget)) return;

  // If blur was triggered via the Tab key.
  if (restrictFocus.keys.has("Tab")) {
    handleKeyboardNavigation({ event, target: event.target });
  } else {
    // Blur was triggered via a pointer event.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.target && event.target.focus) event.target.focus();
  }
}

function handleKeyboardNavigation({
  event,
  target,
  focusElements = focusableElements.list,
}) {
  // If we tab out of the KeyTrap.activeElement, then we wrap tabbing to the first/last element,
  // depending on direction of tabbing.
  switch (target) {
    // If we're blurring off the first tabble element, tab to the last tabbable element.
    case focusElements[0]:
      focusableElements.previous(target, focusElements)?.focus();
      // focusableElements[focusableElements.length - 1].focus();
      break;

    // If we're blurring off the last tabble element, tab to the first tabbable element.
    case focusElements[focusElements.length - 1]:
      focusableElements.next(target, focusElements)?.focus();
      // focusableElements[0].focus();
      break;

    // If we're blurring off something in the middle, then revert focus back to where we came from.
    default:
      event.preventDefault();
      target?.focus();
      break;
  }
}

function handleKeyDown(event) {
  // If no activeElement is specified, then do nothing.
  if (!restrictFocus.activeElement) return;

  restrictFocus.keys.add(event.key);

  // We're not normally arrowing through things, so do nothing.
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  // We did not push a key that could change focus, so do nothing.
  if (!movementKeys.includes(event.key)) return;

  // activeElement does not exist on the page, so do nothing;
  if (!restrictFocus.activeElement.isConnected) return;

  const target = event.composedPath()[0];
  const focusElements = focusableElements.list;

  if (
    restrictFocus.activeElement.contains(target) ||
    getAllElements(restrictFocus.activeElement).has(target)
  ) {
    // If it is an element that natively handles keyboard navigation, do nothing.
    if (event.target.closest("select, video, audio")) return;

    // If it natively handles keyboard navigation, but should behave differently depending on cursor position.
    const inputElement = event.target.closest(
      "input, textarea, [contenteditable]"
    );

    if (inputElement) {
      // Handles <input> and <textarea>.
      if (inputElement.matches("input, textarea")) {
        // User has selected a range of text, so do nothing.
        if (inputElement.selectionStart !== inputElement.selectionEnd) return;

        // If user is at the start/end of an input element's value, then change the focused element.
        if (event.key === "ArrowUp" && inputElement.selectionStart !== 0)
          return;

        if (
          event.key === "ArrowDown" &&
          inputElement.selectionEnd !== inputElement.value.length
        )
          return;
      }

      // Handles anything that is [contenteditable].
      if (inputElement.matches("[contenteditable]")) {
        const selection = getSelection();

        // If the selection range start and end are not the same, then do nothing, as we've selected text.
        const range = selection.getRangeAt(selection.rangeCount - 1);
        if (
          range.startContainer !== range.endContainer ||
          range.startOffset !== range.endOffset
        )
          return;

        const treeWalker = document.createTreeWalker(
          inputElement,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function (node) {
              if (node.data.trim().length) return NodeFilter.FILTER_ACCEPT;
            },
          }
        );

        const firstNode = treeWalker.firstChild();
        let lastNode;
        while (treeWalker.nextNode()) {
          if (treeWalker.currentNode) lastNode = treeWalker.currentNode;
        }

        // debugger;
        // If the selection ends on a node and that node is not the first or last node of the contenteditable then do nothing.
        if (
          selection.focusNode !== firstNode &&
          selection.focusNode !== lastNode
        )
          return;

        // If the selection ends on the first node but the range start/end are not at the start of the node then do nothing.
        if (selection.focusNode === firstNode && range.endOffset !== 0) return;

        // If the selection ends on the last node but the range start/end are not at the end of the node then do nothing.
        if (
          selection.focusNode === lastNode &&
          range.endOffset !== selection.focusNode.data.length - 1
        )
          return;
      }
    }

    const activeElement = getActiveElement();
    let currentIndex;

    switch (event.key) {
      case "ArrowUp":
        focusableElements.previous(activeElement, focusElements)?.focus();
        break;
      case "ArrowDown":
        focusableElements.next(activeElement, focusElements)?.focus();
        // TODO: Need to handle cursor position when arrow down/up into a [contenteditable]
        break;
      case "Home":
        focusableElements.first(focusElements)?.focus();
        break;
      case "End":
        focusableElements.last(focusElements)?.focus();
        break;
      case "PageUp":
        currentIndex = focusElements.indexOf(activeElement);
        focusElements[Math.max(currentIndex - 10, 0)]?.focus();
        break;
      case "PageDown":
        currentIndex = focusElements.indexOf(activeElement);
        focusElements[
          Math.min(currentIndex + 10, focusElements.length - 1)
        ]?.focus();
        break;
    }
  } else {
    const firstFocusableElement = focusElements[0];
    if (firstFocusableElement) firstFocusableElement.focus();
  }
}

function handleKeyUp(event) {
  restrictFocus.keys.delete(event.key);
}

function preventOutsideEvent(event) {
  // If no activeElement is specified, then do nothing.
  if (!restrictFocus.activeElement) return;

  // If we expressly allow this type of event, then let it pass through.
  // debugger;
  const allowedEvents = allowEventsOnElement.get(restrictFocus.activeElement);
  if (allowedEvents?.includes(event.type)) return true;

  // Event is happening inside the activeElement, so do nothing.
  if (
    restrictFocus.activeElement.contains(event.target) ||
    getAllElements(restrictFocus.activeElement).has(event.target)
  )
    return;

  // Surface an event that details the event that was restricted. This is useful for listening to certain events that we actually do want to allow, and enabling them to be refired.
  let elementWithPointerEvents = document
    .elementsFromPoint(event.clientX, event.clientY)
    .find((node) => getComputedStyle(node).pointerEvents !== "none");

  while (elementWithPointerEvents && elementWithPointerEvents.shadowRoot) {
    elementWithPointerEvents = elementWithPointerEvents.shadowRoot
      .elementsFromPoint(event.clientX, event.clientY)
      .find((node) => getComputedStyle(node).pointerEvents !== "none");
  }

  event.preventDefault();
  event.stopImmediatePropagation();
}

function fireEvent({ element, eventName }) {
  const event = new CustomEvent(`restrict-focus:${eventName}`, {
    detail: element,
  });
  window.dispatchEvent(event);
  element.dispatchEvent(event);
}

const allowEventsOnElement = new WeakMap();

const restrictFocus = {
  list: [],

  get activeElement() {
    const element = this.list[this.list.length - 1];
    if (!element) return document.body;
    if (element.isConnected) return element;

    // Element is no longer on the page, so update the list and go to the previous element.
    this.remove(element);
    return this.activeElement;
  },

  add(element, options = { allowedEvents: [], callback: undefined }) {
    this.list.push(element);
    allowEventsOnElement.set(element, options.allowedEvents);

    // If we are not currently focused somewhere within the activeElement, focus on the activeElement itself.
    if (!element.matches(":focus-within")) {
      const focusableElements = getFocusableElements(element);
      const originalTabIndex = restrictFocus.activeElement.tabIndex;
      // Temporarily set tabIndex to a value which can legitimately be focused on
      // (while -1 technically is able, it does not change the *NEXT* item to be focused on).
      restrictFocus.activeElement.tabIndex = 0;
      restrictFocus.activeElement.focus();
      // Revert tabIndex to original value.
      restrictFocus.activeElement.tabIndex = originalTabIndex;
    }

    fireEvent({ element, eventName: "added" });
    options?.callback?.call(element, element);
    return this;
  },

  remove(element, options = { callback: undefined }) {
    let deleteIndex;
    for (let i = this.list.length - 1; i > -1; i--) {
      if (this.list[i] === element) {
        deleteIndex = i;
        break;
      }
    }
    if (typeof deleteIndex !== "undefined") {
      this.list.splice(deleteIndex, 1);
    }
    fireEvent({ element, eventName: "removed" });
    options?.callback?.call(element, element);
    return this;
  },

  // Keep track of any regular keys being pressed.
  keys: new Set(),
};

window.addEventListener("keydown", handleKeyDown, { capture: true });
window.addEventListener("keyup", handleKeyUp, { capture: true });
window.addEventListener("blur", handleBlur, { capture: true });
// window.addEventListener("focus", preventFocusChange, { capture: true });
window.addEventListener("mousedown", preventOutsideEvent, {
  capture: true,
});
window.addEventListener("mouseup", preventOutsideEvent, {
  capture: true,
});
window.addEventListener("touchstart", preventOutsideEvent, {
  capture: true,
});
window.addEventListener("touchend", preventOutsideEvent, {
  capture: true,
});

window.addEventListener("click", preventOutsideEvent, {
  capture: true,
});

export default restrictFocus;

window.restrictFocus = restrictFocus;
// TODO: JS error when rapidly turning the storybook "open" toggle on and off. Appears to be a storybook issue, as I'm not able to reproduce by toggling the component itself rapidly. Also storybooks' hot reloading is sometimes enough to trigger it.

// FIXME: Hitting the "space" key makes the page move down by one page. This needs to be fixed in "restrict-scroll".
