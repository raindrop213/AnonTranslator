/* popup.js */

// 读取元数据
const version = chrome.runtime.getManifest().version;
document.getElementById('extensionVersion').textContent = `Ver ${version}`;

// 页面加载时加载设置并绑定事件
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  document.getElementById('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });

  // 使用通用函数来绑定各个滑竿
  bindSlider('rate', 'rateValue');
  bindSlider('pitch', 'pitchValue');
  bindSlider('length', 'lengthValue');
});

// 加载保存的设置
function loadSettings() {
  chrome.storage.sync.get(null, (settings) => {
    for (const key in settings) {
      const element = document.getElementById(key);
      if (element) {
        switch (element.type) {
          case 'checkbox':
            element.checked = settings[key];
            break;
          case 'range':
            element.value = settings[key];
            document.getElementById(`${key}Value`).textContent = settings[key]; // 更新显示值
            break;
          case 'color':
          case 'text':
            element.value = settings[key];
            break;
          case 'radio':
            element.checked = settings[key];
            break;
          default:
            if (element.tagName === 'SELECT') {
              element.value = settings[key];
            }
            break;
        }
      }
    }
    loadWindowsVoices(settings.winVoice); // 传递保存的 Windows 语音序号
    loadVitsVoices(settings.vitsVoice);   // 传递保存的 VITS 语音序号
  });
}

// 保存设置
function saveSettings() {
  const settings = {};
  const elements = document.getElementById('settingsForm').elements;

  Array.from(elements).forEach(element => {
    if (element.id) {
      switch (element.type) {
        case 'checkbox':
        case 'radio':
          settings[element.id] = element.checked;
          break;
        case 'range':
        case 'color':
        case 'text':
        case 'select-one':
          settings[element.id] = element.value;
          break;
      }
    }
  });

  chrome.storage.sync.set(settings, () => {
    console.log("Settings saved.");
    // 发送消息给内容脚本
    const isEnabled = settings.pluginSwitch || false;
    chrome.tabs.query({}, (tabs) => {
      for (let tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'togglePlugin', enabled: isEnabled });
      }
    });
  });
}

// 绑定滑竿和显示值
function bindSlider(sliderId, valueId) {
  const slider = document.getElementById(sliderId);
  const value = document.getElementById(valueId);
  
  slider.addEventListener('input', () => {
    value.textContent = slider.value;
  });
}

// 加载 Windows TTS 语音列表
function loadWindowsVoices(defaultVoiceIndex) {
  window.speechSynthesis.onvoiceschanged = () => {
    const voices = window.speechSynthesis.getVoices();
    const voiceSelect = document.getElementById('winVoice');
    voiceSelect.innerHTML = ""; // 清空现有选项
    voices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.text = voice.name;
      option.value = index;
      voiceSelect.add(option);
    });
    // 设置选中的语音序号
    if (defaultVoiceIndex !== undefined) {
      voiceSelect.value = defaultVoiceIndex;
    }
  };
}

// 加载 VITS TTS 语音列表
function loadVitsVoices(defaultVitsVoiceId) {
  fetch('config/defaultVoice.json')
    .then(response => response.json())
    .then(data => {
      const vitsVoiceSelect = document.getElementById('vitsVoice');
      vitsVoiceSelect.innerHTML = ""; // 清空现有选项
      data.VITS.forEach(voice => {
        const option = document.createElement('option');
        option.text = `${voice.id}_${voice.lang.join('/')}_${voice.name}`;
        option.value = voice.id;
        vitsVoiceSelect.add(option);
      });
      // 设置选中的语音序号
      if (defaultVitsVoiceId !== undefined) {
        vitsVoiceSelect.value = defaultVitsVoiceId;
      }
    })
    .catch(error => {
      console.error('加载 VITS 语音时出错:', error);
    });
}
