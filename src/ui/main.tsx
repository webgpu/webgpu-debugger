import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App/App';
import { uiStateHelper } from './contexts/UIStateContext';
import { spector2 as capture } from '../capture';

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

export async function captureFrame() {
    const trace = await capture.traceFrame();
    uiStateHelper.addTrace(trace);
}

export function startCapture() {
    if (capture.tracing) {
        throw new Error('already tracing');
    }
    capture.startTracing();
}

export async function endCapture() {
    if (!capture.tracing) {
        throw new Error('not tracing');
    }
    const trace = capture.endTracing();
    uiStateHelper.addTrace(trace);
}

init();
uiStateHelper.registerAPI({
    playTo(replay, id) {
        // TBD: reply the given 'replay' to the specified id
        console.log(replay, id);
    },
    startCapture,
    endCapture,
    captureFrame,
});
