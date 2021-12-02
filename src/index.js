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
      node.tabIndex > -1 &&
      !node.disabled &&
      !node.getAttribute("disabled")
    ) {
      tabbableElements.push(node);

      // Dig into any shadowRoot to get more tabbable things!
      if (node.shadowRoot) getTabbableElements(node, tabbableElements);
    }
  });

  // Sort the tabbable elements, because a node with a tabindex == 0 should come before one with tabindex == 1.
  return tabbableElements.sort((a, b) => a.tabIndex - b.tabIndex);
}

const focusableElements = {
  get list() {
    return getTabbableElements(restrictFocus.activeElement);
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

// function focusableElements() {
//   return {
//     get list() {
//       return getTabbableElements(restrictFocus.activeElement);
//     },
//     previous(currentElement, elements = this.list) {
//       const index = elements.indexOf(currentElement);
//       if (index === 0) {
//         return elements[elements.length - 1];
//       } else {
//         return elements[index - 1];
//       }
//     },
//     next(currentElement, elements = this.list) {
//       const index = elements.indexOf(currentElement);
//       debugger;
//       if (index === elements.length - 1) {
//         return elements[0];
//       } else {
//         return elements[index + 1];
//       }
//     },
//   };
// }

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

  // FIXME: How do we capture that something was `.focus()`-ed into??
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
    if (event.target.closest("input, textarea, [contenteditable]")) {
      // TODO: Make it handle multiple up/down arrow keys
      // User has selected a range of text, so do nothing.
      if (event.target.selectionStart !== event.target.selectionEnd) return;

      if (event.key === "ArrowUp" && event.target.selectionStart === 0) {
        focusableElements.previous(event.target, focusElements)?.focus();
        return;
      } else if (
        event.key === "ArrowDown" &&
        event.target.selectionStart === event.target.value.length
      ) {
        focusableElements.next(document.activeElement, focusElements)?.focus();
        return;
      }
      // Default case (probably want to do nothing).
      return;
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

  // // If any of our activeElements contain the target node, then any tabbing will be handled natively.
  // if (!activeElements.any((node) => node.contains(target))) return;
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

// function preventFocusChange(event) {
//   // TODO: Why is this not firing when $0.focus()?
//   debugger;
//   // event.preventDefault();
//   // event.stopImmediatePropagation();
// }

// window.addEventListener('keydown', handleKeyboardEvent, { capture: true });
// window.addEventListener('keypress', handleKeyboardEvent, { capture: true });
// window.addEventListener('keyup', handleKeyboardEvent, { capture: true });

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
      const focusableElements = getTabbableElements(element);
      focusableElements[0]?.focus();
    }
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

window.restrictFocus = restrictFocus;
