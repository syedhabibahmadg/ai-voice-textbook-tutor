import json
from types import SimpleNamespace
from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app import providers as p

EVIDENCE=[dict(id='real:12:0',book_id='real',chapter='1',grade=11,subject='Chemistry',page=12,text='Ionization energy is the energy needed to remove one electron from an atom.')]

def fake_groq(content):
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **kwargs:SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))],usage=None))))

def test_verified_generated_sources(monkeypatch):
    monkeypatch.setenv('AI_PROVIDER','groq')
    monkeypatch.setattr(p,'selected_groq_model',lambda:'verified-test-model')
    content=json.dumps({'answer':'It takes energy to remove an electron from an atom.','sources':[{'id':'real:12:0','quote':'energy needed to remove one electron'}]})
    monkeypatch.setattr(p,'groq_client',lambda:fake_groq(content))
    result=p.generate('What is ionization energy?',EVIDENCE)
    assert result['provider']=='groq' and result['citations'][0]['page']==12
    assert result['citations'][0]['subject']=='Chemistry'

def test_invented_citation_never_switches_provider(monkeypatch):
    monkeypatch.setenv('AI_PROVIDER','auto')
    monkeypatch.setattr(p,'selected_groq_model',lambda:'verified-test-model')
    monkeypatch.setattr(p,'groq_client',lambda:fake_groq(json.dumps({'answer':'An answer','sources':[{'id':'invented','quote':'invented source text'}]})))
    monkeypatch.setattr(p,'ollama_models',lambda:pytest.fail('Invalid generated content must not trigger another provider'))
    result=p.generate('Question',EVIDENCE)
    assert result['provider']=='extractive' and result['fallback_reason']=='generated_evidence_validation_failed'

def test_groq_unavailable_falls_back(monkeypatch):
    monkeypatch.setenv('AI_PROVIDER','groq')
    monkeypatch.setattr(p,'selected_groq_model',lambda:(_ for _ in ()).throw(ConnectionError()))
    result=p.generate('Question',EVIDENCE)
    assert result['provider']=='extractive' and result['grounded']

def test_abstention_does_not_fallback(monkeypatch):
    monkeypatch.setenv('AI_PROVIDER','groq')
    monkeypatch.setattr(p,'selected_groq_model',lambda:'verified-test-model')
    monkeypatch.setattr(p,'groq_client',lambda:fake_groq('{"abstain":true,"answer":"Insufficient evidence.","sources":[]}'))
    result=p.generate('Question',EVIDENCE)
    assert result['provider']=='groq' and not result['grounded'] and result['citations']==[]

def test_no_evidence_no_charge(monkeypatch):
    monkeypatch.setattr(p,'groq_client',lambda:pytest.fail('Do not call paid API without evidence'))
    assert not p.generate('Question',[])['grounded']

def test_status_and_speech_without_key(monkeypatch):
    monkeypatch.delenv('GROQ_API_KEY',raising=False)
    with TestClient(app) as client:
        result=client.get('/api/v1/ai/status').json()
        assert not result['groq_configured'] and 'GROQ_API_KEY' not in json.dumps(result)
        assert client.post('/api/v1/speech/transcribe',files={'file':('test.txt',b'not audio','text/plain')}).status_code==415
        assert client.post('/api/v1/speech/transcribe',files={'file':('test.m4a',b'not audio','audio/mp4')}).status_code==503

def test_two_independent_clients(monkeypatch):
    monkeypatch.setenv('AI_PROVIDER','extractive')
    def query(_):
        with TestClient(app) as client:
            result=client.post('/api/v1/chat',json={'grade':11,'subject':'Chemistry','textbook':'1yEloqkUnyr8m5bThpJaZH4I2K8ILjJVm','chapter':'1','query':'What is ionization energy?'}).json()
            return result
    # Use local authorized corpus only when available; portable fixture tests cover filtering separately.
    from app.catalog import books
    if not any(b.get('chunk_count') and b['grade']==11 and b['subject']=='Chemistry' for b in books()):
        pytest.skip('Real textbook index is local only')
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(query,range(2)))
    assert all(r['provider']=='extractive' and r['citations'][0]['page']==12 for r in results)


def test_quote_typography_does_not_reject_a_real_source():
    evidence=[dict(id='source:1',text='Algorithms are step-by-step procedures for solving problems.')]
    result=p.validate(json.dumps({'answer':'An algorithm solves a problem in steps.','sources':[{'id':'source:1','quote':'Algorithms are step\u2011by\u2011step procedures for solving problems.'}]}),evidence)
    assert result['grounded'] and result['citations']==evidence
    with pytest.raises(ValueError):
        p.validate(json.dumps({'answer':'Unsupported','sources':[{'id':'source:1','quote':'Algorithms are random procedures for solving problems.'}]}),evidence)
