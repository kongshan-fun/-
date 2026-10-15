# V14 one-time source transfer

These seven binary chunks concatenate to one XZ-compressed authored-source delta. Run `python tools/apply_v14.py` once on the V13.1 baseline. It verifies base Git blob hashes, a pinned payload SHA-256 and all final SHA-256 values before writing any source. After the installed marker is present it never reapplies the delta over future edits.

The validation workflow tests the unpacked current V14 sources, not historical HTML files. Only after every test passes may a one-time, branch-scoped job materialize the same verified sources on `feat/v14-races-talents`. This does not merge or change main, deploy the game, or require the chunks at game runtime. Source files are committed as normal UTF-8 files for subsequent edits.
