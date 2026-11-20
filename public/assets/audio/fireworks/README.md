# Recorded fireworks — CC0

Sources verified 2026-11-17; these four derivatives are served locally. No third-party audio request is made by the game.

| Runtime file | Author / original | Source and license |
| --- | --- | --- |
| `launch.mp3` | Rudmer_Rotteveel, Whistle and Explosion Single_Firework, Freesound #336008. Recorded with Tascam DR-05. | https://freesound.org/people/Rudmer_Rotteveel/sounds/336008/ — explicitly CC0. Public HQ MP3 preview: https://cdn.freesound.org/previews/336/336008_4921277-hq.mp3 |
| `burst-1.mp3` | rubberduck, `fw_01.ogg` | https://opengameart.org/content/25-cc0-bang-firework-sfx — explicitly CC0 |
| `burst-2.mp3` | rubberduck, `fw_03.ogg` | Same pack |
| `burst-3.mp3` | rubberduck, `fw_04.ogg` | Same pack |

Pack URL: https://opengameart.org/sites/default/files/25-CC0-bang-sfx.zip

License: CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/ (legal text: https://creativecommons.org/publicdomain/zero/1.0/legalcode). Copying, editing and redistribution, including commercial games, are permitted. Attribution is not required; author credits are retained here. No endorsement is implied.

Preparation used for these distributed derivatives (preparation scripts are not included in this edition):. Download the archive to `qa/firework-audio/bangs.zip`, extract into `bangs/`, and save the public HQ preview as `whistle-source.mp3`. Original downloads remain outside the runtime package. Do not substitute a similarly named recording without rechecking its license.

- Launch: take 0.20–1.10 seconds before the recorded explosion; 0.90 seconds total.
- Explosions: remove leading silence, preserve 1.15/1.31/2.36-second decay tails.
- All: mono 44.1 kHz, high-pass 45 Hz, low-pass 12 kHz, peak target −4 dBFS before MP3 encoding, 3 ms fade-in / 90 ms fade-out, MP3 112 kbps. Runtime gains are lower again (launch 0.12, burst 0.40) with a shared compressor.
- Hashes, original hashes, trim parameters and byte sizes: `manifest.json`. Total audio: 84,286 bytes.

Field recordings improve the source material; final perceived loudness and balance still need listening on actual speakers and phones. These files are not licensed music and contain no imported soundtrack.
