import { createReader } from '../src/reader/reader.js';
import { createSettingsStore } from '../src/settings/settings.js';
import { mountSettings } from '../src/settings/panel.js';
import { cleanParagraph } from '../src/reader/text.js';
import readerCss from '../src/reader/reader.css';
import panelCss from '../src/settings/panel.css';

const style=document.createElement('style');style.textContent=readerCss;document.head.append(style);
const settingsRoot=document.querySelector('#settings').attachShadow({mode:'open'});
const settingsStyle=document.createElement('style');settingsStyle.textContent=panelCss;settingsRoot.append(settingsStyle);
const settingsBox=document.createElement('div');settingsRoot.append(settingsBox);
const watchers=[];
// Custom targets avoid a separately installed extension acting on the fixture.
let saved={pluginSwitch:true,dictionaryEnabled:true,ankiEnabled:true,ankiSuccessSound:false,ankiDecks:'日语::单词\n日语::句子',ankiTags:'生词\n小说',copy:false,scrollSwitch:false,targetTags:'at-test-paragraph',sentenceColor:'#e2e8d5',...JSON.parse(localStorage.getItem('at-fixture-settings')||'{}')};
const platform={
  updateURL:'https://github.com/raindrop213/AnonTranslator',
  ankiPreviewURL:location.hash.includes('renderer')?location.origin+'/anki-preview.html':undefined,
  getSettings:async()=>saved,setSettings:async patch=>{saved={...saved,...patch};localStorage.setItem('at-fixture-settings',JSON.stringify(saved));watchers.forEach(w=>w(patch));},watchSettings:w=>watchers.push(w),
  copy:async()=>{},send:async message=>{
    if(message.action==='cancel_translation')return {};
    if(message.action==='check_update')return {available:false,version:'fixture'};
    if(message.action==='vits_speakers')return {voices:[]};
    const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(message)});
    const data=await response.json();if(data.error)throw new Error(data.error);return data;
  },
  readClipboardImage:async()=> (await fetch('/test-image.png')).blob()
};
const store=createSettingsStore(platform);await store.init();createReader(platform,store);mountSettings(settingsBox,store,platform);
for(const [id,key] of [['dictionary-toggle','dictionaryEnabled'],['furigana-toggle','dictionaryFurigana'],['night-toggle','nightMode']])document.getElementById(id).addEventListener('change',e=>store.set(key,e.target.checked));
const ruby=document.querySelector('#original-ruby'),rt=document.querySelector('#original-rt'),em=document.querySelector('#original-em');
document.querySelector('#verify-source').addEventListener('click',()=>{
  const checks=[ruby===document.querySelector('#original-ruby'),rt===document.querySelector('#original-rt'),em===document.querySelector('#original-em'),cleanParagraph(document.querySelector('#paragraph-one'),store.values).text==='彼はタオルを濡らした。滑らしる。食べました。',cleanParagraph(document.querySelector('#paragraph-ruby'),store.values).text==='図書館で日本語の小説を読みました。\n😀 今日は静かです。'];
  document.querySelector('#verification').textContent=checks.every(Boolean)?'正文、ruby 与元素身份均正确':'恢复失败：'+checks;
});
document.querySelector('#verify-anki').addEventListener('click',async()=>{
  const data=await (await fetch('/anki-state')).json();
  document.querySelector('#anki-verification').textContent=JSON.stringify({media:data.media,notes:data.notes.map(note=>({id:note.noteId,deck:note.deck,tags:note.tags,fields:Object.fromEntries(Object.entries(note.fields).filter(([name])=>name!=='DictionaryData').map(([name,field])=>[name,field.value])),dictionaryBytes:note.fields.DictionaryData?.value.length}))});
});
