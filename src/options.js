// 加载 Windows TTS 语音
function loadWindowsVoices() {
  chrome.tts.getVoices(voices => {
    const voiceSelect = document.getElementById('voiceName');
    voices.forEach(voice => {
      let option = document.createElement('option');
      option.text = voice.voiceName;
      option.value = voice.voiceName;
      voiceSelect.add(option);
    })
  });
}

// 加载 VITS TTS 语音
function loadVitsVoices() {
  // 使用 fetch API 从指定的路径获取 voice.json 文件
  fetch('src/voice.json')
    .then(response => response.json()) // 将响应解析为 JSON
    .then(data => {
      // 获取 HTML 中的选择框元素
      const vitsVoiceSelect = document.getElementById('vitsVoice');

      // VITS 语音数据遍历
      data.VITS.forEach(voice => {
        // 创建每个语音的选项
        let option = document.createElement('option');
        option.text = `${voice.id}_${voice.lang.join('/')}_${voice.name}`;
        option.value = voice.id;

        // 将选项添加到选择框中
        vitsVoiceSelect.add(option);
      });
    })
    .catch(error => {
      console.error('加载 VITS 语音时出错:', error);
    });
}




// 加载保存的设置
function loadSettings() {
  chrome.storage.local.get([
    'ignoreRT', 'useVITS', 
    'voiceName', 'rate', 'pitch', 'clipAPI', 'vitsAPI', 
    'vitsVoice', 'length', 'noise', 'noisew', 'max', 'streaming', 
    'google', 'googleColor', 'deepl', 'deeplColor', 
    'borderWidth', 'borderStyle', 'borderRadius', 
    'freeBorderColor', 'selectedBorderColor', 
  ], (data) => {
    loadWindowsVoices(); // 加载 Windows TTS 语音选项
    loadVitsVoices();
    document.getElementById('ignoreRT').checked = data.ignoreRT || true;
    document.getElementById('useVITS').checked = data.useVITS || false;

    document.getElementById('voiceName').value = data.voiceName || 'Microsoft Sayaka - Japanese (Japan)';
    document.getElementById('rate').value = data.rate || 1;
    document.getElementById('pitch').value = data.pitch || 1;
    document.getElementById('clipAPI').value = data.clipAPI || 'http://localhost:8765';
    document.getElementById('vitsAPI').value = data.vitsAPI || 'http://127.0.0.1:23456';

    document.getElementById('vitsVoice').value = data.vitsVoice || 0;
    document.getElementById('length').value = data.length || 1;
    document.getElementById('noise').value = data.noise || 0.33;
    document.getElementById('noisew').value = data.noisew || 0.4;
    document.getElementById('max').value = data.max || 50;
    document.getElementById('streaming').checked = data.streaming !== undefined ? data.streaming : false;

    document.getElementById('google').checked = data.google || true;
    document.getElementById('googleColor').value = data.googleColor || '#029AD7';
    document.getElementById('deepl').checked = data.deepl || true;
    document.getElementById('deeplColor').value = data.deeplColor || '#E04F95';

    document.getElementById('borderWidth').value = data.borderWidth || '1px';
    document.getElementById('borderStyle').value = data.borderStyle || 'solid';
    document.getElementById('borderRadius').value = data.borderRadius || '8px';
    document.getElementById('freeBorderColor').value = data.freeBorderColor || '#E04F95';
    document.getElementById('selectedBorderColor').value = data.selectedBorderColor || '#029AD7';
  });
}

// 保存设置
document.getElementById('settingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  chrome.storage.local.set({
    ignoreRT: document.getElementById('ignoreRT').checked,
    useVITS: document.getElementById('useVITS').checked,

    voiceName: document.getElementById('voiceName').value,
    rate: parseFloat(document.getElementById('rate').value),
    pitch: parseFloat(document.getElementById('pitch').value),
    clipAPI: document.getElementById('clipAPI').value,
    vitsAPI: document.getElementById('vitsAPI').value,

    vitsVoice: parseInt(document.getElementById('vitsVoice').value),
    length: parseFloat(document.getElementById('length').value),
    noise: parseFloat(document.getElementById('noise').value),
    noisew: parseFloat(document.getElementById('noisew').value),
    max: parseInt(document.getElementById('max').value),
    streaming: document.getElementById('streaming').checked,

    google: document.getElementById('google').checked,
    googleColor: document.getElementById('googleColor').value,
    deepl: document.getElementById('deepl').checked,
    deeplColor: document.getElementById('deeplColor').value,
    borderWidth: document.getElementById('borderWidth').value,
    borderStyle: document.getElementById('borderStyle').value,
    borderRadius: document.getElementById('borderRadius').value,
    freeBorderColor: document.getElementById('freeBorderColor').value,
    selectedBorderColor: document.getElementById('selectedBorderColor').value,
  });
});

loadSettings();
