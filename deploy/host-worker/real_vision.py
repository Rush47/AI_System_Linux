#!/usr/bin/env python3
"""Real Vision adapter: local Ollama first, OpenAI API fallback.
Image bytes remain local unless fallback is enabled and triggered.
"""
import argparse, base64, json, mimetypes, os, sys, urllib.error, urllib.request
from pathlib import Path

MAX_BYTES=10*1024*1024
def post_json(url,payload,headers=None,timeout=90):
    body=json.dumps(payload).encode()
    request=urllib.request.Request(url,data=body,headers={"Content-Type":"application/json",**(headers or {})},method="POST")
    with urllib.request.urlopen(request,timeout=timeout) as response:
        return json.load(response)

def analyze(path,prompt):
    image=Path(path).resolve()
    if not image.is_file(): raise ValueError("Image file not found")
    mime=mimetypes.guess_type(str(image))[0]
    if mime not in ("image/jpeg","image/png","image/webp","image/gif"): raise ValueError("Unsupported image type")
    raw=image.read_bytes()
    if not raw or len(raw)>MAX_BYTES: raise ValueError("Image must be 1 byte to 10 MB")
    encoded=base64.b64encode(raw).decode("ascii")
    ollama=os.environ.get("OLLAMA_URL","http://127.0.0.1:11434").rstrip("/")
    model=os.environ.get("OLLAMA_VISION_MODEL","llama3.2-vision:11b")
    errors=[]
    try:
        result=post_json(ollama+"/api/chat",{"model":model,"stream":False,"messages":[{"role":"user","content":prompt,"images":[encoded]}]})
        answer=result.get("message",{}).get("content")
        if not answer: raise ValueError("Ollama returned an empty response")
        return {"provider":"ollama","model":model,"text":answer,"fallback":False}
    except (urllib.error.URLError,ValueError,KeyError,TimeoutError) as exc:
        errors.append("Ollama: "+str(exc))
    if os.environ.get("VISION_OPENAI_FALLBACK","false").lower()!="true":
        raise RuntimeError("; ".join(errors)+"; OpenAI fallback disabled")
    key=os.environ.get("OPENAI_API_KEY")
    if not key: raise RuntimeError("; ".join(errors)+"; OPENAI_API_KEY not set")
    openai_model=os.environ.get("OPENAI_VISION_MODEL","gpt-4.1-mini")
    api_url=os.environ.get("OPENAI_API_BASE","https://api.openai.com/v1").rstrip("/")
    # Never send to a custom API endpoint unless explicitly configured by the operator.
    try:
        result=post_json(api_url+"/responses",{"model":openai_model,"input":[{"role":"user","content":[{"type":"input_text","text":prompt},{"type":"input_image","image_url":"data:"+mime+";base64,"+encoded}]}]},headers={"Authorization":"Bearer "+key})
        text="\n".join(part.get("text","") for item in result.get("output",[]) for part in item.get("content",[]) if part.get("type")=="output_text")
        if not text: raise ValueError("OpenAI returned no text")
        return {"provider":"openai","model":openai_model,"text":text,"fallback":True}
    except (urllib.error.URLError,ValueError,KeyError,TimeoutError) as exc:
        errors.append("OpenAI: "+str(exc))
        raise RuntimeError("; ".join(errors)) from exc

def main():
    parser=argparse.ArgumentParser(description="AI Linux Real Vision")
    parser.add_argument("image");parser.add_argument("--prompt",default="Opisz szczegółowo obraz w języku polskim.")
    args=parser.parse_args()
    try: print(json.dumps(analyze(args.image,args.prompt),ensure_ascii=False,indent=2))
    except Exception as exc: print(json.dumps({"error":str(exc)},ensure_ascii=False),file=sys.stderr);sys.exit(1)

if __name__=="__main__": main()
