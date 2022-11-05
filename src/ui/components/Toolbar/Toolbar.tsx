import React, { useContext, useRef } from 'react';
import { UIStateContext } from '../../contexts/UIStateContext';

import './Toolbar.css';

const saveData = (function () {
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    return function saveData(blob: Blob, filename: string) {
        const url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        a.click();
    };
})();

export default function Toolbar() {
    const { helper } = useContext(UIStateContext);
    const inputRef = useRef<HTMLInputElement>(null);

    const loadTrace = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const files = evt.target.files;
        if (files && files.length) {
            const file = files[0];
            helper.addTraceFile(file);
        }
    };

    const requestFile = () => {
        inputRef.current!.click();
    };

    const saveTrace = () => {
        const { trace, name } = helper.state.traces[helper.state.currentTraceIndex];
        const filename = name.endsWith('.json') ? name : `${name}.json`;
        saveData(trace, filename);
    };

    return (
        <div className="spector2-toolbar">
            <div className="spector2-toolbar-left">
                <button onClick={helper.capture}>🔴</button>
                <button onClick={requestFile}>Load</button>
                <button onClick={saveTrace}>Save</button>
                <button onClick={helper.toggleUI}>⌃</button>
            </div>
            <div className="spector2-toolbar-right">
                {/*<button onClick={() => helper.setShowSettings(true)}>⚙️</button>*/}
                <a href="https://github.com/Kangz/spector2" target="_blank" rel="noreferrer">
                    🐞
                </a>
            </div>
            <input
                type="file"
                ref={inputRef}
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={loadTrace}
            />
        </div>
    );
}
