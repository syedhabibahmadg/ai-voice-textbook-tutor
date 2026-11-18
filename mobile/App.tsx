import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorderState, useAudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';
import { voiceActivity } from './voiceActivity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeServer, requestServer, transcribeAudio } from './server';
function Button({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}) {
 return <Pressable accessibilityRole="button" accessibilityState={{disabled}} accessibilityLabel={title} disabled={disabled} onPress={onPress} style={({pressed})=>[s.action,disabled&&s.actionDisabled,pressed&&!disabled&&s.actionPressed]}><Text style={[s.actionText,disabled&&s.actionTextDisabled]}>{title}</Text></Pressable>;
}
type Book = { id: string; title: string; status: string; chunk_count?: number };
type Chapter = { id: string; page_start: number; page_end: number };
type Citation = { id: string; title: string; page: number; source_url: string };
type Answer = { answer: string; grounded: boolean; citations: Citation[]; provider:string; model?:string; mode:string };
type Screen = 'welcome' | 'grade' | 'subject' | 'book' | 'chapter' | 'chat' | 'settings';
export default function App() {
 const [base, setBase] = useState('');
 const [serverDraft, setServerDraft] = useState('');
 const [connection, setConnection] = useState('Disconnected');
 const [aiLabel,setAiLabel]=useState('AI Server Offline');
 const [language,setLanguage]=useState('English');
 const [transcribing,setTranscribing]=useState(false);
 const [speechState,setSpeechState]=useState('Stopped');
 const [showText,setShowText]=useState(false);
 const speech=useRef({sentences:[] as string[],index:0,epoch:0,language:'en'});
 const [storageReady, setStorageReady] = useState(false);
 useEffect(() => {
  AsyncStorage.multiGet(['tutor.server.v1','tutor.language.v1']).then(values => {
   const saved=values[0][1];const preferred=values[1][1];
   if(preferred&&['English','Urdu','Roman Urdu'].includes(preferred))setLanguage(preferred);
   if (saved) { const url=normalizeServer(saved); setBase(url); setServerDraft(url); }
  }).catch(() => setError('Could not load saved server settings. Please save the address again.')).finally(()=>setStorageReady(true));
 }, []);
 const [screen, setScreen] = useState<Screen>('welcome');
 const settingsReturn=useRef<Screen>('welcome');
 const scroll=useRef<ScrollView>(null);
 useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[screen]);
 function openSettings(){settingsReturn.current=screen;setScreen('settings');}
 const [grade, setGrade] = useState<number>(); const [subject, setSubject] = useState('');
 const [book, setBook] = useState<Book>(); const [chapter, setChapter] = useState<Chapter>();
 const [items, setItems] = useState<Array<number | string | Book | Chapter>>([]);
 const [busy, setBusy] = useState(false); const [error, setError] = useState('');
 const [answers, setAnswers] = useState<Array<{question:string; result:Answer}>>([]);
 const [recording, setRecording] = useState(false);
 const [voiceActive,setVoiceActive]=useState(false);
 const [voicePhase,setVoicePhase]=useState('Ready');
 const voice=useRef({active:false,processing:false,started:0,lastSound:0,heard:false,epoch:0,monitor:false,bargeSamples:0,trimStart:0,utteranceAt:0,abort:null as AbortController|null});
 const startListeningRef=useRef<()=>Promise<void>>(async()=>{});
 const finishListeningRef=useRef<()=>Promise<void>>(async()=>{});
 const contextEpoch = useRef(0);
 useEffect(() => { contextEpoch.current++; speech.current.epoch++; Speech.stop(); setSpeechState('Stopped'); setAnswers([]); setBusy(false); }, [base, grade, subject, book?.id, chapter?.id]);
 useEffect(()=>{
  let active=true;
  if(base) requestServer(base,'/api/v1/ai/status?check=true').then(status=>{
   if(!active)return;
   setAiLabel(status.measurements?.groq?.availability==='connected'?'Groq AI Connected':status.groq_availability==='verified_models_api'?'Groq models available':status.ollama_reachable&&status.ollama_model_installed?'Local model available':'Textbook Search Mode');
  }).catch(()=>{if(active)setAiLabel('AI Server Offline');});
  return()=>{active=false;};
 },[base]);
 const recorder = useAudioRecorder({...RecordingPresets.HIGH_QUALITY,sampleRate:16000,numberOfChannels:1,bitRate:32000,isMeteringEnabled:true,android:{...RecordingPresets.HIGH_QUALITY.android,audioSource:'voice_communication'}});
 const recorderState=useAudioRecorderState(recorder,150);
 function endConversation(){
  voice.current.active=false;voice.current.monitor=false;voice.current.abort?.abort();voice.current.epoch++;setVoiceActive(false);setVoicePhase('Ready');
  speech.current.epoch++;Speech.stop();setSpeechState('Stopped');
  if(recorder.isRecording)recorder.stop().catch(()=>{});
  setRecording(false);
 }
 useEffect(()=>{if(screen!=='chat')endConversation();},[screen,base,book?.id,chapter?.id]);
 useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{if(state!=='active')endConversation();});return()=>{subscription.remove();voice.current.active=false;voice.current.epoch++;Speech.stop();if(recorder.isRecording)recorder.stop().catch(()=>{});};},[recorder.id]);
 useEffect(()=>{
  if(!recording||!voice.current.active||voice.current.processing)return;
  const action=voiceActivity(voice.current,recorderState.metering,Date.now());
  if(action==='interrupt'){
   speech.current.epoch++;Speech.stop();setSpeechState('Stopped');setVoicePhase('Listening');
  }else if(action==='submit'){finishListeningRef.current();}
  else if(action==='timeout'){endConversation();setError('No speech detected. Tap the microphone and speak closer to your phone.');}

 },[recorderState,recording]);
 async function api(path:string, body?:unknown, signal?:AbortSignal) {
  try {const result=await requestServer(base,path,body,signal);setConnection('Connected');return result;}
  catch(error){setConnection('Disconnected');throw error;}
 }
 async function connectServer() {
  setBusy(true);setError('');setConnection('Connecting…');
  try {
   const url=normalizeServer(serverDraft);
   const result=await requestServer(url,'/health');
   if(result.status!=='ok')throw new Error('This server did not return the expected health response.');
   await AsyncStorage.setItem('tutor.server.v1',url);
   setBase(url);setServerDraft(url);setConnection('Connected');setAnswers([]);
  }catch(error){setConnection('Disconnected');setError((error as Error).message);}finally{setBusy(false);}
 }
 useEffect(() => {
  let active = true;
  const paths:Partial<Record<Screen,string>> = {grade:'/api/v1/grades',subject:`/api/v1/subjects?grade=${grade}`,book:`/api/v1/textbooks?grade=${grade}&subject=${encodeURIComponent(subject)}`,chapter:`/api/v1/chapters?textbook=${book?.id}`};
  if (paths[screen]) {setBusy(true);setError('');setItems([]); api(paths[screen]!).then(x=>{if(!Array.isArray(x))throw new Error('Unexpected catalog response. Check the server URL and logs.');if(active)setItems(x);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});}
  return ()=>{active=false;};
 }, [screen,base,grade,subject,book?.id]);
 async function startListening(mode: 'Listening'|'Speaking'='Listening'){
  if(!voice.current.active||voice.current.processing)return;
  const epoch=voice.current.epoch;
  try{
   if(!voice.current.active||epoch!==voice.current.epoch)return;
   await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true,interruptionMode:'mixWithOthers'});
   await recorder.prepareToRecordAsync();
   if(!voice.current.active||epoch!==voice.current.epoch)return;
   recorder.record();voice.current.started=Date.now();voice.current.utteranceAt=Date.now();voice.current.lastSound=Date.now();voice.current.heard=false;voice.current.trimStart=0;voice.current.bargeSamples=0;voice.current.monitor=mode==='Speaking';
   setRecording(true);setVoicePhase(mode);
  }catch(e){endConversation();setError((e as Error).message);}
 }
 startListeningRef.current=startListening;
 async function finishListening(){
  if(voice.current.processing||!voice.current.active||!book)return;
  voice.current.processing=true;voice.current.abort=new AbortController();const signal=voice.current.abort.signal;const epoch=voice.current.epoch;const context=contextEpoch.current;
  const valid=()=>voice.current.active&&epoch===voice.current.epoch&&context===contextEpoch.current;
  try{
   await recorder.stop();setRecording(false);await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true});
   if(!valid())return;
   if(!recorder.uri)throw new Error('Recording was unavailable. Please try again.');
   setVoicePhase('Understanding');setTranscribing(true);
   const question=(await transcribeAudio(base,recorder.uri,language==='Urdu'?'ur':language==='English'?'en':'auto',voice.current.trimStart,signal)).trim();
   setTranscribing(false);if(!valid())return;
   if(!question)throw new Error('I could not hear a question. Please try again.');
   setVoicePhase('Thinking');setBusy(true);
   const result:Answer=await api('/api/v1/chat',{grade,subject,textbook:book.id,chapter:chapter?.id??null,query:question,language,history:answers.slice(-4).map(a=>a.question)},signal);
   if(!valid())return;
   if(typeof result.answer!=='string'||!Array.isArray(result.citations))throw new Error('Unexpected tutor response.');
   setAnswers(x=>[...x,{question,result}]);setVoicePhase('Speaking');setAiLabel(result.provider==='groq'?'Groq AI Connected':result.provider==='ollama'?'Local Model Connected':'Textbook Search Mode');voice.current.processing=false;
   await speakAnswer(result.answer);
  }catch(e){if(valid()){endConversation();setError((e as Error).message);}}
  finally{voice.current.processing=false;setTranscribing(false);setBusy(false);}
 }
 finishListeningRef.current=finishListening;
 async function toggleConversation(){
  if(voice.current.active){endConversation();return;}
  if(voice.current.processing)return;
  setError('');
  const permission=await AudioModule.requestRecordingPermissionsAsync();
  if(!permission.granted){setError('Allow microphone access to talk to your tutor.');return;}
  voice.current.active=true;voice.current.epoch++;setVoiceActive(true);await startListening();
 }
 async function speakNext(epoch:number){
  if(epoch!==speech.current.epoch)return;
  const sentence=speech.current.sentences[speech.current.index];
  if(!sentence){
   setSpeechState('Stopped');
   if(voice.current.active){
    try{if(recorder.isRecording)await recorder.stop();setRecording(false);voice.current.monitor=false;if(epoch===speech.current.epoch&&voice.current.active)await startListeningRef.current();}
    catch{if(epoch===speech.current.epoch){endConversation();setError('Could not restart listening. Tap to talk again.');}}
   }
   return;
  }
  setSpeechState('Playing');
  Speech.speak(sentence,{language:speech.current.language,onDone:()=>{if(epoch===speech.current.epoch){speech.current.index++;speakNext(epoch);}},onError:()=>{if(epoch===speech.current.epoch){endConversation();setError('Speech playback failed. Check your device voice settings.');}}});
 }
 async function speakAnswer(text:string){
  const conversationEpoch=voice.current.epoch;
  await Speech.stop();speech.current.epoch++;
  const voices=await Speech.getAvailableVoicesAsync();const code=language==='Urdu'?'ur':'en';
  if(!voices.some(v=>v.language.toLowerCase().startsWith(code))){endConversation();setError(`Install an ${code==='ur'?'Urdu':'English'} device voice to hear replies.`);return;}
  if(!voice.current.active||conversationEpoch!==voice.current.epoch)return;
  await startListening('Speaking');
  if(!voice.current.active||conversationEpoch!==voice.current.epoch)return;
  speech.current.sentences=text.match(/[^.!?۔]+[.!?۔]*/g)||[text];speech.current.index=0;speech.current.language=code;speakNext(speech.current.epoch);
 }
 async function interruptReply(){
  if(!voice.current.active||voice.current.processing)return;
  speech.current.epoch++;await Speech.stop();setSpeechState('Stopped');
  try{if(recorder.isRecording)await recorder.stop();setRecording(false);voice.current.monitor=false;await startListening();}
  catch{endConversation();setError('Tap to talk again.');}
 }
 const previous:Record<Screen,Screen>={welcome:'welcome',grade:'welcome',subject:'grade',book:'subject',chapter:'book',chat:'chapter',settings:settingsReturn.current};
 return <SafeAreaView style={s.root}><ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <View style={s.top}><Text style={s.brand}>TEXTBOOK / TUTOR</Text><Button title="Settings" onPress={openSettings}/></View>
  <Text accessibilityLiveRegion="polite" style={s.muted}>{aiLabel}</Text>
  <Text style={s.heading}>{screen==='welcome'?'Understand your textbook. One question at a time.':screen==='chat'?'Let’s learn together':screen==='chapter'?'Your study space':screen==='grade'?'Choose your class':screen==='subject'?'Explore subjects':screen==='book'?'Your textbooks':'Settings'}</Text>
  {!!grade && screen!=='welcome' && <Text style={s.muted}>Class {grade} · {subject} {chapter?`· Chapter ${chapter.id}`:book?'· Whole book':''}</Text>}
  {screen==='welcome' && <><Text style={s.body}>Ask questions from available textbooks and verify the original PDF page. Choose your chapter, tap once, and talk with your tutor.</Text><Text style={s.muted}>{base || 'First, connect to your laptop server in Settings.'}</Text><Button title={base?'Start learning':'Connect to server'} disabled={!storageReady} onPress={()=>setScreen(base?'grade':'settings')}/></>}
  {screen==='settings' && <><View style={s.card}><Text style={s.question}>Tutor language</Text><Text style={s.muted}>Choose how your tutor replies. Saved on this phone.</Text>{['English','Urdu','Roman Urdu'].map(l=><Pressable key={l} accessibilityRole="radio" accessibilityState={{checked:language===l}} accessibilityLabel={l} style={[s.languageOption,language===l&&s.languageSelected]} onPress={async()=>{setLanguage(l);try{await AsyncStorage.setItem('tutor.language.v1',l);}catch{setError('Could not save language preference.');}}}><Text style={s.body}>{l}</Text><Text style={s.question}>{language===l?'✓':'○'}</Text></Pressable>)}</View><Text style={s.body}>Server Connection Settings</Text><Text style={s.muted}>Start start_server.bat on your laptop, then enter its displayed URL. Use the same trusted Wi-Fi.</Text><TextInput accessibilityLabel="Server URL" placeholder="http://192.168.1.5:8000" style={s.input} value={serverDraft} onChangeText={setServerDraft} autoCapitalize="none" autoCorrect={false} keyboardType="url"/><Text accessibilityLiveRegion="polite" style={s.muted}>{connection}</Text><Button title="Test connection and save" disabled={busy} onPress={connectServer}/><Button title="Reconnect saved server" disabled={busy||!base} onPress={async()=>{setBusy(true);setError('');try{const health=await api('/health');if(health.status!=='ok')throw new Error('Unexpected health response');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}/><Text style={s.muted}>The address is stored only on this device. Transcription sends recorded audio through your laptop to Groq. Device speech output requires an installed compatible voice.</Text></>}
  {busy && <ActivityIndicator accessibilityLabel="Loading"/>}
  {!!error && <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button title="Server settings" onPress={()=>{setError('');setScreen('settings');}}/></View>}
  {screen==='chapter'&&<View style={s.studyCard}><Text style={s.voiceEyebrow}>THE WHOLE TEXTBOOK</Text><Text style={s.voiceTitle}>A question can come from anywhere.</Text><Text style={s.voiceHint}>Talk about any topic in {subject}. Your tutor searches this book and shows the source page.</Text><Button title="Talk about the whole book" disabled={!book?.chunk_count} onPress={()=>{setChapter(undefined);setAnswers([]);setScreen('chat');}}/></View>}
  {screen==='chapter'&&<Text style={s.question}>Or focus on a chapter</Text>}
  {['grade','subject','book','chapter'].includes(screen) && <>{items.map(item=>{
   const label=typeof item==='object'?('title' in item?`${item.title.replace(/\.pdf$/i,'')} · ${item.chunk_count ? 'Ready to talk' : 'Preparing textbook'}`:`Chapter ${item.id} · PDF pp. ${item.page_start}–${item.page_end}`):String(item);
   return <View style={s.card} key={typeof item==='object'?item.id:item}><Button title={label} disabled={typeof item==='object'&&'title' in item&&!item.chunk_count} onPress={()=>{
    setError('');if(screen==='grade'){setGrade(item as number);setSubject('');setBook(undefined);setChapter(undefined);setScreen('subject');}
    if(screen==='subject'){setSubject(item as string);setBook(undefined);setChapter(undefined);setScreen('book');}
    if(screen==='book'){setBook(item as Book);setChapter(undefined);setScreen('chapter');}
    if(screen==='chapter'){setChapter(item as Chapter);setAnswers([]);setScreen('chat');}
   }}/></View>;
  })}{!busy&&!error&&!items.length&&<Text style={s.body}>No indexed content yet. Ask the maintainer to run ingestion.</Text>}</>}
  {screen==='chat'&&<>

   <View style={s.voicePanel}>
    <Text style={s.voiceEyebrow}>YOUR VOICE CLASSROOM</Text>
    <Text accessibilityLiveRegion="polite" style={s.voiceTitle}>{voicePhase==='Ready'?'Ask anything from your book':voicePhase==='Listening'?'I’m listening…':voicePhase==='Understanding'?'Understanding your question…':voicePhase==='Thinking'?'Finding your textbook answer…':'Speaking · you can interrupt'}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={voiceActive?'End voice conversation':'Start voice conversation'} onPress={toggleConversation} style={[s.mic,voiceActive&&s.micActive]}><Text style={s.micIcon}>{voiceActive?'■':'●'}</Text><Text style={s.micText}>{voiceActive?'End conversation':'Tap to talk'}</Text></Pressable>
    <Text style={s.voiceHint}>{voiceActive?'Pause briefly for your answer. Speak again to interrupt a reply.':'One tap starts your conversation. Ask naturally and hear your answer.'}</Text>
    <View style={s.wave}>{[14,26,38,20,46,30,18].map((height,i)=><View key={i} style={[s.waveBar,{height:voiceActive?height:8}]}/>)}</View>
   </View>
   <View style={s.responseActions}><Pressable accessibilityRole="button" accessibilityLabel={showText?'Hide response text':'Show response text'} onPress={()=>setShowText(x=>!x)} style={s.textToggle}><Text style={s.actionText}>{showText?'Hide text':'Text response'}</Text></Pressable>{voicePhase==='Speaking'&&<Pressable accessibilityRole="button" onPress={interruptReply} style={s.textToggle}><Text style={s.actionText}>Interrupt reply</Text></Pressable>}</View>
   {showText&&<View style={s.card}><Text style={s.question}>Conversation</Text>{answers.length?answers.slice(-3).map((a,i)=><View key={i} style={{gap:8}}><Text style={s.question}>{a.question}</Text><Text selectable style={s.body}>{a.result.answer}</Text></View>):<Text style={s.muted}>Your question and the tutor’s answer will appear here.</Text>}</View>}
   <Text style={s.muted}>Audio is sent through your laptop to Groq. Tap End conversation to stop the microphone.</Text>
   {answers.length>0&&<View style={s.card}><Text style={s.question}>Last answer · textbook sources</Text>{answers[answers.length-1].result.citations.map(c=><View key={c.id}><Text style={s.muted}>{c.title} · PDF page {c.page}</Text><Button title="Open source page" onPress={()=>Linking.openURL(c.source_url).catch(()=>setError('Cannot open source'))}/></View>)}</View>}

  </>}
  {screen!=='welcome'&&<Button title="Back" onPress={()=>{setError('');setScreen(previous[screen]);}}/>}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({responseActions:{flexDirection:'row',gap:12},textToggle:{flex:1,backgroundColor:'white',borderRadius:16,padding:16,borderWidth:1,borderColor:'#cee1e9'},action:{backgroundColor:'#e4f0f5',borderRadius:16,paddingVertical:15,paddingHorizontal:18,minHeight:50,justifyContent:'center',borderWidth:1,borderColor:'#cee1e9'},actionText:{color:'#153d58',fontSize:16,fontWeight:'700',textAlign:'center'},actionDisabled:{backgroundColor:'#edf0f2',borderColor:'#e3e7ea'},actionTextDisabled:{color:'#88949e'},actionPressed:{opacity:0.7},languageOption:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:16,borderRadius:14,borderWidth:1,borderColor:'#dde7ee'},languageSelected:{backgroundColor:'#e5f7f0',borderColor:'#48ad8e'},studyCard:{backgroundColor:'#102d50',borderRadius:24,padding:24,gap:18},voicePanel:{backgroundColor:'#102d50',borderRadius:28,padding:28,alignItems:'center',gap:24},voiceEyebrow:{color:'#82d9ce',fontSize:11,fontWeight:'800',letterSpacing:2},voiceTitle:{color:'white',fontSize:25,lineHeight:34,fontWeight:'700',textAlign:'center'},mic:{width:172,height:172,borderRadius:86,backgroundColor:'#64e0c1',alignItems:'center',justifyContent:'center',gap:8,borderWidth:8,borderColor:'#244e68'},micActive:{backgroundColor:'#ffbda7'},micIcon:{fontSize:40,color:'#102d50'},micText:{fontSize:14,fontWeight:'800',color:'#102d50'},voiceHint:{color:'#c4d5e8',textAlign:'center',fontSize:15,lineHeight:23},wave:{flexDirection:'row',alignItems:'center',gap:6,height:48},waveBar:{width:5,borderRadius:4,backgroundColor:'#64e0c1'},root:{flex:1,backgroundColor:'#eef3fa'},content:{padding:24,gap:18,paddingBottom:60},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{fontSize:12,fontWeight:'800',color:'#166659'},heading:{fontSize:32,lineHeight:39,fontWeight:'700',color:'#163b35'},body:{fontSize:16,lineHeight:25,color:'#253f3b'},muted:{color:'#536d67',fontSize:14,lineHeight:22},card:{backgroundColor:'white',borderRadius:18,padding:18,gap:12},input:{backgroundColor:'white',borderWidth:1,borderColor:'#87aaa0',borderRadius:12,padding:16,fontSize:17,minHeight:58},question:{fontSize:18,fontWeight:'700',color:'#166659'},error:{color:'#a72c2c'}});
