// Rebuild the local test clip: node tests/make-video-fixture.mjs.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const video = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    document.body.append(canvas);
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
    });
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.start();
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = i % 2 ? "#90baca" : "#5a9478";
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = "#fff";
      ctx.fillRect(i * 10, 80, 24, 24);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("video");
    el.muted = true;
    document.body.append(el);
    await new Promise((resolve, reject) => {
      el.onloadeddata = resolve;
      el.onerror = () => reject(new Error("Generated fixture is not playable"));
      el.src = url;
    });
    await el.play();
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (!el.currentTime) throw new Error("Fixture did not play");
    el.pause();
    URL.revokeObjectURL(url);
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await mkdir(new URL("./fixtures/", import.meta.url), { recursive: true });
  await writeFile(
    new URL("./fixtures/campus.webm", import.meta.url),
    Buffer.from(video),
  );
  console.log(`Verified local video fixture: ${video.length} bytes`);
} finally {
  await browser.close();
}
