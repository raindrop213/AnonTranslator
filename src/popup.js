// 读取元数据
const version = chrome.runtime.getManifest().version;
const named = chrome.runtime.getManifest().name;
const author = chrome.runtime.getManifest().author;
document.getElementById('extension-version').textContent = `${named} ${version}`;
document.getElementById('extension-author').textContent = `By: ${author}`;

// 加载 Windows TTS 语音
function loadWindowsVoices(defaultVoiceName) {
  chrome.tts.getVoices(voices => {
    const voiceSelect = document.getElementById('voiceName');
    voiceSelect.innerHTML = ""; // 清空现有选项
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

    voiceSelect.value = voiceExists ? defaultVoiceName : voices[0]?.voiceName;
  });
}

// 加载 VITS TTS 语音
function loadVitsVoices(defaultVitsVoiceId) {
  fetch('defaultVoice.json')
    .then(response => response.json())
    .then(data => {
      const vitsVoiceSelect = document.getElementById('vitsVoice');
      vitsVoiceSelect.innerHTML = ""; // 清空现有选项
      let voiceExists = false;

      data.VITS.forEach(voice => {
        let option = document.createElement('option');
        option.text = `${voice.id}_${voice.lang.join('/')}_${voice.name}`;
        option.value = voice.id;
        vitsVoiceSelect.add(option);

        if (voice.id === defaultVitsVoiceId) {
          voiceExists = true;
        }
      });

      vitsVoiceSelect.value = voiceExists ? defaultVitsVoiceId : data.VITS[0]?.id;
    })
    .catch(error => {
      console.error('加载 VITS 语音时出错:', error);
    });
}

// 加载保存的设置
function loadSettings() {
  chrome.storage.sync.get(null, (settings) => {
    for (const key in settings) {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = settings[key];
        } else if (element.type === 'range' || element.type === 'color' || element.type === 'text') {
          element.value = settings[key];
        } else if (element.tagName === 'SELECT') {
          element.value = settings[key];
        }
      }
    }

    loadWindowsVoices(settings.voiceName); // 使用存储的语音名称作为默认值
    loadVitsVoices(settings.vitsVoice); // 使用存储的 VITS 语音 ID 作为默认值
  });
}

// 保存设置
function saveSettings() {
  const settings = {};
  const elements = document.getElementById('settingsForm').elements;

  for (const element of elements) {
    if (element.id) {
      if (element.type === 'checkbox') {
        settings[element.id] = element.checked;
      } else if (element.type === 'range' || element.type === 'color' || element.type === 'text') {
        settings[element.id] = element.value;
      } else if (element.tagName === 'SELECT') {
        settings[element.id] = element.value;
      }
    }
  }

  chrome.storage.sync.set(settings, () => {
    console.log("Settings saved.");
  });
}

// 页面加载时加载设置
document.addEventListener('DOMContentLoaded', loadSettings);

// 监听表单提交事件保存设置
document.getElementById('settingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  saveSettings();
});
