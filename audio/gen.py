"""명상 대본(audio/scripts/*.txt)을 사람 목소리 MP3로 만든다.

대본 규칙
- 맨 위 `키: 값` 줄(id, category, title, desc, voice)과 `---` 아래 본문
- 본문 한 줄 = 한 번 말하기 (말한 뒤 0.9초 쉼)
- `~5` 처럼 물결+숫자만 있는 줄 = 그만큼 조용히 쉬기(초)
- 한 줄 안의 ` / ` = 숫자 세기. 나뉜 조각마다 정확히 1초씩 맞춘다
  예) 들이쉬세요. / 하나 / 둘 / 셋 / 넷

사용법
  python audio/gen.py          # edge-tts로 실제 음성 생성 (인터넷 필요)
  python audio/gen.py --mock   # 음성 대신 짧은 신호음으로 시간 구성만 시험
바뀐 대본만 다시 만든다(대본 내용의 해시로 비교).
"""
import asyncio, hashlib, json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(ROOT, "scripts")
OUT = os.path.join(ROOT, "files")
MANIFEST = os.path.join(ROOT, "manifest.json")

VOICE = "ko-KR-SunHiNeural"   # 차분한 여성 목소리
RATE = "-12%"                 # 명상용으로 조금 느리게
PITCH = "-2Hz"
SR = 24000
LINE_GAP = 0.9
COUNT_SEC = 1.0
LEAD_IN = 1.5
GEN_VERSION = "2"             # 생성 방식이 바뀌면 올려서 전부 다시 만든다

MOCK = "--mock" in sys.argv


def sh(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", path], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def parse(path):
    raw = open(path, encoding="utf-8").read()
    head, body = raw.split("---\n", 1)
    meta = {}
    for line in head.strip().splitlines():
        k, v = line.split(":", 1)
        meta[k.strip()] = v.strip()
    items = []  # ("say", text) | ("count", [pieces]) | ("rest", sec)
    for line in body.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.fullmatch(r"~(\d+(?:\.\d+)?)", line)
        if m:
            items.append(("rest", float(m.group(1))))
        elif " / " in line:
            items.append(("count", [p.strip() for p in line.split(" / ") if p.strip()]))
        else:
            items.append(("say", line))
    meta["hash"] = hashlib.sha1((GEN_VERSION + VOICE + RATE + PITCH + raw).encode()).hexdigest()[:12]
    return meta, items


async def tts(text, voice, wav):
    mp3 = wav[:-4] + ".mp3"
    if MOCK:
        secs = max(0.4, len(text) * 0.16)
        sh("ffmpeg", "-y", "-f", "lavfi", "-i", f"sine=frequency=440:duration={secs}", "-ar", str(SR), "-ac", "1", wav)
        return
    import edge_tts
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate=RATE, pitch=PITCH).save(mp3)
            break
        except Exception as e:  # 일시적인 네트워크 오류 대비
            if attempt == 3:
                raise
            print("  다시 시도:", e)
            await asyncio.sleep(2 + attempt * 2)
    sh("ffmpeg", "-y", "-i", mp3, "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", wav)


def silence(sec, wav):
    sh("ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{sec:.3f}", "-c:a", "pcm_s16le", wav)


def fit(src, sec, dst):
    """조각을 정확히 sec초 길이로 맞춘다(짧으면 뒤에 쉼, 길면 끝을 살짝 줄여 페이드)."""
    sh("ffmpeg", "-y", "-i", src, "-af", f"apad=whole_dur={sec},atrim=0:{sec},afade=t=out:st={max(0, sec - 0.08)}:d=0.08",
       "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", dst)


async def build(meta, items, dst):
    voice = meta.get("voice", VOICE)
    with tempfile.TemporaryDirectory() as tmp:
        parts, n = [], 0

        def nxt(ext="wav"):
            nonlocal n
            n += 1
            return os.path.join(tmp, f"{n:04d}.{ext}")

        lead = nxt(); silence(LEAD_IN, lead); parts.append(lead)
        for kind, val in items:
            if kind == "rest":
                p = nxt(); silence(val, p); parts.append(p)
            elif kind == "say":
                p = nxt(); await tts(val, voice, p); parts.append(p)
                g = nxt(); silence(LINE_GAP, g); parts.append(g)
            else:  # count
                first, counts = val[0], val[1:]
                p = nxt(); await tts(first, voice, p); parts.append(p)
                g = nxt(); silence(0.4, g); parts.append(g)
                for c in counts:
                    raw = nxt(); await tts(c, voice, raw)
                    p = nxt(); fit(raw, COUNT_SEC, p); parts.append(p)
                g = nxt(); silence(LINE_GAP, g); parts.append(g)
        tail = nxt(); silence(2.0, tail); parts.append(tail)

        lst = os.path.join(tmp, "list.txt")
        with open(lst, "w") as f:
            f.writelines(f"file '{p}'\n" for p in parts)
        joined = os.path.join(tmp, "joined.wav")
        sh("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined)
        # 소리 크기를 고르게 맞추고, 끝을 부드럽게 줄인 뒤 MP3로 저장
        total = dur(joined)
        sh("ffmpeg", "-y", "-i", joined,
           "-af", f"loudnorm=I=-19:TP=-2:LRA=11,afade=t=out:st={max(0, total - 1.5):.2f}:d=1.5",
           "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", dst)
    return dur(dst)


async def main():
    os.makedirs(OUT, exist_ok=True)
    old = {}
    if os.path.exists(MANIFEST):
        old = {t["id"]: t for t in json.load(open(MANIFEST, encoding="utf-8")).get("tracks", [])}
    tracks = []
    for name in sorted(os.listdir(SCRIPTS)):
        if not name.endswith(".txt"):
            continue
        meta, items = parse(os.path.join(SCRIPTS, name))
        tid = meta["id"]
        file = f"files/{tid}.mp3"
        dst = os.path.join(ROOT, file)
        prev = old.get(tid)
        if prev and prev.get("hash") == meta["hash"] and os.path.exists(dst) and not MOCK:
            print("그대로 둠:", tid)
            tracks.append(prev)
            continue
        print("만드는 중:", tid, meta["title"])
        seconds = await build(meta, items, dst)
        tracks.append({"id": tid, "category": meta["category"], "title": meta["title"], "desc": meta["desc"],
                       "file": file, "duration": round(seconds, 1), "voice": meta.get("voice", VOICE),
                       "hash": meta["hash"]})
        print(f"  완료 {seconds/60:.1f}분")
    json.dump({"version": 1, "tracks": tracks}, open(MANIFEST, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("manifest.json 저장:", len(tracks), "개")


asyncio.run(main())
