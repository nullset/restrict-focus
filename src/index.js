// TODO: This needs to be revamped a bit. First need to check if element has shadowRoot. If it does,
// Then walk shadow root, look for any tabbale nodes, and simultaneously look into assignedNodes. Do not
// look into light dom any other way. Otherwise it is possible that things will be out of order, since populating
// slots doesn't have to take place in any particular order or location within the light DOM.
// If it does not have a shadow root, then it's fine just doing a querySelectorAll.
// FIXME: We should be able to programatically focus to tabIndex == -1, just not tab to them.
// TODO: Would a TreeWalker do this more efficiently?
function getTabbableElements(element, tabbableElements = []) {
  element.querySelectorAll("*").forEach((node) => {
    if (
      (node.tabIndex > -1 ||
        (node.isContentEditable && node.hasAttribute("contenteditable"))) &&
      !node.disabled &&
      !node.getAttribute("disabled")
      // TODO: nodes can only be focused if they are currently visible too
    ) {
      tabbableElements.push(node);

      // Dig into any shadowRoot to get more tabbable things!
      if (node.shadowRoot) getTabbableElements(node, tabbableElements);
    }
  });

  // Sort the tabbable elements, because a node with a tabindex == 0 should come before one with tabindex == 1.
  return tabbableElements.sort((a, b) => {
    const aIndex = a.tabIndex === -1 ? 0 : a.tabIndex;
    const bIndex = b.tabIndex === -1 ? 0 : b.tabIndex;
    return aIndex - bIndex;
  });
}

function getAllElements(elements, list = new Set()) {
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

        // list.add(node);
        // if (!node.shadowRoot && node.tagName !== "SLOT") {
        //   list.add(node);
        // } else if (node.tagName === "SLOT") {
        //   node.assignedElements().forEach((slottedElement) => {
        //     getAllElements(slottedElement, list);
        //   });
        // } else if (node.shadowRoot) {
        //   getAllElements(node.shadowRoot, list);
        // }
      });
    }
  });

  return list;
}

function getFocusableElements(element) {
  const elements = Array.from(getAllElements(element));
  // console.log(elements);

  // const elements = Array.from(querySelectorAll(element));

  return (
    elements
      .filter((node) => {
        if (
          (node.tabIndex > -1 ||
            (node.isContentEditable && node.hasAttribute("contenteditable"))) &&
          !node.disabled &&
          !node.getAttribute("disabled")
          // TODO: nodes can only be focused if they are currently visible too
        ) {
          return node;
        }
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

function handleBlur(event) {
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
    event?.target?.focus();
  }
}

function handleKeyboardNavigation({
  event,
  target,
  focusElements = focusableElements.list,
}) {
  // We're blurring to something outside the activeElement, so we need to know what we are focusing to.
  // const focusableElements = getTabbableElements(restrictFocus.activeElement);

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
  restrictFocus.keys.add(event.key);

  // We're not normally arrowing through things, so do nothing.
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  // We did not push a key that could change focus, so do nothing.
  if (!movementKeys.includes(event.key)) return;

  // If no activeElement is specified, then do nothing.
  if (!restrictFocus.activeElement) return;

  // activeElement does not exist on the page, so do nothing;
  if (!restrictFocus.activeElement.isConnected) return;

  const target = event.composedPath()[0];
  const focusElements = focusableElements.list;

  if (restrictFocus.activeElement.contains(target)) {
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

    let currentIndex;
    switch (event.key) {
      case "ArrowUp":
        focusableElements
          .previous(document.activeElement, focusElements)
          ?.focus();
        break;
      case "ArrowDown":
        focusableElements.next(document.activeElement, focusElements)?.focus();
        // TODO: Need to handle cursor position when arrow down/up into a [contenteditable]
        break;
      case "Home":
        focusableElements.first(focusElements)?.focus();
        break;
      case "End":
        focusableElements.last(focusElements)?.focus();
        break;
      case "PageUp":
        currentIndex = focusElements.indexOf(document.activeElement);
        focusElements[Math.max(currentIndex - 10, 0)]?.focus();
        break;
      case "PageDown":
        currentIndex = focusElements.indexOf(document.activeElement);
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
  if (!restrictFocus.activeElement) return;

  // Event is happening inside the activeElement, so do nothing.
  if (restrictFocus.activeElement.contains(event.target)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
}

function fireEvent({ element, eventName }) {
  const event = new CustomEvent("restrict-focus:added", { detail: element });
  document.dispatchEvent(event);
  element.dispatchEvent(event);
}

const restrictFocus = {
  list: [],

  get activeElement() {
    const element = this.list[this.list.length - 1];
    if (element.isConnected) return element;

    // Element is no longer on the page, so update the list and go to the previous element.
    this.delete(element);
    return this.activeElement;
  },

  add(element) {
    this.list.push(element);

    // If we are not currently focused somewhere within the activeElement, focus on the first focusable element.
    if (!element.matches(":focus-within")) {
      const focusableElements = getFocusableElements(element);
      focusableElements[0]?.focus();
    }

    fireEvent({ element, eventName: "added" });
    return this;
  },

  delete(element) {
    let deleteIndex;
    for (let i = this.list.length - 1; i > 0; i--) {
      if (this.list[i] === element) {
        deleteIndex = i;
        break;
      }
    }
    if (typeof deleteIndex !== "undefined") {
      this.list = this.list.splice(deleteIndex, 1);
    }
    fireEvent({ element, eventName: "removed" });
    return this;
  },

  // Keep track of any regular keys being pressed.
  keys: new Set(),
};

document.body.addEventListener("keydown", handleKeyDown, { capture: true });
document.body.addEventListener("keyup", handleKeyUp, { capture: true });
document.body.addEventListener("blur", handleBlur, { capture: true });
// document.body.addEventListener("focus", preventFocusChange, { capture: true });
document.body.addEventListener("mousedown", preventOutsideEvent, {
  capture: true,
});
document.body.addEventListener("mouseup", preventOutsideEvent, {
  capture: true,
});
document.body.addEventListener("touchstart", preventOutsideEvent, {
  capture: true,
});
document.body.addEventListener("touchend", preventOutsideEvent, {
  capture: true,
});

document.body.addEventListener("click", preventOutsideEvent, {
  capture: true,
});

export default restrictFocus;
