export type VoiceActivity = {
  monitor: boolean; started: number; utteranceAt: number; lastSound: number;
  heard: boolean; bargeSamples: number; trimStart: number;
};

// Android's voice_communication audio source requests device echo cancellation.
// Require sustained near-field speech so short noises do not interrupt playback.
export function voiceActivity(state:VoiceActivity, level:number|undefined, now:number) {
  if(state.monitor){
    if(now-state.started<700)return 'none';
    state.bargeSamples=(level??-160)>-30?state.bargeSamples+1:0;
    if(state.bargeSamples<3)return 'none';
    state.monitor=false;
    state.trimStart=Math.max(0,(now-state.started)/1000-0.7);
    state.heard=true;state.lastSound=now;state.utteranceAt=now;
    return 'interrupt';
  }
  if((level??-160)>-38){state.heard=true;state.lastSound=now;}
  if((state.heard&&now-state.lastSound>1000)||now-state.utteranceAt>30000)return 'submit';
  if(!state.heard&&now-state.started>10000)return 'timeout';
  return 'none';
}
