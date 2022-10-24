import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App/App';
import { uiState, UIStateContext } from './contexts/UIStateContext';

function init() {
  const elem = document.createElement('div');
  document.body.appendChild(elem);
  // @ts-ignore
  const root = ReactDOM.createRoot(elem);
  root.render(
    <UIStateContext.Provider value={uiState}>
      <App/>
    </UIStateContext.Provider>
  );
};

function addReplay(replay: any) {
  uiState.addReplay(replay);
}

// This should change but for now....
function setResult(canvas: HTMLCanvasElement) {
  uiState.setResult(canvas);
}

export default {
  init,
  addReplay,
  setResult,
};
