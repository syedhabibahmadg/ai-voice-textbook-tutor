import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from .providers import groq_client, groq_models, GATE

router=APIRouter(prefix='/api/v1/speech')
LIMIT=20*1024*1024

@router.post('/transcribe')
def transcribe(file: UploadFile=File(...), language: str=Form('auto')):
    if language not in ['auto','en','ur']:
        raise HTTPException(422,'Language must be auto, en or ur')
    suffix=Path(file.filename or '').suffix.lower()
    if suffix not in ['.m4a','.mp4','.mp3','.wav','.webm','.ogg']:
        raise HTTPException(415,'Unsupported audio file type')
    if not os.getenv('GROQ_API_KEY'):
        raise HTTPException(503,'Groq transcription is not configured on this server. Use text input.')
    if not shutil.which('ffprobe'):
        raise HTTPException(503,'Audio validation requires ffprobe on the server PATH.')
    if not GATE.acquire(blocking=False):
        raise HTTPException(429,'AI server busy. Please retry shortly.')
    try:
        with tempfile.TemporaryDirectory(prefix='tutor-audio-') as directory:
            path=Path(directory)/('question'+suffix)
            size=0
            with path.open('wb') as out:
                while chunk:=file.file.read(65536):
                    size+=len(chunk)
                    if size>LIMIT:
                        raise HTTPException(413,'Audio exceeds the 20 MiB upload limit')
                    out.write(chunk)
            if not size:
                raise HTTPException(422,'Audio file is empty')
            try:
                probe=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type','-of','json',str(path)],capture_output=True,text=True,timeout=10,check=True)
                info=json.loads(probe.stdout)
                duration=float(info['format']['duration'])
                if duration<=0 or duration>120 or not any(s['codec_type']=='audio' for s in info['streams']):
                    raise ValueError('Invalid audio duration')
            except Exception:
                raise HTTPException(422,'Invalid audio or duration exceeds 120 seconds')
            model=os.getenv('GROQ_STT_MODEL','whisper-large-v3')
            if model not in groq_models():
                raise HTTPException(503,'Configured speech model is unavailable')
            with path.open('rb') as audio:
                response=groq_client().audio.transcriptions.create(file=audio,model=model,**({'language':language} if language!='auto' else {}))
            return {'text':response.text,'provider':'groq','model':model,'duration_seconds':duration,'language':language}
    except HTTPException:
        raise
    except Exception as exc:
        code=getattr(exc,'status_code',None)
        raise HTTPException(429 if code==429 else 503,'Transcription provider unavailable. Please retry or type the question.')
    finally:
        file.file.close()
        GATE.release()

@router.post('/synthesize')
def synthesize():
    raise HTTPException(501,'Use device text-to-speech; no backend TTS provider is configured.')
