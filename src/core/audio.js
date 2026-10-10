function createSpeaker(platform) {
  let generation = 0, audio = null, objectUrl = null, settle = null;
  let playbackRate = 1;
  const setPlaybackRate = rate => {
    playbackRate = rate;
    if (audio) audio.playbackRate = rate;
  };
  const stop = () => {
    generation++;
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    settle?.(); settle = null;
    window.speechSynthesis?.cancel();
  };
  const speak = async (text, settings) => {
    const current = generation;
    if (settings.useVITS || settings.useHuoshTTS) {
      setPlaybackRate(settings.useHuoshTTS ? settings.huoshRate : 1);
      const name = settings.useHuoshTTS ? '火山语音' : 'VITS';
      const response = await platform.send({ action: settings.useHuoshTTS ? 'huosh_audio' : 'vits_audio', text, settings });
      if (current !== generation) return;
      const bytes = Uint8Array.from(atob(response.audio), character => character.charCodeAt(0));
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: response.mime }));
      audio = new Audio(objectUrl);
      audio.preservesPitch = true;
      audio.playbackRate = playbackRate;
      await new Promise((resolve, reject) => {
        settle = resolve;
        audio.onended = resolve;
        audio.onerror = () => reject(new Error(`${name} 音频播放失败`));
        audio.play().catch(error => reject(new Error(`无法播放音频: ${error.message}`)));
      });
      if (current === generation) stop();
    } else if (settings.useWindowsTTS) {
      if (!window.speechSynthesis) throw new Error('浏览器不支持系统语音');
      await new Promise((resolve, reject) => {
        settle = resolve;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = window.speechSynthesis.getVoices()[settings.winVoice] || null;
        utterance.rate = settings.rate; utterance.pitch = settings.pitch;
        utterance.onend = resolve;
        utterance.onerror = event => ['canceled', 'interrupted'].includes(event.error) ? resolve() : reject(new Error(`系统语音: ${event.error}`));
        window.speechSynthesis.speak(utterance);
      });
      if (current === generation) settle = null;
    }
  };
  return { speak, stop, setPlaybackRate };
}
App.createSpeaker = createSpeaker;
