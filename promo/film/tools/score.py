#!/usr/bin/env python3
"""score.py — Origin 一条链 · 17.5 s. Sound effects from the onetake palette, music synthesised in code.

The beat map is parsed out of comp.html so picture and sound cannot drift apart.
Run: python tools/score.py  -> out/sfx.wav (48 kHz stereo)
"""
import os, re, sys, wave, pathlib
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
FILM = HERE.parent
sys.path.insert(0, str(pathlib.Path.home() / '.workbuddy-ai' / 'skills' / 'onetake' / 'scripts'))
from sfx_palette import Score, air, glass, wood, sub, bubble, wobble, pan_of  # noqa: E402

SR = 48000
rng = np.random.default_rng(11)

# ── the timeline, read from the composition ─────────────────────────────────
src = (FILM / 'comp.html').read_text(encoding='utf-8')


def const(name):
    m = re.search(rf'\b{name}\s*=\s*([0-9.]+)', src)
    return float(m.group(1))


DUR = const('DUR')
T_DOT, T_LINE, T_RISE = const('T_DOT'), const('T_LINE'), const('T_RISE')
RISE_DT, T_STOP = const('RISE_DT'), const('T_STOP')
T_GATHER, T_PANEL, T_ASK = const('T_GATHER'), const('T_PANEL'), const('T_ASK')
T_TYPE, T_CLOSE = const('T_TYPE'), const('T_CLOSE')
T_HOLD = const('T_HOLD')
T_RULE, T_MARK = const('T_RULE'), const('T_MARK')
N = 11
rise = [T_RISE + i * RISE_DT for i in range(N)]
print(f'timeline  dur {DUR}  rise {rise[0]:.2f}..{rise[-1]:.2f}  stop {T_STOP}  mark {T_MARK}')

# ── synthesis ───────────────────────────────────────────────────────────────
def tvec(dur):
    return np.arange(int(SR * dur)) / SR


def adsr(n, a=0.01, d=0.12, s=0.7, r=0.35):
    e = np.full(n, s, dtype=float)
    ai, di, ri = int(a * SR), int(d * SR), int(r * SR)
    ai, di, ri = max(1, ai), max(1, di), max(1, ri)
    e[:ai] = np.linspace(0, 1, ai)
    if di < n:
        e[ai:ai + di] = np.linspace(1, s, min(di, n - ai))
    if ri < n:
        e[-ri:] *= np.linspace(1, 0, ri) ** 1.4
    return e


def sine(f, dur, ph=0.0):
    t = tvec(dur)
    return np.sin(2 * np.pi * f * t + ph)


def saw(f, dur, detune=0.0):
    t = tvec(dur)
    x = 2 * ((f * (1 + detune)) * t % 1.0) - 1
    return x


def lp(x, cutoff, order=2):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    for _ in range(order - 1):
        acc = 0.0
        for i, v in enumerate(y):
            acc = (1 - a) * v + a * acc
            y[i] = acc
    return y


def pad(freqs, dur, gain=1.0, cutoff=1500, detune=0.004):
    n = int(SR * dur)
    out = np.zeros(n)
    for f in freqs:
        for d in (-detune, 0.0, detune):
            out += saw(f, dur, d)[:n] * 0.33
    out = lp(out / max(1, len(freqs)), cutoff, 2)
    return out * adsr(n, 0.5, 0.5, 0.85, min(0.9, dur * 0.45)) * gain


def pluck(f, dur=0.5, bright=0.5):
    n = int(SR * dur)
    x = sine(f, dur) * np.exp(-6 * tvec(dur)) + 0.5 * sine(f * 2, dur) * np.exp(-11 * tvec(dur))
    x += 0.25 * sine(f * 3, dur) * np.exp(-16 * tvec(dur))
    return lp(x, 900 + 2600 * bright, 1) * adsr(n, 0.004, 0.05, 0.6, dur * 0.6)


def bass(f, dur, gain=1.0):
    n = int(SR * dur)
    x = sine(f, dur) + 0.4 * sine(f * 2, dur) + 0.18 * saw(f, dur)
    return lp(x, 240, 2) * adsr(n, 0.012, 0.16, 0.72, min(0.5, dur * 0.5)) * gain


def bell(f, dur=1.6, gain=1.0):
    n = int(SR * dur)
    x = np.zeros(n)
    for k, amp, dec in ((1, 1.0, 3.2), (2.01, 0.42, 5.0), (3.02, 0.22, 7.0), (4.98, 0.1, 9.0)):
        x += amp * sine(f * k, dur) * np.exp(-dec * tvec(dur))
    return x * gain


def riser(dur, f0=180, f1=2600, gain=1.0):
    n = int(SR * dur)
    t = tvec(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * 0.6 + np.sin(ph * 2.003) * 0.2
    noise = rng.normal(0, 1, n)
    noise = lp(noise, 3000, 1) * 0.25
    return (x + noise) * (t / dur) ** 2.2 * gain


def hit(dur=1.4, f=52, gain=1.0):
    n = int(SR * dur)
    t = tvec(dur)
    sweep = f * (1 + 2.2 * np.exp(-16 * t))
    ph = 2 * np.pi * np.cumsum(sweep) / SR
    x = np.sin(ph) * np.exp(-4.2 * t)
    x += lp(rng.normal(0, 1, n), 900, 1) * np.exp(-24 * t) * 0.5
    return x * gain


def duck_env(hits, dur, depth=0.55, rel=0.42):
    n = int(SR * dur)
    g = np.ones(n)
    for th in hits:
        i0 = int(th * SR)
        L = int(rel * SR)
        seg = np.linspace(depth, 1.0, L) ** 1.5
        i1 = min(n, i0 + L)
        g[i0:i1] = np.minimum(g[i0:i1], seg[:i1 - i0])
    return g


# ── the music ───────────────────────────────────────────────────────────────
music = np.zeros(int(SR * (DUR + 1)))
hits = []

# room tone: one quiet bed under everything so a rest reads as a room, not a dead file
_room = lp(rng.normal(0, 1, len(music)), 220, 1)
_room = np.stack([_room, np.roll(_room, 977)], 1)
_room *= 10 ** (-52 / 20) / (np.abs(_room).max() + 1e-9)
music2 = None


def add(sig, t, gain=1.0):
    i0 = int(t * SR)
    i1 = min(len(music), i0 + len(sig))
    music[i0:i1] += sig[:i1 - i0] * gain


A2, C3, E3, F2, G2, A3, C4, D4, E4, F4, G4, A4, B3, C5 = (
    110.0, 130.81, 164.81, 87.31, 98.0, 220.0, 261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 246.94, 523.25)

# 0 — the still table: room tone only. The first sound in the film is the wrong answer landing.

# 1 — the chain rises: Am, then F; the bed opens under it
add(pad([A2, C4, E4, A4], 2.9, 1.0, 1200), T_RISE - 0.30, 0.30)
add(bass(A2, 2.6, 0.9), T_RISE - 0.10, 0.36)
add(pad([F2, A3, C4, F4], 3.4, 1.0, 1400), 6.55, 0.34)
add(bass(F2, 3.0, 0.9), 6.60, 0.38)

# an arpeggio that quickens as the chain accelerates
arp_notes = [A4, C5, E4, A4, C5, E4, A4, C5]
for i in range(14):
    t = 5.10 + i * 0.31 - (i * i) * 0.0032
    add(pluck(arp_notes[i % len(arp_notes)] * (2 if i % 3 == 2 else 1), 0.42, 0.45), t, 0.055 + 0.02 * (i / 14))

# a low pizzicato on every plate as it lands
for i, tr in enumerate(rise):
    add(pluck([A2, C3, E3, A2, C3, E3, F2, A2, C3, F2, A2][i] * 2, 0.30, 0.3), tr + 0.02, 0.10)

# 2 — the hold at the root: everything drops to one sustained note
add(pad([A3, E4], 0.7, 1.0, 900), T_STOP - 0.06, 0.20)
hits.append(T_GATHER)

# 3 — the panel: C, warm and close
add(hit(1.5, 54, 1.0), T_GATHER, 0.5)
add(pad([C3, E4, G4, C5], 3.0, 1.0, 1600), T_PANEL - 0.10, 0.26)
add(bass(C3, 2.6, 0.8), T_PANEL, 0.30)
for k, tt in enumerate((T_TYPE + 0.42, T_TYPE + 1.10, T_TYPE + 1.86)):
    add(pluck([G4, C5, E4][k], 0.5, 0.35), tt, 0.05)

# 4 — the hold, then the close: G
add(pad([G2, B3, D4, G4], 1.5, 1.0, 1300), T_CLOSE + 0.04, 0.24)
add(bass(G2, 1.2, 0.7), T_CLOSE + 0.06, 0.26)

# 5 — the wordmark: the resolve
add(pad([C3, E4, G4, C5], 2.4, 1.0, 1900), T_MARK - 0.35, 0.34)
add(bass(C3, 1.9, 1.0), T_MARK - 0.20, 0.40)
add(bell(C5, 2.6, 0.5), T_MARK, 0.20)
add(bell(G4 * 2, 2.2, 0.3), T_MARK + 0.02, 0.12)
hits.append(T_MARK)

# ── the effects, on the palette ─────────────────────────────────────────────
s = Score(dur=DUR, T60=1.15)
P = s.place

P(wood(230, 0.07), T_DOT, 0.34, pan_of(1180), 0.22)                     # the wrong answer lands
P(sub(72, 0.5), T_DOT + 0.01, 0.30, 0.0, 0.25)
P(air(1.6, 240, 2600, 1.4, 0.5), T_LINE, 0.30, 0.25, 0.45, pan_to=-0.35)  # the line draws back

for i, tr in enumerate(rise):                                            # each plate arriving
    pan = 0.55 - 0.95 * (i / (N - 1))
    P(bubble(430 + 90 * (i % 4), 0.22), tr + 0.03, 0.13, pan, 0.35)
    P(air(0.24, 1800, 320, 1.5), tr + 0.05, 0.07, pan, 0.4)

P(air(3.4, 190, 1500, 1.2, 0.55), 6.30, 0.24, -0.2, 0.5, pan_to=0.1)      # the camera riding the chain
P(glass(A4, 1.5, 0.5), T_STOP + 0.02, 0.15, -0.5, 0.6)                    # the root settles

P(hit(1.2, 60, 1.0), T_GATHER, 0.46, 0.0, 0.3)                            # the chain folds into the panel
P(air(0.55, 240, 3000, 1.3, 0.4), T_PANEL - 0.10, 0.26, 0.0, 0.45)
P(bubble(520, 0.26), T_ASK, 0.22, 0.45, 0.3)                              # the question arrives
for tt in (T_TYPE + 0.42, T_TYPE + 1.10, T_TYPE + 1.86):
    P(wood(200, 0.06), tt, 0.11, 0.15, 0.12)
P(air(0.5, 1900, 240, 1.5, 0.35), T_CLOSE, 0.20, 0.0, 0.45)               # the panel closes
P(air(0.7, 260, 3200, 1.3, 0.5), T_RULE, 0.22, 0.0, 0.5)                  # the rule draws
P(sub(50, 1.4), T_MARK, 0.40, 0.0, 0.4)                                   # the wordmark lands
P(glass(1046, 1.8, 0.4), T_MARK + 0.01, 0.10, 0.05, 0.65)
for tt, g in ((T_MARK + 0.52, 0.09), (T_MARK + 0.94, 0.07), (T_MARK + 1.28, 0.055)):
    P(glass(784, 0.9, 0.5), tt, g, 0.0, 0.5)

# ── mix ─────────────────────────────────────────────────────────────────────
sfx = s.mix(-9.0)
n = len(sfx)
mus = music[:n].copy()
mus = np.stack([mus, mus], 1)
gate = np.ones(n)
for a, b, g in ((T_STOP + 0.10, T_GATHER - 0.05, 0.04), (T_HOLD - 0.02, T_CLOSE + 0.03, 0.05)):
    i0, i1 = int(a * SR), min(n, int(b * SR))
    ramp = int(0.14 * SR)
    gate[i0:i1] = g
    gate[max(0, i0 - ramp):i0] = np.linspace(1, g, min(ramp, i0))
    gate[i1:i1 + ramp] = np.linspace(g, 1, min(ramp, n - i1))
mus *= duck_env(hits, DUR + 1.0, 0.5, 0.5)[:n, None] * gate[:, None]
mus += _room[:n]
mus *= 0.42

mix = sfx + mus
mix *= np.minimum(1.0, np.linspace(1, 0, n) * 60 + 0.0)[:, None] * 0 + 1.0
mix[:int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))[:, None]
tail = int(0.55 * SR)
mix[-tail:] *= np.linspace(1, 0, tail)[:, None] ** 1.6

mix = np.tanh(mix * 1.12) * 0.92
peak = np.abs(mix).max()
mix = mix / peak * 10 ** (-3.6 / 20)
rms = np.sqrt((mix ** 2).mean())
print(f'peak {20 * np.log10(np.abs(mix).max()):.2f} dBFS   rms {20 * np.log10(rms):.2f} dB')

out = FILM / 'out'
out.mkdir(exist_ok=True)
with wave.open(str(out / 'sfx.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('wrote', out / 'sfx.wav', f'{os.path.getsize(out / "sfx.wav") // 1024} KB')
