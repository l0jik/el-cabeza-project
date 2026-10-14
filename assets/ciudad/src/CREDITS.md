# The City's recordings

The sources of the City's recorded sound (the city at each hour), and what
`tools/ciudad_sounds.py` makes of each (and `tools/ciudad_honks.py`, of
the horns). Freesound.org itself was out of reach when the first of them
were gathered, so those came by way of two open-source projects that carry
them, each with its source and licence (the New York gridlock and horns,
the last rows, came later straight from freesound.org's previews):

- the [Scaper](https://github.com/justinsalamon/scaper) library's test
  sounds (`tests/data/audio/background/`, the file named by its Freesound
  id; re-encoded here from their WAV to Ogg Vorbis, quality 8; the
  `_trimmed` ones are Scaper's first minute of the longer recording);
- the [Blanket](https://github.com/rafaelmardojai/blanket) app's sounds
  (`data/resources/sounds/`, its `SOUNDS_LICENSING.md`; some edited for it
  by Porrumentzio to loop).

Each licence checked on the recording's own page (the soundbible.com ones
as Blanket gives them). The game credits them on the About card
(themes/ciudad.js `soundCredits`).

| File | Sound | By | Licence | Via | Used for |
| --- | --- | --- | --- | --- | --- |
| city-park-tel-aviv-yonts-268903.ogg | [city park Tel Aviv Israel.wav](https://freesound.org/people/yonts/sounds/268903/) | yonts | CC0 1.0 | Scaper | the morning's park (its first 46 s) and the park at night |
| street-scene-3-saphe-173955.ogg | [street scene 3](https://freesound.org/people/saphe/sounds/173955/) (a busy street in Szczecin, walked down) | saphe | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Scaper (its first minute) | the afternoon's busy street; the golden hour's traffic. Credit required: on the About card |
| street-scene-1-saphe-150993.ogg | [street scene 1](https://freesound.org/people/saphe/sounds/150993/) (two men at work, cars, then a tram) | saphe | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Scaper | the overcast hour's street at work. Credit required: on the About card |
| high-street-of-gandia-jormarp-207208.ogg | [High Street of Gandia (Valencia, Spain)](https://freesound.org/people/jormarp/sounds/207208/) (about 7 pm, people walking and talking) | jormarp | CC0 1.0 | Scaper (its first minute) | the golden hour's high street; people under the afternoon |
| nyc-street-level-gezortenplotz-44796.ogg | [NYC_street leve02l.wav](https://freesound.org/people/gezortenplotz/sounds/44796/) (street level in New York) | gezortenplotz | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Blanket ("City", edited by Porrumentzio) | the traffic: far off in the morning and at night, nearer in the afternoon. Credit required: on the About card |
| wood-thrush-morning-kvgarlic-156826.ogg | [Wood Thrush in Morning, Shawnee Forest](https://freesound.org/people/kvgarlic/sounds/156826/) (7:30 am) | kvgarlic | CC0 1.0 | Blanket ("Birds", edited by Porrumentzio) | birdsong in the trees in the morning, and far off at the golden hour |
| wind-in-a-field-felix-blume-217506.ogg | [Wind blowing in a field in Texas, USA](https://freesound.org/people/felix.blume/sounds/217506/) | felix.blume | CC0 1.0 | Blanket ("Wind", edited by Porrumentzio) | the overcast hour's wind |
| crickets-at-night-lisa-redfern.ogg | [Crickets Chirping At Night](https://soundbible.com/2083-Crickets-Chirping-At-Night.html) | Lisa Redfern | Public domain | Blanket ("Summer night") | crickets in the park at 10 PM |
| restaurant-ambiance-stephan.ogg | [Restaurant Ambiance](https://soundbible.com/1664-Restaurant-Ambiance.html) | stephan | Public domain | Blanket ("Coffee Shop") | a restaurant still open at 10 PM |
| city-distant-hotel-window-trp-715663.ogg | [130516 City distant extended streetscape, hotel window, horns](https://freesound.org/s/715663/) | TRP | CC0 1.0 | freesound.org (its high-quality preview) | the gridlock under every hour, far off (`tools/ciudad_sounds.py` GRIDLOCK) |
| traffic-horns-engines-trp-616589.ogg | [120616 Traffic, horns, engines, reverse beeps, truck, NYC](https://freesound.org/s/616589/) | TRP | CC0 1.0 | freesound.org | honks from the street (`tools/ciudad_honks.py`) |
| w41st-8th-ave-eyesplice-759088.ogg | [New York City W 41 St. at 8th Ave](https://freesound.org/s/759088/) | eyesplice | CC0 1.0 | freesound.org | honks from the street, before its siren |
| many-car-horns-traffic-jam-craigsmith-675208.ogg | [S07-17 Many car horns in traffic jam](https://freesound.org/s/675208/) | craigsmith | CC0 1.0 | freesound.org | a gridlock's chorus now and then |
| honking-horns-in-traffic-jasonlee3071-865956.ogg | [Honking horns in traffic](https://freesound.org/s/865956/) | jasonlee3071 | CC0 1.0 | freesound.org | single honks |
| horn-irritated-driver-wanaki-569613.ogg | [Car Horn_Irritated driver stuck in traffic](https://freesound.org/s/569613/) | wanaki | CC0 1.0 | freesound.org | a driver leaning on it |
| car-horn-honk-devern-349922.ogg | [Car Horn Honk](https://freesound.org/s/349922/) | DeVern | CC0 1.0 | freesound.org | single honks |
| car-horn-distant-brooklyn-brett-butter-553150.ogg | [Car Horn Honk 01 - Single, Distant - EXT Day Brooklyn Street](https://freesound.org/s/553150/) | Brett+Butter | CC0 1.0 | freesound.org | a honk far off |
| double-car-horn-mudflea2-705723.ogg | [Double car horn](https://freesound.org/s/705723/) | mudflea2 | CC0 1.0 | freesound.org | a double honk |
| car-horn-keweldog-182474.ogg | [car horn](https://freesound.org/s/182474/) | keweldog | CC0 1.0 | freesound.org | single honks |
| car-horn-legnalegna55-545015.ogg | [Car Horn sound](https://freesound.org/s/545015/) | Legnalegna55 | CC0 1.0 | freesound.org | single honks |
