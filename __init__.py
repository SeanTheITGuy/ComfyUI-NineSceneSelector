import hashlib
import json
import os

import numpy as np
import torch
from PIL import Image, ImageOps

import folder_paths
from comfy_extras.nodes_audio import load as decode_audio


class NineSceneSelector:
    """Select one of nine text/audio pairs and one image per three scenes."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "index": ("INT", {"default": 0, "min": 0, "max": 8, "step": 1}),
                "lines": ("STRING", {"default": "", "multiline": True, "dynamicPrompts": False}),
                "image_files": ("STRING", {"default": "[]", "multiline": False}),
                "audio_files": ("STRING", {"default": "[]", "multiline": False}),
            }
        }

    RETURN_TYPES = ("STRING", "AUDIO", "IMAGE", "FLOAT")
    RETURN_NAMES = ("text", "audio", "image", "audio_duration")
    FUNCTION = "select"
    CATEGORY = "utils/scene selection"
    DESCRIPTION = "Bulk-upload 3 images and 9 audio clips; choose text/audio n and image floor(n/3)."

    @classmethod
    def VALIDATE_INPUTS(cls, index, lines, image_files, audio_files):
        try:
            images = cls._filenames(image_files, 3, "images")
            audios = cls._filenames(audio_files, 9, "audio clips")
            for name in images + audios:
                cls._resolve(name)
            if len(lines.splitlines()) != 9:
                return "Enter exactly nine text lines (blank lines count)."
        except Exception as e:
            return str(e)
        return True

    @staticmethod
    def _filenames(raw, count, label):
        entries = json.loads(raw)
        if not isinstance(entries, list) or len(entries) != count or not all(isinstance(x, str) and x for x in entries):
            raise ValueError(f"Expected exactly {count} uploaded {label}. Use the bulk upload button.")
        return entries

    @staticmethod
    def _resolve(filename):
        # Only accept paths within ComfyUI's input directory, including upload subfolders.
        path = folder_paths.get_annotated_filepath(filename)
        root = os.path.realpath(folder_paths.get_input_directory())
        path = os.path.realpath(path)
        if os.path.commonpath([root, path]) != root:
            raise ValueError("Selected file is outside ComfyUI/input: " + filename)
        if not os.path.isfile(path):
            raise ValueError("Uploaded file not found: " + filename)
        return path

    @classmethod
    def IS_CHANGED(cls, index, lines, image_files, audio_files):
        # Respond to changes in loaded files, not just filename changes.
        h = hashlib.sha256(f"{index}\0{lines}\0{image_files}\0{audio_files}".encode()).hexdigest()
        try:
            imgs = cls._filenames(image_files, 3, "images")
            audios = cls._filenames(audio_files, 9, "audio clips")
            selected = [imgs[index // 3], audios[index]]
            metadata = tuple((p, os.stat(cls._resolve(p)).st_mtime_ns, os.stat(cls._resolve(p)).st_size) for p in selected)
            return (h, metadata)
        except Exception:
            return float("nan")

    def select(self, index, lines, image_files, audio_files):
        texts = lines.splitlines()
        if len(texts) != 9:
            raise ValueError(f"Expected exactly nine text lines; got {len(texts)}.")
        images = self._filenames(image_files, 3, "images")
        audios = self._filenames(audio_files, 9, "audio clips")
        image_path = self._resolve(images[index // 3])
        audio_path = self._resolve(audios[index])

        with Image.open(image_path) as img:
            img = ImageOps.exif_transpose(img).convert("RGB")
            image = torch.from_numpy(np.asarray(img).astype(np.float32) / 255.0)[None,]

        waveform, sample_rate = decode_audio(audio_path)
        audio = {"waveform": waveform.unsqueeze(0), "sample_rate": sample_rate}
        audio_duration = float(waveform.shape[-1] / sample_rate)
        return (texts[index], audio, image, audio_duration)


NODE_CLASS_MAPPINGS = {"NineSceneSelector": NineSceneSelector}
NODE_DISPLAY_NAME_MAPPINGS = {"NineSceneSelector": "Nine Scene Selector (Bulk Upload)"}
WEB_DIRECTORY = "./web/js"
