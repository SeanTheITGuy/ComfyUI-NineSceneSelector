# Nine Scene Selector for ComfyUI

One node that holds nine text lines, three images, and nine audio files. It outputs the `index`-th text and audio, image `floor(index/3)`, and the selected audio duration in seconds as a `FLOAT`.

| index | text | audio | image |
|---|---|---|---|
| 0–2 | lines 1–3 | clips 1–3 | image 1 |
| 3–5 | lines 4–6 | clips 4–6 | image 2 |
| 6–8 | lines 7–9 | clips 7–9 | image 3 |

## Install

1. Extract the directory `ComfyUI-NineSceneSelector` into `ComfyUI/custom_nodes/`.
2. Restart ComfyUI; hard-refresh the browser if the buttons do not appear.
3. Add **Nine Scene Selector (Bulk Upload)** under **utils / scene selection**.
4. Enter **exactly nine lines** in the multiline `lines` widget (blank lines are allowed).
5. Click **Upload 3 images**, multi-select exactly three images in *one* file-picker operation.
6. Click **Upload 9 audio**, multi-select exactly nine audio files in *one* file-picker operation.
7. Set `index` to 0–8 and connect `text`, `audio`, `image`, and `audio_duration` outputs.

**Order is natural filename order**, not the order in which you Ctrl-click the files. Name them `image_01.png` etc. and `audio_01.wav` etc. for reliable pairing. Images are grouped in sets of three, so image 1 serves indexes 0, 1, 2.

Files are copied to `ComfyUI/input/nine_scene_selector/` and their references are saved in the workflow. Reopening the saved workflow should not require uploading again as long as those files remain in place. Re-uploading a group replaces that group's selection without affecting the other group.

The `audio_duration` output is the decoded number of audio samples divided by the sample rate (seconds).

Uses the standard ComfyUI `AUDIO` dictionary (`waveform`, `sample_rate`) and standard `IMAGE` tensor format. There are no third-party dependencies beyond those supplied by recent ComfyUI builds.

## Notes

- The index **selects** a scene. It does not automatically increment between queues; setting the index is deliberate.
- File picker allows multiple selection in one dialog, but the browser sends the files to ComfyUI sequentially to show progress and keep its normal upload API.
- Do not delete the files from the `input/nine_scene_selector/` folder while workflows still refer to them.
- This is a source implementation, not tested against your particular ComfyUI frontend version.
