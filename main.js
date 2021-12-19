import restrictFocus from "./src/index";

const template = document.createElement("template");
template.innerHTML = `
  <button>Start: Web component button</button>
  <slot></slot>
  <button>End: Web component button</button>
`;
class WebComponentElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }
}

if (!window.customElements.get("web-component-element")) {
  window.customElements.define("web-component-element", WebComponentElement);
}

window.addEventListener("restrict-focus:added", (e) => {
  e.detail.style.boxShadow = "0 0 0 3px lime";
});
window.addEventListener("restrict-focus:removed", (e) => {
  e.detail.style.boxShadow = "";
});
restrictFocus.add(document.getElementById("second"));

document.querySelectorAll("button.toggleFocus").forEach((button) => {
  button.addEventListener("click", (e) => {
    const section = e.target.closest("div[id]");
    if (restrictFocus?.activeElement?.contains(button)) {
      restrictFocus.delete(section);
    } else {
      restrictFocus.add(section);
    }
  });
});
