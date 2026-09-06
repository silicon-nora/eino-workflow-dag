/** Observe an element without delivering duplicate size notifications. */
export function observeElementResize(element, onResize) {
  if (!element || typeof ResizeObserver !== "function") {
    return { disconnect() {} };
  }

  let width = element.clientWidth;
  let height = element.clientHeight;
  let frame = null;
  let nextSize = null;

  function deliver() {
    frame = null;
    if (!nextSize) return;
    const size = nextSize;
    nextSize = null;
    onResize(size);
  }

  const observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    const nextWidth = rect?.width ?? element.clientWidth;
    const nextHeight = rect?.height ?? element.clientHeight;
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    nextSize = { width, height };
    if (frame !== null) return;
    if (typeof requestAnimationFrame === "function") {
      frame = requestAnimationFrame(deliver);
    } else {
      deliver();
    }
  });
  observer.observe(element);

  return {
    disconnect() {
      observer.disconnect();
      nextSize = null;
      if (frame !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frame);
      }
      frame = null;
    },
  };
}
