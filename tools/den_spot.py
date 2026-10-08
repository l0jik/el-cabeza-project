#!/usr/bin/env python3
"""The den's commercial (themes/den-commercial.js): the user's three AI-made
1975 spots for El Cabeza, cut into one 30-second spot (user: "Combine them
in a creative way ... get rid of stuff as duplicate"; then "put it on the
den's TV", in place of the drawn infomercial).

    python3 tools/den_spot.py A.mp4 B.mp4 C.mp4

A is the clean take, B the glitched one (the Singularity swallows the
announcer), C is B but for frames 461-498 (a garbled copy of our flyer
where B has the sale card). All three read the same script, so each line
is heard once: A's take up to "...unparalleled intention", a tear into
B's Singularity and B's take from there (the box white, "How you
whaat?", the garbled flyer flickering into the sale card), a dissolve
home to A's family at the coffee table, A's end card ("Your move."), and
A's hidden four frames of a figure before the black hole. Two stretches
of sound silenced (user): the announcer's stutter after "How you whaat?"
("The exciting's wha-", 16.0-17.41 s), and the two bumps under the flash
at the end (29.5 s on). The den's set
is pushed into at the start (B's shot of it, through its screen into
the store). 720 frames, 24 fps, 640x480.

Writes, for build/build.js:
  assets/den/spot.mp4        H.264, no sound (most browsers, Safari)
  assets/den/spot.webm       VP9, no sound (browsers without H.264)
  assets/den/spot-sound.mp3  the sound, -16 LUFS (played through the
                             set's speaker, den-ad-audio.js)

Needs an ffmpeg with libx264, libvpx-vp9 and libmp3lame (FFMPEG=path to
use another; `pip install imageio-ffmpeg` has one). The sources aren't
kept in the repo (re-upload to re-run).
"""
import os
import re
import subprocess
import sys
import tempfile

TOOLS = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(TOOLS), "assets", "den")
FF = os.environ.get("FFMPEG", "ffmpeg")
FPS = 24
SR = 48000

# The glitches: the picture torn (a sine shear, the colours apart, snow),
# and lighter ones at the flyer's flicker.
TEAR = ("geq=lum='p(X+14*sin(Y/6+N*2.1),Y)':cb='p(X+7*sin(Y/3+N*2.1),Y)':cr='p(X+7*sin(Y/3+N*2.1),Y)',"
        "rgbashift=rh=-9:bh=9:rv=2,noise=alls=34:allf=t")
SPLIT = "rgbashift=rh=-12:bh=12:rv=3:bv=-3,noise=alls=40:allf=t,eq=brightness=0.05:contrast=1.2"
FLICK_IN = "rgbashift=rh=-8:bh=8:gv=2,noise=alls=30:allf=t"
FLICK_OUT = "rgbashift=rh=7:bh=-7:gv=-2,noise=alls=26:allf=t"
# The push through the set's screen (in B's frame: x 217-392, y 172-303),
# from local frame 27 of 61, faster and faster, to 3.9x on its middle;
# drawn on a 4x upscale so the window moves smoothly.
PUSH = ("scale=2560:1920:flags=lanczos,"
        "zoompan=z='1+2.9*pow(min(max((in-27)/33,0),1),2.4)'"
        ":x='4*(320-15.5*(zoom-1)/2.9)-iw/zoom/2':y='4*(240-2.5*(zoom-1)/2.9)-ih/zoom/2'"
        ":d=1:s=640x480:fps=24")


def ff(*args):
    subprocess.run([FF, "-v", "error", "-y", *args], check=True)


def seek(frame):
    """Seek half a frame early, so the first frame out is `frame`."""
    return f"{(frame - 0.5) / FPS:.6f}"


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    src = dict(zip("ABC", sys.argv[1:4]))
    tmp = tempfile.mkdtemp(prefix="den-spot-")
    piece = lambda name: os.path.join(tmp, name + ".nut")

    def cut(name, s, first, count, vf=None):
        f = "fps=24,format=yuv420p" + (f",{vf},format=yuv420p" if vf else "")
        ff("-ss", seek(first), "-i", src[s], "-an", "-vf", f, "-frames:v", str(count), "-c:v", "ffv1", piece(name))

    def dissolve(name, a, b, frames):
        # (setpts before fps: setpts forgets the frame rate xfade needs.)
        ff("-i", piece(a), "-i", piece(b), "-filter_complex",
           "[0:v]setpts=PTS-STARTPTS,fps=24[a];[1:v]setpts=PTS-STARTPTS,fps=24[b];"
           f"[a][b]xfade=transition=fade:duration={frames / FPS}:offset=0,format=yuv420p",
           "-frames:v", str(frames), "-c:v", "ffv1", piece(name))

    # The picture: (piece, from, first frame, frames), in order.
    cut("01", "A", 0, 41)                                   # the den, a board on the table: "Tired of chess?"
    ff("-ss", seek(6), "-i", src["B"], "-an", "-vf",       # the set: pushed into, through its screen
       f"fps=24,format=yuv420p,trim=end_frame=59,tpad=stop_mode=clone:stop=2,{PUSH},format=yuv420p",
       "-frames:v", "61", "-c:v", "ffv1", piece("02all"))
    ff("-i", piece("02all"), "-vf", "trim=end_frame=55,setpts=PTS-STARTPTS", "-c:v", "ffv1", piece("02"))
    ff("-i", piece("02all"), "-vf", "trim=start_frame=55,setpts=PTS-STARTPTS", "-c:v", "ffv1", piece("02b"))
    cut("03a", "A", 96, 6)
    dissolve("03", "02b", "03a", 6)                         # ...into the store
    cut("04", "A", 102, 90)                                 # the family and the box
    cut("05", "A", 192, 107)                                # the hand, a walnut piece
    cut("06", "A", 299, 3, TEAR)                            # the picture tears...
    cut("07", "B", 253, 3, SPLIT)                           # ...into the Singularity
    cut("08", "B", 256, 205)                                # B's take: the white box, the board, father and son, the son
    cut("09", "C", 461, 2, FLICK_IN)                        # the flyer, garbled (C's)...
    cut("10", "C", 463, 10)
    cut("11", "B", 473, 2, FLICK_OUT)                       # ...and corrected: the sale card
    cut("12", "B", 475, 61)                                 # the card, the walnut piece, Big Glutts
    cut("13a", "B", 536, 9)
    cut("13b", "A", 504, 9)
    dissolve("13", "13a", "13b", 9)                         # home
    cut("14", "A", 513, 78)                                 # the family at the coffee table; the end card, "Your move."
    card = os.path.join(tmp, "card.png")
    ff("-ss", seek(590), "-i", src["A"], "-an", "-frames:v", "1", card)
    ff("-loop", "1", "-framerate", "24", "-i", card, "-vf", "format=yuv420p", "-frames:v", "39", "-c:v", "ffv1", piece("15"))  # held
    cut("16", "A", 591, 9)                                  # the flash, and black
    order = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16"]
    lst = os.path.join(tmp, "list.txt")
    with open(lst, "w") as f:
        f.writelines(f"file '{piece(n)}'\n" for n in order)
    video = os.path.join(tmp, "video.nut")
    ff("-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", video)

    # The sound, each piece placed to the sample (output time T): A's take
    # to T 12.583 s; B's from its Singularity (1.5 dB down, to A's voice);
    # A's home and end card, crossfaded in over the dissolve; the held card
    # silent; A's flash. Then to -16 LUFS, limited to -1 dB.
    mix = os.path.join(tmp, "mix.wav")
    ff("-i", src["A"], "-i", src["B"], "-filter_complex",
       "[0:a]aresample=48000,atrim=start_sample=0:end_sample=604000,asetpts=PTS-STARTPTS,afade=t=out:st=12.573:d=0.01[a1];"
       "[1:a]aresample=48000,atrim=start_sample=506000:end_sample=1090000,asetpts=PTS-STARTPTS,volume=-1.5dB,"
       "afade=t=in:d=0.01,afade=t=out:st=11.791667:d=0.375,adelay=delays=604000S:all=1[a2];"
       "[0:a]aresample=48000,atrim=start_sample=1008000:end_sample=1182000,asetpts=PTS-STARTPTS,"
       "afade=t=in:d=0.375,afade=t=out:st=3.575:d=0.05,adelay=delays=1170000S:all=1[a3];"
       "[0:a]aresample=48000,atrim=start_sample=1182000:end_sample=1200000,asetpts=PTS-STARTPTS,"
       "afade=t=in:d=0.005,adelay=delays=1422000S:all=1[a4];"
       "[a1][a2][a3][a4]amix=inputs=4:normalize=0:duration=longest,apad=whole_len=1440000,atrim=end_sample=1440000[mix]",
       "-map", "[mix]", "-c:a", "pcm_s24le", mix)
    r = subprocess.run([FF, "-hide_banner", "-nostats", "-i", mix, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True)
    loud = float(re.findall(r"^\s+I:\s+(-?[0-9.]+) LUFS", r.stderr, re.M)[-1])
    sound = os.path.join(tmp, "sound.wav")
    ff("-i", mix, "-af", f"volume={-16 - loud:.2f}dB,alimiter=limit=0.891:attack=5:release=60:level=disabled:latency=1", "-c:a", "pcm_s24le", sound)
    # Silenced, after the level's set, so the rest is as it was (user:
    # "16.0 through 17.3, I need you to drop out the audio"; the word runs
    # on to 17.4, a click at its end, so to the gap before "That's
    # clever", 17.41; and "two little bumps" at the very end, the flash's
    # sound, from 29.5). 10 ms ramps, inside the stretches.
    edited = os.path.join(tmp, "sound-edited.wav")
    ff("-i", sound, "-af", "aeval=exprs='val(ch)*(1-clip((t-16)/0.01,0,1)+clip((t-17.41)/0.01,0,1))*(1-clip((t-29.5)/0.01,0,1))':c=same",
       "-c:a", "pcm_s24le", edited)

    # The files. (setpts=N/24: the concat demuxer gives pieces made by
    # xfade, trim and loop a frame short, so their first frames would
    # collide with the frames before and be dropped.)
    os.makedirs(OUT, exist_ok=True)
    even = "setpts=N/(24*TB)"
    ff("-i", video, "-vf", even, "-r", "24", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-profile:v", "high",
       "-pix_fmt", "yuv420p", "-tune", "film", "-movflags", "+faststart", os.path.join(OUT, "spot.mp4"))
    ff("-i", video, "-vf", even, "-r", "24", "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "33", "-row-mt", "1",
       "-deadline", "good", "-cpu-used", "2", os.path.join(OUT, "spot.webm"))
    ff("-i", edited, "-c:a", "libmp3lame", "-b:a", "192k", os.path.join(OUT, "spot-sound.mp3"))
    for n in ("spot.mp4", "spot.webm", "spot-sound.mp3"):
        p = os.path.join(OUT, n)
        print("wrote", p, os.path.getsize(p), "bytes")
    print(f"(the mix was {loud:.1f} LUFS, now -16)")


if __name__ == "__main__":
    main()
