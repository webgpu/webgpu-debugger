import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App/App';
import { uiState } from './contexts/UIStateContext';
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
    root.render(<App uiState={uiState} />);
}

const debuggerAPI: DebuggerAPI = {
    registerAPI(api: ReplayAPI) {
        init();
        uiState.registerAPI(api);
    },
    addReplay(replay: any) {
        uiState.addReplay(replay);
    },
    setResult(canvas: HTMLCanvasElement) {
        uiState.setResult(canvas);
    },
};

export default debuggerAPI;
