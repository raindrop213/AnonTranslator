const output = document.querySelector('#results'), cases = document.querySelector('#cases');
const results = [];
const near = (a, b) => Math.abs(a - b) < 1;
const settle = win => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
const assert = (condition, message) => {
  results.push(`${condition ? 'PASS' : 'FAIL'} ${message}`);
  output.textContent = results.join('\n');
  if (!condition) throw new Error(message);
};

async function loadSettings(label, width, height, userscript = false) {
  const figure = document.createElement('figure'), caption = document.createElement('figcaption');
  caption.textContent = label;
  const frame = document.createElement('iframe');
  frame.title = label; frame.style.width = `${width}px`; frame.style.height = `${height}px`;
  const loaded = new Promise((resolve, reject) => {
    frame.addEventListener('load', resolve, { once: true });
    frame.addEventListener('error', () => reject(new Error(`${label} 加载失败`)), { once: true });
  });
  frame.src = `/settings.html?${userscript ? 'userscript&' : ''}size-regression=${width}x${height}`;
  figure.append(caption, frame); cases.append(figure); await loaded;
  const doc = frame.contentDocument, win = frame.contentWindow;
  for (let attempt = 0; attempt < 120 && !doc.querySelector('.at-settings'); attempt++) await settle(win);
  if (!doc.querySelector('.at-settings')) throw new Error(`${label} 未挂载设置表单`);
  await settle(win);
  return { frame, doc, win, caption };
}

async function checkChrome(width, height) {
  const label = `Chrome 初始 ${width} × ${height}`;
  const { frame, doc, win, caption } = await loadSettings(label, width, height);
  const sizes = [];
  // Chrome's toolbar popup measures its document, then gives it a new viewport.
  // Measuring only a comfortable 380×600 iframe would miss the feedback loop.
  for (let iteration = 0; iteration < 5; iteration++) {
    const measured = { width: Math.max(doc.body.offsetWidth, doc.body.scrollWidth), height: Math.max(doc.body.offsetHeight, doc.body.scrollHeight) };
    sizes.push(`${measured.width}×${measured.height}`);
    frame.style.width = `${measured.width}px`; frame.style.height = `${measured.height}px`;
    await settle(win);
  }
  assert(sizes.every(size => size === '380×600') && win.innerWidth === 380 && win.innerHeight === 600,
    `${label} 自动测量稳定为 380 × 600：${sizes.join(' → ')}`);
  const form = doc.querySelector('.at-settings'), header = doc.querySelector('.at-header'), tabs = doc.querySelector('.at-tabs');
  const panel = [...doc.querySelectorAll('.at-tab-panel')].find(element => !element.hidden);
  assert(near(form.getBoundingClientRect().width, 380) && near(form.getBoundingClientRect().height, 600), `${label} 设置表单填满弹窗`);
  const headerTop = header.getBoundingClientRect().top, tabsTop = tabs.getBoundingClientRect().top;
  assert(win.getComputedStyle(panel).overflowY === 'auto' && panel.scrollHeight > panel.clientHeight, `${label} 词典栏内容在内部滚动`);
  panel.scrollTop = 80; await settle(win);
  assert(panel.scrollTop > 0 && near(header.getBoundingClientRect().top, headerTop) && near(tabs.getBoundingClientRect().top, tabsTop),
    `${label} 滚动内容时标题、标签栏固定`);
  doc.scrollingElement.scrollTop = 80; doc.scrollingElement.scrollLeft = 80; await settle(win);
  assert(doc.scrollingElement.scrollTop === 0 && doc.scrollingElement.scrollLeft === 0 && doc.body.scrollHeight <= win.innerHeight && doc.body.scrollWidth <= win.innerWidth,
    `${label} body 无外层滚动`);
  caption.textContent = `${label} → 380 × 600`;
}

async function checkUserscript(width, height) {
  const label = `油猴视口 ${width} × ${height}`;
  const { doc, win } = await loadSettings(label, width, height, true);
  const box = doc.querySelector('.at-dialog-panel'), form = box.querySelector('.at-settings');
  const panel = [...box.querySelectorAll('.at-tab-panel')].find(element => !element.hidden);
  const rect = box.getBoundingClientRect();
  assert(near(rect.width, Math.min(420, width)) && near(rect.height, height) && near(rect.right, width) && near(rect.top, 0),
    `${label} 面板宽 ${Math.min(420, width)}，高度适应视口并靠右`);
  assert(form.getBoundingClientRect().height <= height && win.getComputedStyle(panel).overflowY === 'auto' && panel.scrollHeight > panel.clientHeight,
    `${label} 设置内容保留内部滚动`);
}

async function run() {
  const button = document.querySelector('#rerun'); button.disabled = true;
  results.length = 0; cases.replaceChildren(); output.textContent = '正在运行…';
  for (const execute of [() => checkChrome(150, 110), () => checkChrome(25, 25), () => checkUserscript(720, 520), () => checkUserscript(320, 480)]) {
    try { await execute(); }
    catch (error) { if (!results.at(-1)?.startsWith('FAIL ')) results.push('FAIL ' + error.message); }
  }
  const failed = results.some(line => line.startsWith('FAIL '));
  results.push(`完成：${results.filter(line => line.startsWith('PASS ')).length} 项通过${failed ? '，存在失败项' : ''}`);
  output.textContent = results.join('\n'); document.title = `${failed ? 'FAIL' : 'PASS'} 设置尺寸回归验证`; button.disabled = false;
}
document.querySelector('#rerun').addEventListener('click', run);
await run();
