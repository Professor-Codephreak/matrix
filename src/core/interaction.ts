// matrix-fx — drag utility
//
// Free-floating drag for the brand, ship, and fleet widgets. Pointer + touch.
// Pure DOM, no module state — safe to use on any element.

export function makeDraggable(element: HTMLElement): void {
  let dragOffsetX = 0, dragOffsetY = 0;
  let elemDragging = false;

  const onDown = (clientX: number, clientY: number) => {
    elemDragging = true;
    const rect = element.getBoundingClientRect();
    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;
    element.style.cursor = 'grabbing';
    element.style.zIndex = '50';
  };

  const onMove = (clientX: number, clientY: number) => {
    if (!elemDragging) return;
    const x = clientX - dragOffsetX;
    const y = clientY - dragOffsetY;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    element.style.transform = 'none';
  };

  const onUp = () => {
    elemDragging = false;
    element.style.cursor = '';
    element.style.zIndex = '';
  };

  element.addEventListener('mousedown', (e) => { e.stopPropagation(); onDown(e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onUp);
  element.addEventListener('touchstart', (e) => { e.stopPropagation(); const t = e.touches[0]; onDown(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener('touchmove', (e) => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener('touchend', onUp);
}
