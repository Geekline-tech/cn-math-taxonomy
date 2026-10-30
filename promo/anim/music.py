import math
import os
import wave

import numpy as np

SR = 48000
DUR = 38.0
N = int(SR * DUR)
rng = np.random.default_rng(20261031)

A2, C3, E3, G3 = 110.00, 130.81, 164.81, 196.00
F2, G2 = 87.31, 98.00
C4, D4, E4, G4, A4, B4 = 261.63, 293.66, 329.63, 392.00, 440.00, 493.88
A3, B3, F4, C5, E5, A5 = 220.00, 246.94, 349.23, 523.25, 659.25, 880.00

mix = np.zeros((N, 2), dtype=np.float64)


def place(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N:
        return
    n = min(len(sig), N - i)
    l = math.sqrt(0.5 * (1.0 - pan))
    r = math.sqrt(0.5 * (1.0 + pan))
    mix[i:i + n, 0] += sig[:n] * gain * l
    mix[i:i + n, 1] += sig[:n] * gain * r


def env(n, a, d, s, r, sus=0.7):
    a_n = max(1, int(a * SR))
    d_n = max(1, int(d * SR))
    r_n = max(1, int(r * SR))
    s_n = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([
        np.linspace(0, 1, a_n, endpoint=False),
        np.linspace(1, sus, d_n, endpoint=False),
        np.full(s_n, sus),
        np.linspace(sus, 0, r_n),
    ])
    if len(e) < n:
        e = np.concatenate([e, np.zeros(n - len(e))])
    return e[:n]


def adsr(n, a, r, curve=4.0):
    e = np.ones(n)
    a_n = min(n, max(1, int(a * SR)))
    r_n = min(n - a_n, max(1, int(r * SR)))
    e[:a_n] = np.linspace(0, 1, a_n) ** 0.6
    e[n - r_n:] = np.linspace(1, 0, r_n) ** curve
    return e


def saw(freq, n, phase=0.0):
    t = np.arange(n) / SR
    return 2.0 * ((t * freq + phase) % 1.0) - 1.0


def sine(freq, n, phase=0.0):
    t = np.arange(n) / SR
    return np.sin(2 * math.pi * freq * t + phase)


def lowpass(x, cutoff, res=0.0):
    if np.isscalar(cutoff):
        cutoff = np.full(len(x), cutoff)
    fc = 2 * math.pi * np.clip(cutoff, 20, SR * 0.45) / SR
    a = 1 - np.exp(-fc)
    y = np.empty_like(x)
    acc = 0.0
    prev = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    if res > 0:
        y = y + res * (y - prev)
    return y


def fast_lowpass(x, cutoff):
    fc = 2 * math.pi * min(cutoff, SR * 0.45) / SR
    a = 1 - math.exp(-fc)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


def pad(freqs, dur, gain, at, cutoff=900, detune=0.004):
    n = int(dur * SR)
    out = np.zeros(n)
    for f in freqs:
        for k, d in enumerate((-1, 0, 1)):
            out += saw(f * (1 + d * detune), n, phase=rng.random())
    out /= (len(freqs) * 3)
    out = fast_lowpass(out, cutoff)
    e = env(n, min(0.9, dur * 0.25), 0.4, 0.75, min(1.2, dur * 0.35))
    place(out * e, at, gain, 0.0)


def bass(freq, dur, gain, at):
    n = int(dur * SR)
    s = sine(freq, n) * 0.8 + saw(freq, n) * 0.25
    s = fast_lowpass(s, 240)
    e = env(n, 0.01, 0.12, 0.55, 0.09)
    place(s * e, at, gain, 0.0)


def kick(gain, at):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 118 * np.exp(-t * 26) + 44
    s = np.sin(2 * math.pi * np.cumsum(f) / SR)
    e = np.exp(-t * 7.5)
    place(s * e, at, gain, 0.0)


def hat(gain, at, decay=0.05):
    n = int(decay * 5 * SR)
    s = rng.normal(0, 1, n)
    s = np.diff(np.concatenate([[0], s]))
    e = np.exp(-np.arange(n) / SR * (1.0 / decay))
    place(s * e, at, gain, 0.28)


def bell(freq, gain, at, dur=2.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * math.pi * freq * t) * np.exp(-t * 2.2)
    s += 0.4 * np.sin(2 * math.pi * freq * 2.01 * t) * np.exp(-t * 3.4)
    s += 0.22 * np.sin(2 * math.pi * freq * 3.02 * t) * np.exp(-t * 5.0)
    place(s, at, gain, -0.18)


def blip(freq, gain, at, dur=0.22):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * math.pi * freq * t) * np.exp(-t * 18)
    place(s, at, gain, 0.3)


def impact(gain, at):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * math.pi * (72 * np.exp(-t * 3) + 38) * t) * np.exp(-t * 2.6)
    s += 0.5 * rng.normal(0, 1, n) * np.exp(-t * 14)
    place(s, at, gain, 0.0)


def riser(gain, at, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = rng.normal(0, 1, n)
    seg = np.array_split(np.arange(n), 60)
    out = np.zeros(n)
    for k, idx in enumerate(seg):
        cutoff = 300 * (1 + k / 8.0)
        out[idx] = fast_lowpass(s[idx], cutoff)
    e = np.linspace(0, 1, n) ** 2.2
    place(out * e, at, gain, 0.0)


def arp(freqs, start, end, step, gain, cutoff=2600):
    t = start
    k = 0
    while t < end:
        f = freqs[k % len(freqs)]
        n = int(step * 2.4 * SR)
        s = saw(f, n) * 0.5 + sine(f * 2, n) * 0.2
        s = fast_lowpass(s, cutoff)
        e = adsr(n, 0.004, step * 2.2, 3.2)
        place(s * e, t, gain, 0.32 if k % 2 else -0.32)
        t += step
        k += 1


CHORDS = [
    (0.0, 5.0, [A2, C4, E4, A4]),
    (5.0, 12.0, [A2, C4, E4, A4]),
    (12.0, 19.0, [F2, A3, C4, F4]),
    (19.0, 25.0, [C3, E4, G4, C5]),
    (25.0, 31.0, [G2, B3, D4, G4]),
    (31.0, 34.0, [A2, C4, E4, A4]),
    (34.0, 38.0, [C3, E4, G4, C5]),
]
for at, dur, freqs in CHORDS:
    pad(freqs, dur + 0.6, 0.16, at, cutoff=780)
    pad([f * 2 for f in freqs], dur + 0.4, 0.045, at, cutoff=1800)

bass_plan = [
    (5.0, 12.0, A2), (12.0, 19.0, F2), (19.0, 25.0, C3), (25.0, 31.0, G2), (31.0, 34.0, A2), (34.0, 38.0, C3),
]
for start, end, root in bass_plan:
    t = start
    k = 0
    while t < end - 0.1:
        f = root * (1.5 if k % 4 == 3 else 1.0)
        bass(f, 0.34, 0.30, t)
        t += 0.75
        k += 1

for t in np.arange(5.0, 31.0, 0.75):
    kick(0.55 if t < 25 else 0.38, t)
for t in np.arange(5.0, 31.0, 0.375):
    hat(0.10, t, 0.035)
for t in np.arange(6.5, 30.5, 3.0):
    hat(0.16, t, 0.09)

impact(0.55, 5.0)
impact(0.35, 19.0)
impact(0.40, 31.0)
riser(0.16, 3.4, 1.6)
riser(0.13, 16.6, 2.4)
riser(0.14, 29.0, 2.0)

arp([A4, C5, E5, A5, E5, C5], 5.5, 12.0, 0.375, 0.055)
arp([F4, A4, C5, F4 * 2, C5, A4], 12.5, 19.0, 0.375, 0.045, cutoff=1900)
arp([C5, E5, G4 * 2, E5, C5, G4 * 2], 19.5, 25.0, 0.25, 0.06)
arp([B4, D4 * 2, G4, B4, G4, D4 * 2], 25.5, 31.0, 0.375, 0.04, cutoff=1600)
arp([A4, C5, E5, A5], 31.5, 34.0, 0.5, 0.045)
arp([C5, E5, G4 * 2, C5], 34.0, 37.4, 0.5, 0.05)

bell(A5, 0.16, 1.2, 3.2)
bell(E5, 0.10, 2.4, 3.0)
bell(A5, 0.14, 31.6, 3.6)
bell(E5, 0.09, 32.6, 3.4)
bell(C5, 0.10, 34.2, 3.4)

for k in range(11):
    blip(880 * (1 + (k % 3) * 0.25), 0.09, 12.5 + k * 0.52, 0.2)

for k in range(6):
    blip(1320, 0.04, 28.4 + k * 0.28, 0.09)

for k in range(3):
    blip(660, 0.06, 20.2 + k * 0.16, 0.12)

ir_len = int(2.2 * SR)
ir_t = np.arange(ir_len) / SR
ir = rng.normal(0, 1, (ir_len, 2)) * np.exp(-ir_t * 2.6)[:, None]
ir = np.stack([fast_lowpass(ir[:, 0], 4200), fast_lowpass(ir[:, 1], 4200)], axis=1)
ir[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
ir /= np.max(np.abs(ir)) + 1e-9

wet = np.zeros_like(mix)
nfft = 1 << int(math.ceil(math.log2(N + ir_len)))
for ch in range(2):
    spec = np.fft.rfft(mix[:, ch], nfft) * np.fft.rfft(ir[:, ch], nfft)
    wet[:, ch] = np.fft.irfft(spec, nfft)[:N]
mix = mix * 0.82 + wet * 0.30

mix = np.tanh(mix * 1.15) * 0.92
fade_in = int(0.35 * SR)
fade_out = int(2.6 * SR)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.4

peak = np.max(np.abs(mix)) + 1e-9
mix = mix / peak * 0.89

pcm = (mix * 32767).astype(np.int16)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out', 'music.wav')
os.makedirs(os.path.dirname(out), exist_ok=True)
with wave.open(out, 'wb') as fh:
    fh.setnchannels(2)
    fh.setsampwidth(2)
    fh.setframerate(SR)
    fh.writeframes(pcm.tobytes())

print('wav', out, pcm.shape, round(os.path.getsize(out) / 1048576, 2), 'MB', 'peak', round(float(np.max(np.abs(mix))), 3))
