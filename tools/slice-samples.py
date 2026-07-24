#!/usr/bin/env python3
"""把一条等间隔的半音阶录音切成按音名命名的单音采样。

配合 Guitar Pro 自制音源的流程：
  1. GP 里建一条 bass 轨，速度 30 BPM，每小节一个全音符（= 每 8 秒一个音，
     或 120 BPM 每小节一个全音符 = 每 2 秒一个音），从 E1 起半音上行到想要的最高音。
  2. 选好 RSE 音色，文件 > 导出 > 音频，导出 16-bit WAV。
  3. 运行本脚本切片：
       python3 tools/slice-samples.py export.wav --start E1 --interval 2
  4. 得到 E1.wav、F1.wav、F#1.wav …，在网页「自定义音源」里一次全选上传，
     文件名会被自动识别为音高。

仅依赖标准库；输入需为 PCM 16-bit WAV（GP 默认导出格式）。
"""
import argparse, math, os, struct, sys, wave

NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
BASE = {"C":0, "D":2, "E":4, "F":5, "G":7, "A":9, "B":11}

def note_to_midi(s):
    s = s.strip()
    m = None
    import re
    m = re.match(r"^([A-Ga-g])([#b]?)(-?\d)$", s)
    if not m:
        sys.exit(f"无法解析音名: {s}（示例: E1、A#1、Db2）")
    v = BASE[m.group(1).upper()] + (1 if m.group(2) == "#" else (-1 if m.group(2) == "b" else 0))
    return v + (int(m.group(3)) + 1) * 12

def midi_to_name(m):
    return NAMES[m % 12].replace("#", "#") + str(m // 12 - 1)

def main():
    ap = argparse.ArgumentParser(description="等间隔半音阶录音切片器")
    ap.add_argument("input", help="输入 wav（PCM 16-bit）")
    ap.add_argument("--start", required=True, help="第一个音的音名，如 E1")
    ap.add_argument("--interval", type=float, required=True, help="相邻两个音的间隔秒数")
    ap.add_argument("--count", type=int, default=0, help="共多少个音（默认切到文件结尾）")
    ap.add_argument("--length", type=float, default=2.8, help="每个采样保留的秒数（默认 2.8）")
    ap.add_argument("--out", default="sliced", help="输出目录（默认 ./sliced）")
    ap.add_argument("--gate", type=float, default=0.02, help="去头部静音的阈值（0-1，默认 0.02）")
    a = ap.parse_args()

    w = wave.open(a.input, "rb")
    if w.getsampwidth() != 2:
        sys.exit("只支持 16-bit PCM wav（GP 导出时选 16-bit）")
    sr, nch = w.getframerate(), w.getnchannels()
    raw = w.readframes(w.getnframes()); w.close()
    total = len(raw) // (2 * nch)
    # 转 mono
    mono = [0] * total
    for i in range(total):
        s = 0
        for c in range(nch):
            s += struct.unpack_from("<h", raw, (i * nch + c) * 2)[0]
        mono[i] = s // nch

    start_midi = note_to_midi(a.start)
    n = a.count or int(total / (sr * a.interval))
    os.makedirs(a.out, exist_ok=True)
    peak_all = max(1, max(abs(x) for x in mono))
    gain = (0.85 * 32767) / peak_all

    made = []
    for i in range(n):
        s0 = int(i * a.interval * sr)
        s1 = min(total, int((i * a.interval + a.length) * sr))
        if s0 >= total: break
        seg = mono[s0:s1]
        # 去头部静音
        th = a.gate * peak_all
        j = 0
        while j < len(seg) and abs(seg[j]) < th: j += 1
        seg = seg[max(0, j - int(0.005 * sr)):]
        if not seg: continue
        # 尾部 80ms 淡出
        fade = min(len(seg), int(0.08 * sr))
        out = bytearray()
        for k, v in enumerate(seg):
            g = gain
            if k >= len(seg) - fade:
                g *= (len(seg) - k) / fade
            out += struct.pack("<h", max(-32768, min(32767, int(v * g))))
        name = midi_to_name(start_midi + i)
        path = os.path.join(a.out, name.replace("#", "#") + ".wav")
        ww = wave.open(path, "wb")
        ww.setnchannels(1); ww.setsampwidth(2); ww.setframerate(sr)
        ww.writeframes(bytes(out)); ww.close()
        made.append(name)
    print(f"切出 {len(made)} 个采样到 {a.out}/: {' '.join(made)}")

if __name__ == "__main__":
    main()
