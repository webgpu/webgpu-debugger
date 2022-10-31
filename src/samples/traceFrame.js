import { spector2, requestUnwrappedAdapter, requestUnwrappedWebGPUContext } from '/dist/capture.js';
import { loadReplay } from '/dist/replay.js';

export default function traceFrame() {
    spector2.traceFrame().then(async trace => {
        // Trace the frame and set up the replay.
        console.log(trace);
        const replay = await loadReplay(trace, requestUnwrappedAdapter);
        console.log(replay);

        // Go through each command, and show the presented texture of the trace on the capture canvas.
        const captureCanvas = document.getElementById('captureCanvas');
        const context = requestUnwrappedWebGPUContext(captureCanvas);

        for (const c of replay.commands) {
            replay.execute(c);

            if (c.name === 'present') {
                const textureState = c.args.texture;
                const device = textureState.device.webgpuObject;

                captureCanvas.width = textureState.size.width;
                captureCanvas.height = textureState.size.height;
                context.configure({
                    device,
                    usage: GPUTextureUsage.COPY_DST,
                    format: textureState.format,
                    alphaMode: 'opaque',
                });

                const encoder = device.createCommandEncoder();
                encoder.copyTextureToTexture(
                    { texture: textureState.webgpuObject },
                    { texture: context.getCurrentTexture() },
                    textureState.size
                );
                device.queue.submit([encoder.finish()]);
            }
        }
    });
}
