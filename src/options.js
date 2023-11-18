// 加载可用的语音选项
function loadVoices() {
    chrome.tts.getVoices(voices => {
      const voiceSelect = document.getElementById('voiceName');
      voices.forEach(voice => {
        let option = document.createElement('option');
        option.text = voice.voiceName;
        option.value = voice.voiceName;
        voiceSelect.add(option);
      });
    });
  }
  
  // 加载保存的设置
  function loadSettings() {
    chrome.storage.local.get(['ignoreRT', 'voiceName', 'rate', 'pitch'], (data) => {
      document.getElementById('ignoreRT').checked = data.ignoreRT || true;
      document.getElementById('voiceName').value = data.voiceName || 'Microsoft Sayaka - Japanese (Japan)';
      document.getElementById('rate').value = data.rate || 1;
      document.getElementById('pitch').value = data.pitch || 1;
    });
  }
  
  // 保存设置
  document.getElementById('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    chrome.storage.local.set({
      ignoreRT: document.getElementById('ignoreRT').checked,
      voiceName: document.getElementById('voiceName').value,
      rate: parseFloat(document.getElementById('rate').value),
      pitch: parseFloat(document.getElementById('pitch').value)
    });
  });
  
  loadVoices();
  loadSettings();
  