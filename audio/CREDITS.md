# BLACKOUT LAB — Sound credits

The 20261112-recorded2 sound bank replaces the previous procedural voice pack
with licensed game sound effects. The original creators do not endorse this game.

## Little Robot Sound Factory — Horror Sound Effects Library

- Creator: [Little Robot Sound Factory](https://opengameart.org/users/little-robot-sound-factory)
- Creator website requested in the source attribution: http://www.littlerobotsoundfactory.com
- Original: https://opengameart.org/content/horror-sound-effects-library
- License: [Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/)
- Download: https://opengameart.org/sites/default/files/Horror%20Sound%20Library.zip

| Game file | Original WAV files | Changes for BLACKOUT LAB |
| --- | --- | --- |
| monster_growl.mp3 | Monster_00.wav | Mono conversion, subsonic filtering, gain and edge fades |
| monster_snarl.mp3 | Monster_01.wav | Mono conversion, subsonic filtering, gain and edge fades |
| monster_breath.mp3 | Breath_Scared_06.wav | 0.80 playback pitch/speed, short room reflections, gain |
| scream_a.mp3 | Scream_Male_00.wav | Short room reflections, gain and edge fades; original voice pitch |
| scream_b.mp3 | Scream_Male_01.wav | Short room reflections, gain and edge fades; original voice pitch |
| impact.mp3 | Bonecrack_00.wav | Short room reflections and gain |
| pursuit_loop.mp3 | Evil_Machine_Loop_00.wav | Mono conversion, subsonic filtering, 150 ms loop crossfade and gain |
| capture.mp3 | Monster_01.wav, Bonecrack_00.wav, Scream_Male_01.wav | Timed mix of attack, impact and scream; gain and short reflections |
| wake.mp3 | Monster_03.wav | Mono conversion, subsonic filtering, gain and edge fades |

## Thimras — Metal footsteps on concrete

- Creator: [Thimras](https://opengameart.org/users/thimras)
- Original: https://opengameart.org/content/metal-footsteps-on-concrete
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Download: https://opengameart.org/sites/default/files/metal_steps_48k24b.7z

`monster_step_a.mp3` and `monster_step_b.mp3` use `metal_steps_24.wav` and
`metal_steps_25.wav`, respectively. Changes: mono conversion, 0.86 playback
pitch/speed, subsonic filtering, short room reflections, gain and edge fades.

All outputs are encoded as 44.1 kHz, 128 kbps MP3. Original archive checksums and
per-file source mappings are in `manifest.json`; reproducible editing is in
`scripts/build_sounds.py`. Runtime distance, wall filtering and stereo direction
are applied by the game. The CC BY material remains available under CC BY 3.0;
these credits do not change its license or impose additional restrictions.
