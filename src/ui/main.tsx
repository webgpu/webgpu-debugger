import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App/App';
import { uiStateHelper } from './contexts/UIStateContext';
import { spector2 as capture } from '../capture';
import { loadReplay, Replay } from '../replay';

let initialized = false;

function init() {
    if (initialized) {
        return;
    }
    initialized = true;
    const elem = document.createElement('div');
    document.body.appendChild(elem);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const root = ReactDOM.createRoot(elem);
    root.render(<App uiStateHelper={uiStateHelper} />);
}

init();
uiStateHelper.registerAPI({
    playTo(replay, id) {
        // TBD: reply the given 'replay' to the specified id
        console.log(replay, id);
    },
    startCapture() {
        // TBD: Capture until stop capture is called
    },
    endCapture() {
        // TBD: Stop Capturing
    },
    async captureFrame() {
        const trace = await capture.traceFrame();
        // Trace the frame and set up the replay.
        console.log(trace);
        capture.revertEntryPoints();
        const replay = await loadReplay(trace);
        console.log(replay);

        function getLastElementAndPushIndex(arr: any[], path: number[]) {
            const lastNdx = arr.length - 1;
            path.push(lastNdx);
            return arr[lastNdx];
        }

        function getPathForLastStep(replay: Replay) {
            const path: number[] = [];
            const lastCmd = getLastElementAndPushIndex(replay.commands, path);
            if (lastCmd.name === 'queueSubmit') {
                const lastCB = getLastElementAndPushIndex(lastCmd.args.commandBuffers, path);
                const lastCBCmd = getLastElementAndPushIndex(lastCB.commands, path);
                if (lastCBCmd.name === 'renderPass') {
                    getLastElementAndPushIndex(lastCBCmd.renderPass.commands, path);
                }
            }
            return path;
        }

        uiStateHelper.addReplay(replay);

        const pathForLastStep = getPathForLastStep(replay);
        console.log('path:', pathForLastStep);

        //const state = await replay.replayTo(pathForLastStep);
        //console.log(state);

        // Go through each command, and show the presented texture of the trace on the capture canvas.
        const captureCanvas = document.createElement('canvas');
        const context = captureCanvas.getContext('webgpu')!;

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
                // TODO: should probably have this generate
                // an imagebitmap and pass in that instead?
                uiStateHelper.setResult(captureCanvas);
            }
        }

        capture.wrapEntryPoints();
    },
});
