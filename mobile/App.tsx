import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';
import Constants from 'expo-constants';
type Book = { id: string; title: string; status: string };
type Chapter = { id: string; page_start: number; page_end: number };
type Citation = { id: string; title: string; page: number; source_url: string };
type Answer = { answer: string; grounded: boolean; citations: Citation[] };
type Screen = 'welcome' | 'grade' | 'subject' | 'book' | 'chapter' | 'chat' | 'settings';
export default function App() {
 const developmentHost = Constants.expoConfig?.hostUri?.split(':')[0];
 const [base, setBase] = useState(process.env.EXPO_PUBLIC_API_URL || `http://${developmentHost || '10.0.2.2'}:8000`);
 const [screen, setScreen] = useState<Screen>('welcome');
 const [grade, setGrade] = useState<number>(); const [subject, setSubject] = useState('');
 const [book, setBook] = useState<Book>(); const [chapter, setChapter] = useState<Chapter>();
 const [items, setItems] = useState<Array<number | string | Book | Chapter>>([]);
 const [busy, setBusy] = useState(false); const [error, setError] = useState('');
 const [query, setQuery] = useState(''); const [answers, setAnswers] = useState<Array<{question:string; result:Answer}>>([]);
 const [recording, setRecording] = useState(false);
 const contextEpoch = useRef(0);
 useEffect(() => { contextEpoch.current++; setAnswers([]); setQuery(''); setBusy(false); }, [grade, subject, book?.id, chapter?.id]);
 const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY); const player = useAudioPlayer(null);
 async function api(path:string, body?:unknown) {
  const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(),20000);
  try {
   const r = await fetch(base.replace(/\/$/, '') + path, {method:body?'POST':'GET', headers:{'Content-Type':'application/json'}, body:body?JSON.stringify(body):undefined, signal:controller.signal});
   if (!r.ok) throw new Error((await r.json()).detail || `API error ${r.status}`); return await r.json();
  } finally {clearTimeout(timer);}
 }
 useEffect(() => {
  let active = true;
  const paths:Partial<Record<Screen,string>> = {grade:'/api/v1/grades',subject:`/api/v1/subjects?grade=${grade}`,book:`/api/v1/textbooks?grade=${grade}&subject=${encodeURIComponent(subject)}`,chapter:`/api/v1/chapters?textbook=${book?.id}`};
  if (paths[screen]) {setBusy(true);setError('');setItems([]); api(paths[screen]!).then(x=>{if(active)setItems(x);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});}
  return ()=>{active=false;};
 }, [screen,base,grade,subject,book?.id]);
 async function ask() {
  if (!query.trim() || busy || !book || !chapter) return; setBusy(true);setError(''); const question=query.trim(); const epoch=contextEpoch.current;
  try {const result:Answer=await api('/api/v1/chat',{grade,subject,textbook:book.id,chapter:chapter.id,query:question});if(epoch===contextEpoch.current){setAnswers(x=>[...x,{question,result}]);setQuery('');}}
  catch(e){if(epoch===contextEpoch.current)setError((e as Error).message);} finally {if(epoch===contextEpoch.current)setBusy(false);}
 }
 async function record() {
  try {if(recording){await recorder.stop();setRecording(false);await setAudioModeAsync({allowsRecording:false});if(recorder.uri)player.replace(recorder.uri);setError('Recording stays on this device. Transcription provider is optional; type your question to continue.');}
   else {const permission=await AudioModule.requestRecordingPermissionsAsync();if(!permission.granted)throw new Error('Microphone denied. Please use text input.');await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});await recorder.prepareToRecordAsync();recorder.record();setRecording(true);}}
  catch(e){setRecording(false);setError((e as Error).message);}
 }
 const previous:Record<Screen,Screen>={welcome:'welcome',grade:'welcome',subject:'grade',book:'subject',chapter:'book',chat:'chapter',settings:'welcome'};
 return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <View style={s.top}><Text style={s.brand}>TEXTBOOK / TUTOR</Text><Button title="Settings" onPress={()=>setScreen('settings')}/></View>
  <Text style={s.heading}>{screen==='welcome'?'Understand your textbook. One question at a time.':screen==='chat'?'Your study companion':`Choose ${screen}`}</Text>
  {!!grade && screen!=='welcome' && <Text style={s.muted}>Class {grade} · {subject} {chapter?`· Chapter ${chapter.id}`:''}</Text>}
  {screen==='welcome' && <><Text style={s.body}>Ask questions from available textbooks and verify the original PDF page. Free extractive answers; no paid API key required.</Text><Button title="Start learning" onPress={()=>setScreen('grade')}/></>}
  {screen==='settings' && <><Text style={s.body}>Backend URL: use your PC LAN IP on a physical phone.</Text><TextInput accessibilityLabel="Backend URL" style={s.input} value={base} onChangeText={setBase} autoCapitalize="none"/><Text style={s.muted}>Audio stays in device cache. Recognition needs an optional backend provider. Device speech voices vary by language.</Text></>}
  {busy && <ActivityIndicator accessibilityLabel="Loading"/>}
  {!!error && <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button title="Retry" onPress={()=>screen==='chat'?ask():setBase(base.endsWith('/')?base.slice(0,-1):base+'/')}/></View>}
  {['grade','subject','book','chapter'].includes(screen) && <>{items.map(item=>{
   const label=typeof item==='object'?('title' in item?`${item.title} · ${item.status}`:`Chapter ${item.id} · PDF pp. ${item.page_start}–${item.page_end}`):String(item);
   return <View style={s.card} key={typeof item==='object'?item.id:item}><Button title={label} onPress={()=>{
    setError('');if(screen==='grade'){setGrade(item as number);setSubject('');setBook(undefined);setChapter(undefined);setScreen('subject');}
    if(screen==='subject'){setSubject(item as string);setBook(undefined);setChapter(undefined);setScreen('book');}
    if(screen==='book'){setBook(item as Book);setChapter(undefined);setScreen('chapter');}
    if(screen==='chapter'){setChapter(item as Chapter);setAnswers([]);setScreen('chat');}
   }}/></View>;
  })}{!busy&&!error&&!items.length&&<Text style={s.body}>No indexed content yet. Ask the maintainer to run ingestion.</Text>}</>}
  {screen==='chat'&&<>{answers.map((a,i)=><View style={s.card} key={i}><Text style={s.question}>{a.question}</Text><Text selectable style={s.body}>{a.result.answer}</Text>{a.result.citations.map(c=><View key={c.id}><Text style={s.muted}>{c.title} · original PDF page {c.page}</Text><Button title="Open citation" onPress={()=>Linking.openURL(c.source_url).catch(()=>setError('Cannot open source'))}/></View>)}<Button title="Read aloud" onPress={()=>{Speech.stop();Speech.speak(a.result.answer);}}/><Button title="Stop playback" onPress={()=>Speech.stop()}/></View>)}<TextInput style={s.input} accessibilityLabel="Your question" placeholder="Ask about this chapter…" multiline value={query} onChangeText={setQuery}/><Button title="Ask tutor" disabled={busy||!query.trim()} onPress={ask}/><Text style={s.muted}>Recording is local only; transcription is not configured.</Text><Button title={recording?'Stop recording':'Record question'} onPress={record}/><Button title="Replay recording" onPress={()=>player.play()}/></>}
  {screen!=='welcome'&&<Button title="Back" onPress={()=>{setError('');setScreen(previous[screen]);}}/>}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#f1f5f4'},content:{padding:24,gap:18,paddingBottom:60},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{fontSize:12,fontWeight:'800',color:'#166659'},heading:{fontSize:32,lineHeight:39,fontWeight:'700',color:'#163b35'},body:{fontSize:16,lineHeight:25,color:'#253f3b'},muted:{color:'#536d67',fontSize:14,lineHeight:22},card:{backgroundColor:'white',borderRadius:18,padding:18,gap:12},input:{backgroundColor:'white',borderWidth:1,borderColor:'#87aaa0',borderRadius:12,padding:16,fontSize:17,minHeight:58},question:{fontSize:18,fontWeight:'700',color:'#166659'},error:{color:'#a72c2c'}});
