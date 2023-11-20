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

// 加载保存的设置
function loadSettings() {
  chrome.storage.local.get(['ignoreRT','useVITS', 'voiceName', 'rate', 'pitch', 'clipAPI', 'vitsAPI', 'vitsVoice', 'length', 'noise', 'noisew', 'max', 'streaming'], (data) => {
    loadWindowsVoices(); // 加载 Windows TTS 语音选项
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
    streaming: document.getElementById('streaming').checked
  });
});

loadSettings();
