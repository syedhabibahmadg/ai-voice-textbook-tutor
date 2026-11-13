export function normalizeServer(value: string): string {
  const input = value.trim();
  if (!input) throw new Error('Enter your laptop server IP or URL.');
  let url: URL;
  try { url = new URL(input.includes('://') ? input : `http://${input}`); }
  catch { throw new Error('Use a server URL such as http://192.168.1.5:8000'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Enter only an HTTP(S) server address and port, without credentials or a path.');
  }
  const host = url.hostname;
  const privateHost = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(host);
  if (url.protocol === 'http:' && !privateHost) throw new Error('HTTP is restricted to private LAN addresses. Use HTTPS for other servers.');
  return url.origin;
}

export async function requestServer(base: string, path: string, body?: unknown) {
  if (!base) throw new Error('Configure and save your laptop server address in Settings first.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: controller.signal,
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('The server returned invalid JSON. Check the address and server logs.'); }
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Server error ${response.status}. Check your selection or server logs.`);
    return data;
  } catch (error) {
    const e = error as Error;
    if (e.name === 'AbortError') throw new Error('Connection timed out. Check that the laptop is on and both devices share the same Wi-Fi.');
    if (e instanceof TypeError) throw new Error('Cannot reach the server. Check the saved IP, port 8000, server launcher and Private-network firewall rule.');
    throw e;
  } finally { clearTimeout(timer); }
}

export async function transcribeAudio(base: string, uri: string, language: string) {
  if (!base) throw new Error('Configure your server first.');
  const form = new FormData();
  form.append('file', { uri, name:'question.m4a', type:'audio/mp4' } as unknown as Blob);
  form.append('language',language);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);
  try {
    const response=await fetch(base+'/api/v1/speech/transcribe',{method:'POST',body:form,signal:controller.signal});
    const data=await response.json();
    if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'Transcription failed. Use text input.');
    if(typeof data.text!=='string')throw new Error('Invalid transcription response.');
    return data.text as string;
  }catch(e){if((e as Error).name==='AbortError')throw new Error('Transcription timed out. Please type your question.');throw e;}
  finally{clearTimeout(timer);}
}
