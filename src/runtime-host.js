import { createKeyMap } from "./key-map.js";
import { WorkflowDAGError } from "./workflow-error.js";

const HOST_STYLE_PROPERTIES = [
  "-webkit-tap-highlight-color",
  "--eino-workflow-dag-title-bg",
  "--eino-workflow-dag-title-color",
  "--eino-workflow-dag-title-hover-bg",
  "--eino-workflow-dag-title-hover-border",
  "--eino-workflow-dag-title-font",
  "--eino-workflow-dag-tooltip-bg",
  "--eino-workflow-dag-tooltip-color",
  "--eino-workflow-dag-tooltip-border",
  "--eino-workflow-dag-tooltip-pinned-border",
  "--eino-workflow-dag-tooltip-shadow",
  "--eino-workflow-dag-tooltip-pinned-shadow",
  "--eino-workflow-dag-tooltip-radius",
  "--eino-workflow-dag-tooltip-max-width",
  "--eino-workflow-dag-tooltip-max-height",
  "--eino-workflow-dag-tooltip-font-size",
  "--eino-workflow-dag-tooltip-line-height",
  "--eino-workflow-dag-tooltip-padding-x",
  "--eino-workflow-dag-tooltip-padding-y",
];

function setPixelProperty(element, name, value) {
  element.style.setProperty(name, `${value}px`);
}

export function createHostDomLifecycle(container) {
  const initialChildren = Array.from(container.childNodes);
  const addedHostClass = !container.classList.contains("eino-workflow-dag-host");
  const hadTheme = container.hasAttribute("data-theme");
  const previousTheme = container.getAttribute("data-theme");
  const previousBackground = {
    value: container.style.getPropertyValue("background"),
    priority: container.style.getPropertyPriority("background"),
  };
  const previousStyles = createKeyMap();
  HOST_STYLE_PROPERTIES.forEach((property) => {
    previousStyles[property] = {
      value: container.style.getPropertyValue(property),
      priority: container.style.getPropertyPriority(property),
    };
  });
  container.classList.add("eino-workflow-dag-host");

  function applyThemeChrome(tokens, themeId) {
    container.style.background = tokens.canvas.bg;
    container.setAttribute("data-theme", themeId);
    const overlay = tokens.overlay;
    const tooltip = tokens.tooltip;
    container.style.setProperty("--eino-workflow-dag-title-bg", overlay.titleBg);
    container.style.setProperty("--eino-workflow-dag-title-color", overlay.titleColor);
    container.style.setProperty("--eino-workflow-dag-title-hover-bg", overlay.titleHoverBg);
    container.style.setProperty("--eino-workflow-dag-title-hover-border", overlay.titleHoverBorder);
    if (overlay.titleFont) {
      container.style.setProperty("--eino-workflow-dag-title-font", overlay.titleFont);
    } else {
      container.style.removeProperty("--eino-workflow-dag-title-font");
    }
    container.style.setProperty("--eino-workflow-dag-tooltip-bg", tooltip.bg);
    container.style.setProperty("--eino-workflow-dag-tooltip-color", tooltip.color);
    container.style.setProperty("--eino-workflow-dag-tooltip-border", tooltip.borderColor);
    container.style.setProperty(
      "--eino-workflow-dag-tooltip-pinned-border",
      tooltip.pinnedBorderColor,
    );
    container.style.setProperty("--eino-workflow-dag-tooltip-shadow", tooltip.shadow);
    container.style.setProperty(
      "--eino-workflow-dag-tooltip-pinned-shadow",
      tooltip.pinnedShadow,
    );
    setPixelProperty(container, "--eino-workflow-dag-tooltip-radius", tooltip.radius);
    setPixelProperty(container, "--eino-workflow-dag-tooltip-max-width", tooltip.maxWidth);
    setPixelProperty(container, "--eino-workflow-dag-tooltip-max-height", tooltip.maxHeight);
    setPixelProperty(container, "--eino-workflow-dag-tooltip-font-size", tooltip.fontSize);
    container.style.setProperty(
      "--eino-workflow-dag-tooltip-line-height",
      String(tooltip.lineHeight),
    );
    setPixelProperty(container, "--eino-workflow-dag-tooltip-padding-x", tooltip.paddingX);
    setPixelProperty(container, "--eino-workflow-dag-tooltip-padding-y", tooltip.paddingY);
  }

  function restore(cytoscapeInstance, rendererChildren) {
    if (cytoscapeInstance) {
      const childrenToRestore = initialChildren.filter(
        (child) => child.parentNode === container,
      );
      cytoscapeInstance.destroy();
      childrenToRestore.forEach((child) => container.appendChild(child));
    }
    (rendererChildren || []).forEach((child) => {
      if (child.parentNode === container) child.remove();
    });
    if (previousBackground.value) {
      container.style.setProperty(
        "background",
        previousBackground.value,
        previousBackground.priority,
      );
    } else {
      container.style.removeProperty("background");
    }
    if (hadTheme) container.setAttribute("data-theme", previousTheme);
    else container.removeAttribute("data-theme");
    HOST_STYLE_PROPERTIES.forEach((property) => {
      const previous = previousStyles[property];
      if (previous && previous.value) {
        container.style.setProperty(property, previous.value, previous.priority);
      } else {
        container.style.removeProperty(property);
      }
    });
    if (addedHostClass) container.classList.remove("eino-workflow-dag-host");
  }

  return { applyThemeChrome, restore };
}

export function createHostCallbackBoundary({ debug, isDestroyed, onError }) {
  function logError(message, error) {
    if (debug && typeof console !== "undefined" && console.error) {
      console.error(message, error);
    }
  }

  function reportError(error) {
    const normalized = error instanceof WorkflowDAGError
      ? error
      : new WorkflowDAGError(
          "RENDERER_RECOVERED",
          error instanceof Error ? error.message : String(error),
          { recoverable: true, cause: error },
        );
    try {
      const result = onError()(normalized);
      if (result && typeof result.then === "function") {
        Promise.resolve(result).catch((listenerError) => {
          logError("[eino-workflow-dag] onError callback failed", listenerError);
        });
      }
    } catch (listenerError) {
      logError("[eino-workflow-dag] onError callback failed", listenerError);
    }
    logError("[eino-workflow-dag] renderer recovered from an error", normalized);
  }

  function reportCallbackError(name, error) {
    if (isDestroyed()) return;
    reportError(new WorkflowDAGError(
      "RENDERER_RECOVERED",
      `${name} callback failed: ${error instanceof Error ? error.message : String(error)}`,
      { recoverable: true, cause: error },
    ));
  }

  function callHost(name, callback, args, fallback) {
    try {
      return callback.apply(null, args);
    } catch (error) {
      reportCallbackError(name, error);
      return typeof fallback === "function" ? fallback() : fallback;
    }
  }

  function notifyHost(name, callback, value) {
    const result = callHost(name, callback, [value]);
    try {
      if (result && typeof result.then === "function") {
        Promise.resolve(result).catch((error) => reportCallbackError(name, error));
      }
    } catch (error) {
      reportCallbackError(name, error);
    }
  }

  return { callHost, notifyHost, reportError };
}
