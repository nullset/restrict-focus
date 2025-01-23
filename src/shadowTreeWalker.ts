// @ts-nocheck

interface Options {
  checkFocusable?: boolean;
  asArray?: boolean;
}

export function isFocusable(node: HTMLElement) {
  if (!(node instanceof HTMLElement)) return false;
  if (!node.isConnected) return false;
  if (node.hasAttribute("disabled")) return false;
  if (node.inert) return false;
  if (node.tabIndex < 0) return false;
  if (node.hasAttribute("disabled")) return false;
  if (node.hasAttribute("inert")) return false;
  if (node instanceof HTMLLinkElement && !node.href) return false;

  const { width, height } = node.getBoundingClientRect();
  if (!width || !height) return false;

  return true;
}

export default class ShadowTreeWalker {
  constructor(
    root: Element,
    opts: Options = { checkFocusable: false }
  ): Set<Element> {
    this.root = root;
    this.checkFocusable = opts.checkFocusable;
    this.elements = new Set();
    return this.walk();
  }

  walk() {
    this.walkNode(this.root);
    return this.elements;
  }

  isValidNode(node) {
    if (!this.checkFocusable) return true;
    return isFocusable(node);
  }

  walkNode(node) {
    // Handle slotted elements
    if (node instanceof HTMLSlotElement) {
      const assigned = node.assignedElements({ flatten: true });
      assigned.forEach((element) => {
        if (this.isValidNode(element)) {
          this.elements.add(element);
        }
        this.walkNode(element);
      });
    }

    // Check if current node is focusable
    if (this.isValidNode(node)) {
      this.elements.add(node);
    }

    // Walk shadow root
    if (node instanceof Element && node.shadowRoot) {
      this.walkChildren(node.shadowRoot);
    }

    // Walk regular children
    this.walkChildren(node);
  }

  walkChildren(node) {
    const children = node.childNodes;
    if (children) {
      Array.from(children).forEach((child) => this.walkNode(child));
    }
  }
}
