import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

function naturalSort(files) {
    return Array.from(files).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
}

function chooseFiles(accept) {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
        let finished = false;
        const finish = (files) => {
            if (finished) return;
            finished = true;
            input.remove();
            resolve(files);
        };
        input.addEventListener("change", () => finish(Array.from(input.files || [])), { once: true });
        // Cancel event is supported in modern browsers.
        input.addEventListener("cancel", () => finish([]), { once: true });
        input.click();
    });
}

async function uploadFile(file, folder, batchId, position) {
    // Keep each upload independent, even if two batches contain the same filenames.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const renamed = new File([file], `${batchId}_${String(position + 1).padStart(2, "0")}_${safeName}`, {
        type: file.type || "application/octet-stream"
    });
    const data = new FormData();
    data.append("image", renamed); // ComfyUI's generic upload endpoint uses this field for audio too.
    data.append("type", "input");
    data.append("subfolder", folder);
    data.append("overwrite", "false");
    const response = await api.fetchApi("/upload/image", { method: "POST", body: data });
    if (!response.ok) throw new Error(`Upload failed: ${file.name} (HTTP ${response.status})`);
    const saved = await response.json();
    if (!saved.name) throw new Error(`Missing uploaded filename for ${file.name}`);
    return [saved.subfolder, saved.name].filter(Boolean).join("/");
}

function hideStorageWidget(widget) {
    if (!widget) return;
    widget.type = "hidden";
    widget.computeSize = () => [0, -4];
}

app.registerExtension({
    name: "nine.scene.selector.bulk_upload",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "NineSceneSelector") return;
        const original = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function (...args) {
            const result = original?.apply(this, args);
            const imageStore = this.widgets?.find(w => w.name === "image_files");
            const audioStore = this.widgets?.find(w => w.name === "audio_files");
            hideStorageWidget(imageStore);
            hideStorageWidget(audioStore);
            const node = this;

            function addBulkButton(kind, count, accept, store) {
                const button = node.addWidget("button", `Upload ${count} ${kind}`, null, async () => {
                    const files = naturalSort(await chooseFiles(accept));
                    if (!files.length) return;
                    if (files.length !== count) {
                        alert(`Choose exactly ${count} ${kind}. You selected ${files.length}.`);
                        return;
                    }
                    button.name = `Uploading ${kind} (0/${count})...`;
                    node.setDirtyCanvas(true, true);
                    const batchId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
                    try {
                        const paths = [];
                        for (const [i, file] of files.entries()) {
                            paths.push(await uploadFile(file, "nine_scene_selector", batchId, i));
                            button.name = `Uploading ${kind} (${i + 1}/${count})...`;
                            node.setDirtyCanvas(true, true);
                        }
                        // Commit only once all files have uploaded successfully.
                        store.value = JSON.stringify(paths);
                        if (typeof store.callback === "function") store.callback(store.value);
                        button.name = `${kind}: ${count}/${count} loaded`;
                        node.setDirtyCanvas(true, true);
                    } catch (e) {
                        console.error(e);
                        alert(`Could not upload ${kind}: ${e.message}`);
                        button.name = `Upload ${count} ${kind}`;
                    }
                });
                button.serialize = false;
                return button;
            }
            if (imageStore) addBulkButton("images", 3, "image/*,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff", imageStore);
            if (audioStore) addBulkButton("audio", 9, "audio/*,.wav,.mp3,.flac,.ogg,.opus,.m4a,.aac", audioStore);
            node.setSize([Math.max(node.size[0], 380), Math.max(node.size[1], 340)]);
            return result;
        };
    }
});
