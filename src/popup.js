//popup.js

// 读取元数据
const version = chrome.runtime.getManifest().version;
const named = chrome.runtime.getManifest().name;
const author = chrome.runtime.getManifest().author;
document.getElementById('extension-version').textContent = `Ver ${version}`;
document.getElementById('extension-author').textContent = `By: ${author}`;

// 加载 Windows TTS 语音列表
function loadWindowsVoices(defaultVoiceIndex) {
  window.speechSynthesis.onvoiceschanged = () => {
    const voices = window.speechSynthesis.getVoices();
    const voiceSelect = document.getElementById('winVoice');
    voiceSelect.innerHTML = ""; // 清空现有选项
    voices.forEach((voice, index) => {
      let option = document.createElement('option');
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
  fetch('defaultVoice.json')
    .then(response => response.json())
    .then(data => {
      const vitsVoiceSelect = document.getElementById('vitsVoice');
      vitsVoiceSelect.innerHTML = ""; // 清空现有选项
      data.VITS.forEach(voice => {
        let option = document.createElement('option');
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

    loadWindowsVoices(settings.winVoice); // 传递保存的 Windows 语音序号
    loadVitsVoices(settings.vitsVoice);   // 传递保存的 VITS 语音序号
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
      } else if (element.type === 'radio') {
        settings[element.id] = element.checked;
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

document.addEventListener('DOMContentLoaded', function () {
  // 通用函数来绑定滑竿和显示值的事件监听器
  function bindSlider(sliderId, valueId) {
    const slider = document.getElementById(sliderId);
    const value = document.getElementById(valueId);
    
    slider.addEventListener('input', function () {
      value.textContent = slider.value;
    });
  }

  // 使用通用函数来绑定各个滑竿
  bindSlider('rate', 'rateValue');
  bindSlider('pitch', 'pitchValue');
  bindSlider('length', 'lengthValue');
});
