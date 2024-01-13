// options.js

// 加载 Windows TTS 语音
function loadWindowsVoices(defaultVoiceName) {
  chrome.tts.getVoices(voices => {
    const voiceSelect = document.getElementById('voiceName');
    let voiceExists = false;

    voices.forEach(voice => {
      let option = document.createElement('option');
      option.text = voice.voiceName;
      option.value = voice.voiceName;
      voiceSelect.add(option);

      if (voice.voiceName === defaultVoiceName) {
        voiceExists = true;
      }
    });

    // 如果默认语音存在，则设置为选中状态，否则选择列表中的第一个语音
    voiceSelect.value = voiceExists ? defaultVoiceName : voices[6]?.voiceName;
  });
}

// 加载 VITS TTS 语音
function loadVitsVoices(defaultVitsVoiceId, model) {
  fetch('defaultVoice.json')
    .then(response => response.json())
    .then(data => {
      const vitsVoiceSelect = document.getElementById('vitsVoice');
      let voiceExists = false;

      // 清空当前选项
      while (vitsVoiceSelect.options.length > 0) {
        vitsVoiceSelect.remove(0);
      }

      // 加载指定模型的语音选项
      data[model].forEach(voice => {
        let option = document.createElement('option');
        option.text = `${voice.id}_${voice.lang.join('/')}_${voice.name}`;
        option.value = voice.id;
        vitsVoiceSelect.add(option);

        if (voice.id === defaultVitsVoiceId) {
          voiceExists = true;
        }
      });

      // 设置默认选项
      if (model == 'VITS') {
        vitsVoiceSelect.value = voiceExists ? defaultVitsVoiceId : data[model][342]?.id; // 342
      } else {
        vitsVoiceSelect.value = voiceExists ? defaultVitsVoiceId : data[model][0]?.id; // 342
      }
      
    })
    .catch(error => {
      console.error('加载 VITS 语音时出错:', error);
    });
}



// 加载保存的设置
function loadSettings() {
  chrome.storage.local.get([
    'ignoreFurigana', 'useVITS', 
    'voiceName', 'rate', 'pitch', 'clipAPI', 'vitsAPI', 
    'model', 'vitsVoice', 'vitsLang', 'length', 'noise', 'noisew', 'max', 'streaming', 
    'from', 'to', 'google', 'googleColor', 'deepl', 'deeplColor', 
    'borderWidth', 'borderStyle', 'borderRadius', 
    'freeBorderColor', 'selectedBorderColor', 
  ], (data) => {
    document.getElementById('ignoreFurigana').checked = data.ignoreFurigana !== undefined ? data.ignoreFurigana : true;
    document.getElementById('useVITS').checked = data.useVITS !== undefined ? data.useVITS : false;

    loadWindowsVoices(data.voiceName); // 使用存储的语音名称作为默认值
    document.getElementById('rate').value = data.rate || 1;
    document.getElementById('pitch').value = data.pitch || 1;
    document.getElementById('clipAPI').value = data.clipAPI || 'http://localhost:8666';
    document.getElementById('vitsAPI').value = data.vitsAPI || 'http://127.0.0.1:23456';

    document.getElementById('modelSelect').value = data.model || 'VITS';
    loadVitsVoices(data.vitsVoice, data.model || 'VITS');
    document.getElementById('vitsLang').value = data.vitsLang || 'ja';
    document.getElementById('length').value = data.length || 1;
    document.getElementById('noise').value = data.noise || 0.33;
    document.getElementById('noisew').value = data.noisew || 0.4;
    document.getElementById('max').value = data.max || 50;
    document.getElementById('streaming').checked = data.streaming !== undefined ? data.streaming : false;

    document.getElementById('from').value = data.from || 'ja';
    document.getElementById('to').value = data.to || 'zh';
    document.getElementById('google').checked = data.google !== undefined ? data.google : false;
    document.getElementById('googleColor').value = data.googleColor || '#D4B102';
    document.getElementById('deepl').checked = data.deepl !== undefined ? data.deepl : true;
    document.getElementById('deeplColor').value = data.deeplColor || '#9C512E';

    document.getElementById('borderWidth').value = data.borderWidth || '2px';
    document.getElementById('borderStyle').value = data.borderStyle || 'solid';
    document.getElementById('borderRadius').value = data.borderRadius || '8px';
    document.getElementById('freeBorderColor').value = data.freeBorderColor || '#225D2E';
    document.getElementById('selectedBorderColor').value = data.selectedBorderColor || '#94B505';
  });
}

// 保存设置
document.getElementById('settingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  chrome.storage.local.set({
    model: document.getElementById('modelSelect').value,
    ignoreFurigana: document.getElementById('ignoreFurigana').checked,
    useVITS: document.getElementById('useVITS').checked,

    voiceName: document.getElementById('voiceName').value,
    rate: parseFloat(document.getElementById('rate').value),
    pitch: parseFloat(document.getElementById('pitch').value),
    clipAPI: document.getElementById('clipAPI').value,
    vitsAPI: document.getElementById('vitsAPI').value,

    vitsVoice: parseInt(document.getElementById('vitsVoice').value),
    vitsLang: document.getElementById('vitsLang').value,
    length: parseFloat(document.getElementById('length').value),
    noise: parseFloat(document.getElementById('noise').value),
    noisew: parseFloat(document.getElementById('noisew').value),
    max: parseInt(document.getElementById('max').value),
    streaming: document.getElementById('streaming').checked,

    from: document.getElementById('from').value,
    to: document.getElementById('to').value,
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


document.getElementById('modelSelect').addEventListener('change', (e) => {
  const selectedModel = e.target.value;
  loadVitsVoices(null, selectedModel); // 加载新模型的语音选项
});

loadSettings();
