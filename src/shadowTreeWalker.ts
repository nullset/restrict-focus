interface Options {
  checkFocusable?: boolean;
  matches?: string;
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

/**
 * Walks through DOM elements including Shadow DOM using the TreeWalker API,
 * maintaining proper order of elements across shadow boundaries and slots.
 */
export default class ShadowTreeWalker {
  private root: Element;
  private checkFocusable: boolean;
  private matches: string;
  private elements: Array<HTMLElement>;

  /**
   * Creates a new ShadowTreeWalker instance.
   * @param root An HTML element to start walking from.
   * @param opts Options to configure the walker.
   * @param opts.checkFocusable If true, the `walk` method will only return focusable elements.
   * @param opts.matches If provided, the `walk` method will only return elements that matches the provided value.
   */
  constructor(
    root: Element,
    opts: Options = { checkFocusable: false, matches: "" }
  ) {
    this.root = root;
    this.checkFocusable = opts.checkFocusable || false;
    this.matches = opts.matches || "";
    this.elements = [];
  }

  /**
   * A function to walk the shadow tree and return a set of HTMLElements.
   * @returns A set of HTMLElements found in the shadow tree in document order.
   */
  walk(): Set<HTMLElement> {
    this.walkNode(this.root);
    return new Set(this.elements);
  }

  private isValidNode(node: Element): boolean {
    if (this.matches && !node.matches(this.matches)) return false;
    if (this.checkFocusable && !isFocusable(node as HTMLElement)) return false;
    return true;
  }

  private walkNode(node: Node): void {
    const walker = document.createTreeWalker(
      node,
      NodeFilter.SHOW_ELEMENT,
      null
    );

    let currentNode: Node | null = walker.currentNode;

    while (currentNode) {
      if (currentNode instanceof Element) {
        // Handle the current node
        if (
          currentNode instanceof HTMLElement &&
          this.isValidNode(currentNode)
        ) {
          this.elements.push(currentNode);
        }

        // Handle shadow DOM
        if (currentNode.shadowRoot) {
          this.walkNode(currentNode.shadowRoot);
        }

        // Handle slot elements
        if (currentNode instanceof HTMLSlotElement) {
          const assigned = currentNode.assignedElements({ flatten: true });
          for (const element of assigned) {
            if (element instanceof HTMLElement && this.isValidNode(element)) {
              this.elements.push(element);
            }
            // Recursively walk through the assigned elements
            if (element instanceof Element) {
              this.walkNode(element);
            }
          }
        }
      }

      currentNode = walker.nextNode();
    }
  }
}
