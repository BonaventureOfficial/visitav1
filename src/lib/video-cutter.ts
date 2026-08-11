type ProgressCallback = (progress: number) => void;

let activeFfmpeg: import("@ffmpeg/ffmpeg").FFmpeg | null = null;

export function cancelVideoCut() {
  activeFfmpeg?.terminate();
  activeFfmpeg = null;
}

export async function cutVideoSmoothly(
  videoUrl: string,
  from: number,
  to: number,
  onProgress: ProgressCallback,
): Promise<Blob> {
  const [{ FFmpeg }, { fetchFile }, coreModule, wasmModule] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
    import("@ffmpeg/core?url"),
    import("@ffmpeg/core/wasm?url"),
  ]);

  const ffmpeg = new FFmpeg();
  activeFfmpeg = ffmpeg;
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress(Math.min(99, Math.max(0, Math.round(progress * 100))));
  };
  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.load({
      coreURL: coreModule.default,
      wasmURL: wasmModule.default,
    });

    onProgress(2);
    await ffmpeg.writeFile("source.mp4", await fetchFile(videoUrl));
    const length = Math.max(1, to - from);

    // Réencoder la plage reconstruit des horodatages et des images réguliers.
    // Contrairement à MediaRecorder, la vitesse du téléphone n'influence donc
    // jamais la vitesse de lecture du fichier final.
    const result = await ffmpeg.exec([
      "-ss",
      from.toFixed(3),
      "-i",
      "source.mp4",
      "-t",
      length.toFixed(3),
      "-vf",
      "setpts=PTS-STARTPTS",
      "-af",
      "asetpts=PTS-STARTPTS",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      "selection.mp4",
    ]);
    if (result !== 0) throw new Error("La découpe vidéo a échoué");

    const output = await ffmpeg.readFile("selection.mp4");
    if (typeof output === "string") throw new Error("Fichier vidéo invalide");
    onProgress(100);
    return new Blob([output.slice().buffer], { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", progressHandler);
    ffmpeg.terminate();
    if (activeFfmpeg === ffmpeg) activeFfmpeg = null;
  }
}