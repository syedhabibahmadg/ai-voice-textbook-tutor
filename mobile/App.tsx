import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeServer, requestServer, transcribeAudio } from './server';
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
 const speech=useRef({sentences:[] as string[],index:0,epoch:0,language:'en'});
 const [storageReady, setStorageReady] = useState(false);
 useEffect(() => {
  AsyncStorage.getItem('tutor.server.v1').then(saved => {
   if (saved) { const url=normalizeServer(saved); setBase(url); setServerDraft(url); }
  }).catch(() => setError('Could not load saved server settings. Please save the address again.')).finally(()=>setStorageReady(true));
 }, []);
 const [screen, setScreen] = useState<Screen>('welcome');
 const [grade, setGrade] = useState<number>(); const [subject, setSubject] = useState('');
 const [book, setBook] = useState<Book>(); const [chapter, setChapter] = useState<Chapter>();
 const [items, setItems] = useState<Array<number | string | Book | Chapter>>([]);
 const [busy, setBusy] = useState(false); const [error, setError] = useState('');
 const [query, setQuery] = useState(''); const [answers, setAnswers] = useState<Array<{question:string; result:Answer}>>([]);
 const [recording, setRecording] = useState(false);
 const contextEpoch = useRef(0);
 useEffect(() => { contextEpoch.current++; speech.current.epoch++; Speech.stop(); setSpeechState('Stopped'); setAnswers([]); setQuery(''); setBusy(false); }, [base, grade, subject, book?.id, chapter?.id]);
 useEffect(()=>{
  let active=true;
  if(base) requestServer(base,'/api/v1/ai/status?check=true').then(status=>{
   if(!active)return;
   setAiLabel(status.measurements?.groq?.availability==='connected'?'Groq AI Connected':status.groq_availability==='verified_models_api'?'Groq models available':status.ollama_reachable&&status.ollama_model_installed?'Local model available':'Textbook Search Mode');
  }).catch(()=>{if(active)setAiLabel('AI Server Offline');});
  return()=>{active=false;};
 },[base]);
 const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY); const player = useAudioPlayer(null);
 async function api(path:string, body?:unknown) {
  try {const result=await requestServer(base,path,body);setConnection('Connected');return result;}
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
 async function ask() {
  if (!query.trim() || busy || !book || !chapter) return; setBusy(true);setError(''); const question=query.trim(); const epoch=contextEpoch.current;
  try {const result:Answer=await api('/api/v1/chat',{grade,subject,textbook:book.id,chapter:chapter.id,query:question,language,history:answers.slice(-4).map(a=>a.question)});if(typeof result.answer!=='string'||!Array.isArray(result.citations))throw new Error('Unexpected answer response. Please check the server logs.');if(epoch===contextEpoch.current){setAnswers(x=>[...x,{question,result}]);setQuery('');setAiLabel(result.provider==='groq'?'Groq AI Connected':result.provider==='ollama'?'Local Model Connected':'Textbook Search Mode');}}
  catch(e){if(epoch===contextEpoch.current)setError((e as Error).message);} finally {if(epoch===contextEpoch.current)setBusy(false);}
 }
 async function record() {
  try {if(recording){await recorder.stop();setRecording(false);await setAudioModeAsync({allowsRecording:false});if(recorder.uri){player.replace(recorder.uri);setTranscribing(true);const epoch=contextEpoch.current;try{const text=await transcribeAudio(base,recorder.uri,language==='Urdu'?'ur':'auto');if(epoch===contextEpoch.current)setQuery(text);}finally{setTranscribing(false);}}}
   else {const permission=await AudioModule.requestRecordingPermissionsAsync();if(!permission.granted)throw new Error('Microphone denied. Please use text input.');await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});await recorder.prepareToRecordAsync();recorder.record();setRecording(true);}}
  catch(e){setRecording(false);setError((e as Error).message);}
 }
 function speakNext(epoch:number){
  if(epoch!==speech.current.epoch)return;
  const sentence=speech.current.sentences[speech.current.index];
  if(!sentence){setSpeechState('Stopped');return;}
  setSpeechState('Playing');
  Speech.speak(sentence,{language:speech.current.language,onDone:()=>{if(epoch===speech.current.epoch){speech.current.index++;speakNext(epoch);}},onError:()=>{setSpeechState('Stopped');setError('Speech playback failed. The text answer remains available.');}});
 }
 async function speakAnswer(text:string){
  await Speech.stop();speech.current.epoch++;
  const voices=await Speech.getAvailableVoicesAsync();const code=language==='Urdu'?'ur':'en';
  if(!voices.some(v=>v.language.toLowerCase().startsWith(code))){setError(`No ${code==='ur'?'Urdu':'English'} device voice is installed. Read the text or install a compatible voice.`);return;}
  speech.current.sentences=text.match(/[^.!?۔]+[.!?۔]*/g)||[text];speech.current.index=0;speech.current.language=code;speakNext(speech.current.epoch);
 }
 function pauseSpeech(){speech.current.epoch++;Speech.stop();setSpeechState('Paused');}
 function stopSpeech(){speech.current.epoch++;Speech.stop();speech.current.index=0;setSpeechState('Stopped');}
 const previous:Record<Screen,Screen>={welcome:'welcome',grade:'welcome',subject:'grade',book:'subject',chapter:'book',chat:'chapter',settings:'welcome'};
 return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <View style={s.top}><Text style={s.brand}>TEXTBOOK / TUTOR</Text><Button title="Settings" onPress={()=>setScreen('settings')}/></View>
  <Text accessibilityLiveRegion="polite" style={s.muted}>{aiLabel}</Text>
  <Text style={s.heading}>{screen==='welcome'?'Understand your textbook. One question at a time.':screen==='chat'?'Your study companion':`Choose ${screen}`}</Text>
  {!!grade && screen!=='welcome' && <Text style={s.muted}>Class {grade} · {subject} {chapter?`· Chapter ${chapter.id}`:''}</Text>}
  {screen==='welcome' && <><Text style={s.body}>Ask questions from available textbooks and verify the original PDF page. Free extractive answers; no paid API key required.</Text><Text style={s.muted}>{base || 'First, connect to your laptop server in Settings.'}</Text><Button title={base?'Start learning':'Connect to server'} disabled={!storageReady} onPress={()=>setScreen(base?'grade':'settings')}/></>}
  {screen==='settings' && <><Text style={s.body}>Server Connection Settings</Text><Text style={s.muted}>Start start_server.bat on your laptop, then enter its displayed URL. Use the same trusted Wi-Fi.</Text><TextInput accessibilityLabel="Server URL" placeholder="http://192.168.1.5:8000" style={s.input} value={serverDraft} onChangeText={setServerDraft} autoCapitalize="none" autoCorrect={false} keyboardType="url"/><Text accessibilityLiveRegion="polite" style={s.muted}>{connection}</Text><Button title="Test connection and save" disabled={busy} onPress={connectServer}/><Button title="Reconnect saved server" disabled={busy||!base} onPress={async()=>{setBusy(true);setError('');try{const health=await api('/health');if(health.status!=='ok')throw new Error('Unexpected health response');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}/><Text style={s.muted}>The address is stored only on this device. Transcription sends recorded audio through your laptop to Groq. Device speech output requires an installed compatible voice.</Text></>}
  {busy && <ActivityIndicator accessibilityLabel="Loading"/>}
  {!!error && <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button title="Server settings" onPress={()=>{setError('');setScreen('settings');}}/>{screen==='chat'&&<Button title="Retry question" onPress={ask}/>}</View>}
  {['grade','subject','book','chapter'].includes(screen) && <>{items.map(item=>{
   const label=typeof item==='object'?('title' in item?`${item.title} · ${item.chunk_count ? item.status : 'Not ready — indexing pending'}`:`Chapter ${item.id} · PDF pp. ${item.page_start}–${item.page_end}`):String(item);
   return <View style={s.card} key={typeof item==='object'?item.id:item}><Button title={label} disabled={typeof item==='object'&&'title' in item&&!item.chunk_count} onPress={()=>{
    setError('');if(screen==='grade'){setGrade(item as number);setSubject('');setBook(undefined);setChapter(undefined);setScreen('subject');}
    if(screen==='subject'){setSubject(item as string);setBook(undefined);setChapter(undefined);setScreen('book');}
    if(screen==='book'){setBook(item as Book);setChapter(undefined);setScreen('chapter');}
    if(screen==='chapter'){setChapter(item as Chapter);setAnswers([]);setScreen('chat');}
   }}/></View>;
  })}{!busy&&!error&&!items.length&&<Text style={s.body}>No indexed content yet. Ask the maintainer to run ingestion.</Text>}</>}
  {screen==='chat'&&<>
   <Text style={s.muted}>Response language: {language}</Text><View style={s.top}>{['English','Urdu','Roman Urdu'].map(l=><Button key={l} title={l} onPress={()=>setLanguage(l)}/>)}</View>
   {answers.map((a,i)=><View style={s.card} key={i}><Text style={s.question}>{a.question}</Text><Text style={s.muted}>{a.result.provider==='extractive'?'Retrieval-only textbook passages':`${a.result.provider} · ${a.result.model||''}`}</Text><Text selectable style={s.body}>{a.result.answer}</Text>{a.result.citations.map(c=><View key={c.id}><Text style={s.muted}>{c.title} · original PDF page {c.page}</Text><Button title="Open citation" onPress={()=>Linking.openURL(c.source_url).catch(()=>setError('Cannot open source'))}/></View>)}<Button title="Play / replay answer" onPress={()=>speakAnswer(a.result.answer).catch(()=>setError('Cannot start device speech.'))}/></View>)}
   <Text style={s.muted}>Playback: {speechState}. Resume repeats the current sentence.</Text><Button title="Pause answer" onPress={pauseSpeech}/><Button title="Resume answer" disabled={speechState!=='Paused'} onPress={()=>speakNext(speech.current.epoch)}/><Button title="Stop answer" onPress={stopSpeech}/>
   <TextInput style={s.input} accessibilityLabel="Your question or editable transcript" placeholder="Ask about this chapter…" multiline value={query} onChangeText={setQuery}/><Button title="Ask tutor" disabled={busy||transcribing||!query.trim()} onPress={ask}/>
   <Text style={s.muted}>Stopping a recording uploads it to your laptop and Groq for transcription. Review and edit the text before submitting. Server audio files are deleted after processing.</Text>
   {transcribing&&<ActivityIndicator accessibilityLabel="Transcribing"/>}<Button title={recording?'Stop and transcribe':'Record question'} disabled={transcribing} onPress={record}/><Button title="Replay recording" onPress={()=>{player.seekTo(0);player.play();}}/>
  </>}
  {screen!=='welcome'&&<Button title="Back" onPress={()=>{setError('');setScreen(previous[screen]);}}/>}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#f1f5f4'},content:{padding:24,gap:18,paddingBottom:60},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{fontSize:12,fontWeight:'800',color:'#166659'},heading:{fontSize:32,lineHeight:39,fontWeight:'700',color:'#163b35'},body:{fontSize:16,lineHeight:25,color:'#253f3b'},muted:{color:'#536d67',fontSize:14,lineHeight:22},card:{backgroundColor:'white',borderRadius:18,padding:18,gap:12},input:{backgroundColor:'white',borderWidth:1,borderColor:'#87aaa0',borderRadius:12,padding:16,fontSize:17,minHeight:58},question:{fontSize:18,fontWeight:'700',color:'#166659'},error:{color:'#a72c2c'}});
