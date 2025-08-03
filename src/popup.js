/* popup.js */

// 读取元数据
const version = chrome.runtime.getManifest().version;
document.getElementById('extensionVersion').textContent = `Ver ${version} `;

// 更新背景图片状态的函数
function updateBackgroundImage(isPluginOn) {
  const upperPart = document.querySelector('.upper-part');
  if (isPluginOn) {
    upperPart.classList.remove('plugin-off');
    upperPart.classList.add('plugin-on');
  } else {
    upperPart.classList.remove('plugin-on');
    upperPart.classList.add('plugin-off');
  }
}

// 页面加载时加载设置并绑定事件
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  document.getElementById('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });

  // 监听插件开关变化
  const pluginSwitch = document.getElementById('pluginSwitch');
  if (pluginSwitch) {
    pluginSwitch.addEventListener('change', (e) => {
      updateBackgroundImage(e.target.checked);
    });
  }

  // 使用通用函数来绑定各个滑竿
  bindSlider('rate', 'rateValue');
  bindSlider('pitch', 'pitchValue');
  bindSlider('length', 'lengthValue');
  fetchLatestVersion();
});

// 查看版本更新
function fetchLatestVersion() {
  const timeout = setTimeout(() => {
    document.getElementById('newVersion').innerHTML = '<a href="https://github.com/raindrop213/AnonTranslator/releases/latest" target="_blank">Update:×</a>';
  }, 3000);

  fetch('https://api.github.com/repos/raindrop213/AnonTranslator/releases/latest')
    .then(response => response.json())
    .then(data => {
      clearTimeout(timeout);
      if (data && data.tag_name) {
        const latestVersion = data.tag_name.replace(/^v/, '');
        if (latestVersion !== version) {
          document.getElementById('newVersion').innerHTML = `<a href="https://github.com/raindrop213/AnonTranslator/releases/latest" target="_blank">Update:${latestVersion}&#x21BB;</a>`;
        } else {
          document.getElementById('newVersion').innerHTML = '<a href="https://github.com/raindrop213/AnonTranslator/releases/latest" target="_blank">Latest:√</a>';
        }
      }
    })
    .catch(error => {
      clearTimeout(timeout);
      console.log('Error fetching latest version:', error);
      document.getElementById('newVersion').innerHTML = '<a href="https://github.com/raindrop213/AnonTranslator/releases/latest" target="_blank">Update:×</a>';
    });
}

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
    
    // 根据插件开关状态更新背景图片
    updateBackgroundImage(settings.pluginSwitch || false);
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
    // Provide feedback to the user that settings have been saved
    const saveButton = document.querySelector('.save');
    saveButton.classList.add('saved');
    saveButton.textContent = '√';
    setTimeout(() => {
      saveButton.classList.remove('saved');
      saveButton.textContent = 'save';
    }, 1000);
    
    // 保存后立即更新背景图片状态
    updateBackgroundImage(settings.pluginSwitch || false);
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

// 保存开关状态
function saveSwitchState(switchElement) {
  const settings = {};
  settings[switchElement.id] = switchElement.checked;
  chrome.storage.sync.set(settings);
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
