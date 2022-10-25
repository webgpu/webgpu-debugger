import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App/App';
import { uiState, ReplayAPI } from './contexts/UIStateContext';

function init() {
    const elem = document.createElement('div');
    document.body.appendChild(elem);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const root = ReactDOM.createRoot(elem);
    root.render(<App uiState={uiState} />);
}

function addReplay(replay: any) {
    uiState.addReplay(replay);
}

// This should change but for now....
function setResult(canvas: HTMLCanvasElement) {
    uiState.setResult(canvas);
}

function registerAPI(api: ReplayAPI) {
    uiState.registerAPI(api);
}

export default {
    init,
    addReplay,
    setResult,
    registerAPI,
};
