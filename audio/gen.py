"""명상 대본(audio/scripts/*.txt)을 사람 목소리 MP3로 만든다.

대본 규칙
- 맨 위 `키: 값` 줄과 `---` 아래 본문
  id, category, title, desc      : 기본 정보
  voice                          : 성우 id (audio/voices.json, 예: seoyeon). 비우면 서연
  pitch                          : 톤 조절(Hz, 성우 기본값에 더함. 예: -3, 4)
  rate                           : 속도 조절(%, 성우 기본값에 더함. 예: -10 = 더 느리게)
  gap                            : 문장 사이 쉼(초, 기본 0.9)
  status                         : published(앱에 공개) | draft(초안, 관리자만 들음)
- 본문 한 줄 = 한 번 말하기
- `~5` 처럼 물결+숫자만 있는 줄 = 그만큼 조용히 쉬기(초)
- 한 줄 안의 ` / ` = 숫자 세기. 나뉜 조각마다 정확히 1초씩 맞춘다
  예) 들이쉬세요. / 하나 / 둘 / 셋 / 넷

결과
- audio/manifest.json : 공개(published) 명상 → 앱에 나옴
- audio/drafts.json   : 초안(draft) 명상 → 관리자 화면에서만 들음
- audio/samples/*.mp3 : 성우별 짧은 샘플 (관리자 화면에서 성우 고를 때)

사용법
  python audio/gen.py          # edge-tts로 실제 음성 생성 (인터넷 필요)
  python audio/gen.py --mock   # 음성 대신 짧은 신호음으로 시간 구성만 시험
바뀐 대본만 다시 만든다(대본 내용 + 성우 설정의 해시로 비교).
"""
import asyncio, hashlib, json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(ROOT, "scripts")
OUT = os.path.join(ROOT, "files")
SAMPLES = os.path.join(ROOT, "samples")
MANIFEST = os.path.join(ROOT, "manifest.json")
DRAFTS = os.path.join(ROOT, "drafts.json")
SAMPLES_JSON = os.path.join(ROOT, "samples.json")
VOICES = json.load(open(os.path.join(ROOT, "voices.json"), encoding="utf-8"))
PRESETS = {v["id"]: v for v in VOICES["voices"]}
DEFAULT_PRESET = "seoyeon"

BASE_RATE = -12               # 명상용으로 모든 목소리를 조금 느리게(%)
SR = 24000
LINE_GAP = 0.9
COUNT_SEC = 1.0
LEAD_IN = 1.5
GEN_VERSION = "3"             # 생성 방식이 바뀌면 올려서 전부 다시 만든다

MOCK = "--mock" in sys.argv


def sh(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", path], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def num(v, default, lo, hi):
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return default


def voice_of(meta):
    """대본의 성우 설정을 edge-tts 값으로 바꾼다."""
    vid = meta.get("voice", "").strip() or DEFAULT_PRESET
    if vid in PRESETS:
        p = PRESETS[vid]
    else:  # 예전 대본처럼 edge 목소리 이름을 직접 쓴 경우
        p = {"id": vid, "name": vid, "engine": vid, "pitch": 0, "rate": 0}
    pitch = int(round(p["pitch"] + num(meta.get("pitch"), 0, -20, 20)))
    rate = int(round(BASE_RATE + p["rate"] + num(meta.get("rate"), 0, -40, 30)))
    return {"id": p["id"], "name": p.get("name", p["id"]), "engine": p["engine"],
            "pitch": f"{pitch:+d}Hz", "rate": f"{rate:+d}%"}


def parse(path):
    raw = open(path, encoding="utf-8").read().replace("\r\n", "\n")
    head, body = raw.split("---\n", 1)
    meta = {}
    for line in head.strip().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    items = []  # ("say", text) | ("count", [pieces]) | ("rest", sec)
    for line in body.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.fullmatch(r"~(\d+(?:\.\d+)?)", line)
        if m:
            items.append(("rest", min(60.0, float(m.group(1)))))
        elif " / " in line:
            items.append(("count", [p.strip() for p in line.split(" / ") if p.strip()]))
        else:
            items.append(("say", line))
    v = voice_of(meta)
    meta["_voice"] = v
    meta["_gap"] = num(meta.get("gap"), LINE_GAP, 0.2, 5)
    # 공개/초안 상태는 소리와 상관없으므로 해시에서 뺀다 (공개로 바꿔도 다시 만들지 않음)
    sound = re.sub(r"(?m)^status:.*\n?", "", raw)
    meta["hash"] = hashlib.sha1((GEN_VERSION + json.dumps(v, sort_keys=True) + sound).encode()).hexdigest()[:12]
    return meta, items


async def tts(text, v, wav):
    mp3 = wav[:-4] + ".mp3"
    if MOCK:
        secs = max(0.4, len(text) * 0.16)
        sh("ffmpeg", "-y", "-f", "lavfi", "-i", f"sine=frequency=440:duration={secs}", "-ar", str(SR), "-ac", "1", wav)
        return
    import edge_tts
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, v["engine"], rate=v["rate"], pitch=v["pitch"]).save(mp3)
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


async def build(items, v, gap, dst, lead=LEAD_IN, tail_sec=2.0):
    with tempfile.TemporaryDirectory() as tmp:
        parts, n = [], 0

        def nxt(ext="wav"):
            nonlocal n
            n += 1
            return os.path.join(tmp, f"{n:04d}.{ext}")

        p = nxt(); silence(lead, p); parts.append(p)
        for kind, val in items:
            if kind == "rest":
                p = nxt(); silence(val, p); parts.append(p)
            elif kind == "say":
                p = nxt(); await tts(val, v, p); parts.append(p)
                g = nxt(); silence(gap, g); parts.append(g)
            else:  # count
                first, counts = val[0], val[1:]
                p = nxt(); await tts(first, v, p); parts.append(p)
                g = nxt(); silence(0.4, g); parts.append(g)
                for c in counts:
                    raw = nxt(); await tts(c, v, raw)
                    p = nxt(); fit(raw, COUNT_SEC, p); parts.append(p)
                g = nxt(); silence(gap, g); parts.append(g)
        p = nxt(); silence(tail_sec, p); parts.append(p)

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


def load(path):
    if os.path.exists(path):
        return {t["id"]: t for t in json.load(open(path, encoding="utf-8")).get("tracks", [])}
    return {}


def save(path, tracks):
    json.dump({"version": 1, "tracks": tracks}, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


async def make_samples():
    """성우마다 짧은 샘플을 만든다 (성우 설정이 바뀐 것만)."""
    os.makedirs(SAMPLES, exist_ok=True)
    old = json.load(open(SAMPLES_JSON, encoding="utf-8")) if os.path.exists(SAMPLES_JSON) else {}
    out = {}
    for p in VOICES["voices"]:
        v = voice_of({"voice": p["id"]})
        h = hashlib.sha1((GEN_VERSION + json.dumps(v, sort_keys=True) + VOICES["sample"]).encode()).hexdigest()[:12]
        file = f"samples/{p['id']}.mp3"
        dst = os.path.join(ROOT, file)
        if old.get(p["id"], {}).get("hash") == h and os.path.exists(dst) and not MOCK:
            out[p["id"]] = old[p["id"]]
            continue
        print("샘플 만드는 중:", p["name"])
        await build([("say", VOICES["sample"])], v, LINE_GAP, dst, lead=0.3, tail_sec=0.5)
        out[p["id"]] = {"file": file, "hash": h}
    for name in os.listdir(SAMPLES):  # 목록에서 빠진 성우의 샘플은 지운다
        if name.endswith(".mp3") and name[:-4] not in out:
            os.remove(os.path.join(SAMPLES, name))
    json.dump(out, open(SAMPLES_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


async def main():
    os.makedirs(OUT, exist_ok=True)
    await make_samples()
    old = {**load(DRAFTS), **load(MANIFEST)}
    published, drafts, used, broken = [], [], set(), []
    for name in sorted(os.listdir(SCRIPTS)):
        if not name.endswith(".txt"):
            continue
        try:
            meta, items = parse(os.path.join(SCRIPTS, name))
            tid = meta["id"]
        except Exception as e:  # 형식이 틀린 대본 하나 때문에 전체가 멈추지 않게
            print("건너뜀(대본 형식 오류):", name, e)
            broken.append(name)
            continue
        # 대본 파일의 git blob sha (관리자 화면이 "저장한 대본으로 만든 소리인지" 비교하는 데 씀)
        data = open(os.path.join(SCRIPTS, name), "rb").read()
        src = hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()
        file = f"files/{tid}.mp3"
        dst = os.path.join(ROOT, file)
        used.add(f"{tid}.mp3")
        v = meta["_voice"]
        prev = old.get(tid)
        if prev and prev.get("hash") == meta["hash"] and os.path.exists(dst) and not MOCK:
            print("그대로 둠:", tid)
            seconds = prev["duration"]
        else:
            print("만드는 중:", tid, meta.get("title", ""), f"({v['name']}, 톤 {v['pitch']}, 속도 {v['rate']})")
            seconds = round(await build(items, v, meta["_gap"], dst), 1)
            print(f"  완료 {seconds/60:.1f}분")
        status = "draft" if meta.get("status", "published").strip() == "draft" else "published"
        track = {"id": tid, "category": meta.get("category", "breath"), "title": meta.get("title", tid),
                 "desc": meta.get("desc", ""), "file": file, "duration": seconds,
                 "voice": v["engine"], "voiceId": v["id"], "voiceName": v["name"],
                 "pitch": v["pitch"], "rate": v["rate"], "hash": meta["hash"], "src": src}
        (drafts if status == "draft" else published).append(track)
    # 지운 대본의 음성 파일도 지운다
    # (형식이 틀린 대본이 있으면 그 대본의 음성이 지워지지 않도록 이번에는 지우지 않는다)
    if broken:
        print("형식이 틀린 대본이 있어 음성 파일 정리는 건너뜀:", ", ".join(broken))
    for name in ([] if broken else os.listdir(OUT)):
        if name.endswith(".mp3") and name not in used:
            os.remove(os.path.join(OUT, name))
            print("지움:", name)
    save(MANIFEST, published)
    save(DRAFTS, drafts)
    print(f"manifest.json 공개 {len(published)}개 · drafts.json 초안 {len(drafts)}개 저장")


asyncio.run(main())
