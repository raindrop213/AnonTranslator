// Native dragging and ordinary buttons share the same small ordering operation.
export function mountServiceOrdering(parent, key, groups, save, initialOrder) {
  const doc = parent.ownerDocument, container = doc.createElement('div');
  container.className = 'at-service-order'; container.dataset.order = key;
  const first = groups.values().next().value; first.before(container);
  const buttons = new Map();
  let dragging = null;
  const currentOrder = () => [...container.children].map(group => group.dataset.atProvider);
  function refresh(order) {
    order.forEach((id, index) => {
      const group = groups.get(id); if (!group) return;
      if (container.children[index] !== group) container.insertBefore(group, container.children[index] || null);
      buttons.get(id).up.disabled = index === 0; buttons.get(id).down.disabled = index === order.length - 1;
    });
  }
  function move(id, to) {
    const order = currentOrder(), from = order.indexOf(id);
    if (from < 0 || to < 0 || to >= order.length || from === to) return;
    order.splice(from, 1); order.splice(to, 0, id); refresh(order); save(order);
  }
  function clearDrag() {
    dragging = null; container.querySelectorAll('.at-service-dragging,.at-service-drop').forEach(group => group.classList.remove('at-service-dragging', 'at-service-drop'));
  }
  for (const [id, group] of groups) {
    group.classList.add('at-order-item'); group.dataset.atProvider = id;
    const legend = group.querySelector('legend'), name = legend.textContent, tools = doc.createElement('span'); tools.className = 'at-order-tools';
    const button = (text, label) => { const item = doc.createElement('button'); item.type = 'button'; item.textContent = text; item.title = label; item.setAttribute('aria-label', label); tools.append(item); return item; };
    const handle = button('⠿', `拖动调整 ${name} 顺序，也可使用上下方向键`), up = button('↑', `上移 ${name}`), down = button('↓', `下移 ${name}`);
    handle.draggable = true; handle.className = 'at-order-handle'; legend.append(tools); buttons.set(id, { up, down });
    up.addEventListener('click', () => { move(id, currentOrder().indexOf(id) - 1); handle.focus(); });
    down.addEventListener('click', () => { move(id, currentOrder().indexOf(id) + 1); handle.focus(); });
    handle.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const order = currentOrder(), to = event.key === 'Home' ? 0 : event.key === 'End' ? order.length - 1 : order.indexOf(id) + (event.key === 'ArrowUp' ? -1 : 1);
      move(id, to); handle.focus();
    });
    handle.addEventListener('dragstart', event => {
      dragging = id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); group.classList.add('at-service-dragging');
    });
    handle.addEventListener('dragend', clearDrag);
    container.append(group);
  }
  container.addEventListener('dragover', event => {
    const group = event.target.closest?.('.at-order-item');
    if (!dragging || !group || group.parentElement !== container) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
    container.querySelectorAll('.at-service-drop').forEach(item => item.classList.remove('at-service-drop'));
    group.classList.add('at-service-drop');
  });
  container.addEventListener('drop', event => {
    const group = event.target.closest?.('.at-order-item');
    if (!dragging || !group || group.parentElement !== container) return;
    event.preventDefault(); move(dragging, currentOrder().indexOf(group.dataset.atProvider)); clearDrag();
  });
  refresh(initialOrder);
  return { refresh };
}
