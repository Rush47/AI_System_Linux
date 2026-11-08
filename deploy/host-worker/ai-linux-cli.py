#!/usr/bin/env python3
"""AI Linux natural-language CLI: Ollama proposes, administrator approves, host executes."""
import json, os, re, shlex, subprocess, sys, urllib.request

MODEL=os.getenv("AI_LINUX_OLLAMA_MODEL","thox-ai/thoxopen-8b-heretic:q4_k_m")
URL=os.getenv("AI_LINUX_OLLAMA_URL","http://127.0.0.1:11434/api/chat")
DANGEROUS=re.compile(r"\b(?:rm|mkfs|dd|wipefs|fdisk|parted|reboot|shutdown|modprobe|rmmod|insmod|grub-install|update-grub|update-initramfs|dpkg|apt|systemctl|sysctl|mount|umount|chmod|chown|make|install)\b|/boot|/lib/modules|/etc/(?:default/grub|sysctl)",re.I)
SYSTEM="Convert a Polish natural-language Ubuntu administration request to one single shell command. Return JSON only: {\"command\":\"...\",\"explanation\":\"...\"}. No markdown. Do not include sudo. If unclear, return an empty command. Never execute commands."
def propose(query):
    payload=json.dumps({"model":MODEL,"stream":False,"format":"json","messages":[{"role":"system","content":SYSTEM},{"role":"user","content":query}]}).encode()
    req=urllib.request.Request(URL,data=payload,headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=90) as response:
        result=json.load(response)
    data=json.loads(result["message"]["content"])
    return str(data.get("command","")).strip(),str(data.get("explanation","")).strip()

def main():
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        print("Wymagana interaktywna sesja terminala (TTY).",file=sys.stderr);return 2
    print("AI Linux CLI · propozycje Ollama · wykonanie tylko po potwierdzeniu")
    print("Polecenia wykonują się na hoście, na którym uruchomiono ten skrypt.")
    while True:
        try: query=input("\nai-linux> ").strip()
        except (EOFError,KeyboardInterrupt): print();return 0
        if query.lower() in ("exit","quit","wyjście"):return 0
        if not query:continue
        try: command,explanation=propose(query)
        except Exception as e:print("Błąd Ollama:",e);continue
        if not command or "\n" in command or "\r" in command:
            print("Model nie zaproponował pojedynczego polecenia.");continue
        print("Opis:",explanation)
        print("Polecenie:",command)
        sensitive=bool(DANGEROUS.search(command))
        if sensitive:print("UWAGA: operacja może zmienić system, pakiety, moduły lub kernel.")
        approval=input("Wpisz WYKONAJ, aby uruchomić dokładnie to polecenie: ").strip()
        if approval!="WYKONAJ":print("Anulowano.");continue
        if sensitive and input("Dodatkowe potwierdzenie: wpisz ZMIEN SYSTEM: ").strip()!="ZMIEN SYSTEM":
            print("Anulowano.");continue
        # No shell=True; shell operators and pipes are rejected rather than silently reinterpreted.
        if any(x in command for x in (";","|","&",">","<","$(", "`","\\n")):
            print("Odrzucono składnię powłoki z operatorami. Wpisz prostsze żądanie.");continue
        try:
            argv=shlex.split(command)
            if not argv:continue
            if argv[0]=="sudo":argv=argv[1:]
            print("Uruchamianie:",shlex.join(argv))
            rc=subprocess.call(argv)
            print("Kod zakończenia:",rc)
        except (ValueError,OSError) as e:print("Błąd wykonania:",e)
if __name__=="__main__":sys.exit(main())
