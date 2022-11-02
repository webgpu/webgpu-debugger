import React, { useContext } from 'react';
import { UIStateContext } from '../../contexts/UIStateContext';

export default function FramesVis() {
    const { helper } = useContext(UIStateContext);

    return (
        <div className="spector2-vis">
            {helper.state.traces.map((replay, ndx) => (
                <button
                    key={`b${ndx}`}
                    onClick={() => {
                        helper.setReplay(replay);
                    }}
                >
                    replay {ndx + 1}
                </button>
            ))}
        </div>
    );
}
