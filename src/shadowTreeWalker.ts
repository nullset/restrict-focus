interface Options {
  checkFocusable?: boolean;
  filterTagName?: string;
}

export function isFocusable(node: HTMLElement): boolean {
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

interface Options {
  checkFocusable?: boolean;
  matches?: string;
}

/**
 * Walks through DOM elements including Shadow DOM
 */
export default class ShadowTreeWalker {
  private root: Element;
  private checkFocusable: boolean;
  private matches: string;
  private elements: Set<HTMLElement>;

  /**
   * Creates a new ShadowTreeWalker instance.
   * @param root An HTML element to start walking from.
   * @param opts Options to configure the walker.
   * @param opts.checkFocusable If true, the `walk` method will only return focusable elements.
   * @param opts.matches If provided, the `walk` method will only return elements that matches the provided value (ex. `input[type="number"]` will return only `<input type="number">` elements).
   */
  constructor(
    root: Element,
    opts: Options = { checkFocusable: false, matches: "" }
  ) {
    this.root = root;
    this.checkFocusable = opts.checkFocusable || false;
    this.matches = opts.matches || "";
    this.elements = new Set();
  }

  /**
   * A function to walk the shadow tree and return a set of HTMLElements.
   * @returns A set of HTMLElements found in the shadow tree.
   */
  walk(): Set<HTMLElement> {
    this.walkNode(this.root);
    return this.elements;
  }

  private isValidNode(node: Element): boolean {
    if (this.matches) {
      if (!node.matches(this.matches)) return false;
    }
    if (this.checkFocusable) {
      if (!isFocusable(node as HTMLElement)) return false;
    }

    return true;
  }

  private walkNode(node: Element | Node): void {
    if (node instanceof HTMLSlotElement) {
      const assigned = node.assignedElements({ flatten: true });
      assigned.forEach((element) => {
        if (element instanceof HTMLElement && this.isValidNode(element)) {
          this.elements.add(element);
        }
        this.walkNode(element);
      });
    }

    if (node instanceof HTMLElement && this.isValidNode(node)) {
      this.elements.add(node);
    }

    if (node instanceof Element && node.shadowRoot) {
      this.walkChildren(node.shadowRoot);
    }

    this.walkChildren(node);
  }

  private walkChildren(node: Node): void {
    const children = node.childNodes;
    if (children) {
      Array.from(children).forEach((child) => this.walkNode(child));
    }
  }
}
