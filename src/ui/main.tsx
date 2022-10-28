import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App/App';
import { uiStateHelper } from './contexts/UIStateContext';
import ReplayAPI from './ReplayAPI';
import DebuggerAPI from './DebuggerAPI';

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

const debuggerAPI: DebuggerAPI = {
    registerAPI(api: ReplayAPI) {
        init();
        uiStateHelper.registerAPI(api);
    },
    addReplay(replay: any) {
        uiStateHelper.addReplay(replay);
    },
    setResult(canvas: HTMLCanvasElement) {
        uiStateHelper.setResult(canvas);
    },
};

export default debuggerAPI;
