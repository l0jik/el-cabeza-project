## Luna: the moon base round the board

The game as a base on the Moon (dist/el-cabeza-luna.html): the board is a
levelled stretch of the lunar surface, its squares marked out on the dust;
each piece is a building of the base (its side's networks of inflatable
tubes joining them), the Cabeza a domed garden; a low sun, the Earth in
the sky, the hills far off. Its first build and second round are in
history/10.md (Luna, Luna round 2).

- **Files.** themes/luna.js (the theme: lights, the free camera out to the
  far craters, board and pieces for the chassis), luna-ground.js (the one
  surface from the board to the horizon: swell, craters, the board's
  contour settled round the pieces after every move), luna-sky.js,
  luna-models.js (the buildings, the people: personFig and its poses),
  luna-corridors.js (the tubes), luna-fx.js (the scene's life: ground and
  sky on the board's frame, the sun turning with the board, the props
  round the base, dust where a piece lands, the selection ring),
  luna-rover.js (the rover, below), luna-audio.js.
- **Round the base** (luna-fx.js props, all on the board's frame): a lander
  on its pad (-10.6, -2.2), a big dish (-9.6, 7.8), two rows of solar
  panels, some 60 boulders off the board, two suited walkers with their
  footprints. props() hands back where each of them stands and how big
  round (circles: rocks, the lander, the dish, the walkers and their
  prints; rects: the panel rows), for the rover to keep clear of.

### The rover drives all over (2026-11-16)

User, of a picture with the parked rover circled: "I want to see this
rover slowly driving around, and I guess occasionally a driver or a
second passenger get out and, I don't know, harvest some moon rock or
something. Have it go all over the place."

It used to stand parked at (7.4, -5.0) with tracks drawn behind it and a
walker by it. Now themes/luna-rover.js (createRover, made in luna-fx.js
buildWorld with the ground's `at`, the props' obstacles, the sun's
direction in the board's frame, the board group and the key light):

- **Where it may go.** A grid over the ground (cells of 0.25, out to 22
  from the middle). A cell is open when it's off the board (OFF_X/OFF_Z +
  1.6, plus half a cell's diagonal), nothing standing is within the
  rover's reach (0.2) plus half a cell's diagonal (0.18) of its middle,
  and the ground's not too steep or broken (slope, or a dip against the
  ground round it, under 0.3: a crater's wall). Cost: 1 + 5 x slope, and
  dearer within 3 of the board (+4 at its edge), so it doesn't circle the
  board like a track. Only the biggest joined stretch of open ground is
  ever a goal (about 9,500 cells: all round the board). With 0.4 cells and
  the same guarantee (a clearance of 0.5) the left side was cut off from
  the rest; with 0.4 cells and 0.38 it could come within 0.1 of a rock.
- **Where it goes.** One leg after another. Each plan is one search
  (Dijkstra) from just ahead of it (or from it, if ahead's shut), then a
  goal: now and then (after two plain legs, or after one at 45%; the very
  first leg, a rock 2.5-7 off) a spot 0.5-0.75 from a small rock (0.05-0.3
  round, not used before), from which the walk to it is clear; otherwise a
  hop of 4 to 11 to the sector (of eight round the middle) it has spent
  least time in, a little chance in it, not hard by the board, dearer
  behind it (so it sweeps on rather than doubling back over its tracks).
  A goal whose way is more than 1.7 x the straight line + 3 is turned down
  (the dish, the panels and a walker shut the short way on the left, and
  an 8-long hop became a 60-long drive round the board); in a corner, the
  least roundabout. The way pulled straight where the line's clear, a
  centripetal Catmull-Rom curve through it, every point checked open (else
  Chaikin on the pulled way, else Chaikin on the cells, always open).
- **Driving.** 0.16 a second (an LRV's pace at this scale), slower on the
  bends (by how much the way turns over the next 0.5), easing in and out.
  The next leg's planned 0.8 before the end; if it starts more than 0.35
  off its heading, it brakes to a stop and turns on the spot (0.6 a
  second), wheels turning opposite ways. Height and tilt from the ground
  under its four wheels, eased (0.2 s) like a suspension. Wheels turn with
  the distance (a pale hub off the middle shows it).
- **Tracks.** Two ribbons laid from its back axle every 0.04 it goes, on
  the ground (+0.006), 0.3 dark; the last 6,000 points of each kept (240
  units, about 25 minutes of driving), the oldest 600 let go when full;
  only what's new sent up, once a frame. At the start it's already on its
  way: a way from 5-9 behind it to where it stood parked, laid as tracks.
- **Dust.** Off a back wheel every 0.22 s while it's going (not on the low
  tier); puffs where the crew works the rock.
- **Its own shadow.** The sun's shadow box only covers the board and a
  little round it (half 9.5); out past it the rover and the crew cast
  nothing and seemed to float. A soft blob of their own (0.6 at most), long
  and away from the low sun (its height / tan of the sun's 18 degrees),
  tilted to the ground, faded in when the rover's outside the shadow box
  (its middle projected into the key light's shadow camera) and out when
  it's inside (the real shadow drawn there).
- **An outing.** Parked, the amber beacon on its roof blinks. 1 s, then
  one of the crew (the two take turns being first) comes out of the hatch
  at the back, walks round the rover's side (out to 0.26 from its middle
  line, never through it) to the rock's near side, kneels at it 5.5 s
  (dust puffs where they work), stands 0.7 s with a sample case, walks
  back the same way with it, and goes in at the hatch. 45% of the time the
  second comes out too (0.7 s later), stands by 0.17 to the side watching,
  and walks back first once the sample's taken. 1.2 s after the last is
  in, it drives on. Walking: the two strides in turn every 0.3 s (personFig
  "walk" and "walk2"), a low lope; carrying, the same with the case
  (o.carrying). Each pose's figure made once per crew member, a few a
  second after the start (so no frame waits on them).
- **Numbers** (an hour of its time, in the test): 40-odd legs, about 410
  driven, 13-16 outings (a third to a half of them two), every sector,
  out to 21, its middle never nearer than about 0.3 to anything standing,
  never by the board. Setup about 100 ms, the worst plan about 10-25 ms
  (SwiftShader's CPU).
- **Test hooks.** window.__LUNA_ROVER__() its state (place, phase, legs,
  stops, outings, pairs, kneels, crew poses and places, min clearance,
  board hits, sectors, speed, tracks, beacon, its own shadow, the leg log,
  plan and setup times); __LUNA_ROVER_RUN__(s) runs its time on s seconds
  at once (nothing drawn between); __LUNA_ROVER_GRID__() the open ground;
  __LUNA_ROVER_WARP__ (a number) runs its time faster as it's drawn.
- **Test.** tests/e2e-luna-rover.mjs (in run-e2e): the start (tracks
  behind it, moving, slow), an hour (coverage, clearances, height, legs,
  outings, still while they're out, plans quick, tracks capped), and one
  outing a quarter second at a time (parked and still, the beacon
  blinking, out at the hatch, both strides, round not through, kneeling
  at the rock, back with the case, in at the hatch, on its way).
- The chassis picks only pieces and move ghosts, so the rover never takes
  a tap meant for the board.
