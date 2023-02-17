import React, { useContext } from 'react';
import { UIStateContext } from '../../contexts/UIStateContext';

export default function FramesVis() {
    const { helper } = useContext(UIStateContext);

    return (
        <div className="wgdb-vis">
            {helper.state.traces.map((trace, ndx) => (
                <button
                    key={`b${ndx}`}
                    onClick={() => {
                        helper.replayTrace(trace);
                    }}
                >
                    replay {ndx + 1}
                </button>
            ))}
        </div>
    );
}
