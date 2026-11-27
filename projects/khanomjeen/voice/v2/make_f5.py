import sys, time, soundfile as sf
from f5_tts_th.tts import TTS
tts = TTS(model="v1")
lines = [l.strip() for l in open("s.txt", encoding="utf8") if l.strip()]
idx = [int(x) for x in sys.argv[1].split(",")]
for i in idx:
    t = time.time()
    wav = tts.infer(ref_audio="ref.wav", ref_text="วันนี้ผมจะเล่าเรื่องร้านอาหารเล็กๆ ที่ขายดีกว่าร้านอื่นในตลาด", gen_text=lines[i], step=32, cfg=2.0, speed=float(sys.argv[2]))
    sf.write(f"f5_{i:02d}.wav", wav, 24000); print(i, len(wav)/24000, round(time.time()-t,1), flush=True)
