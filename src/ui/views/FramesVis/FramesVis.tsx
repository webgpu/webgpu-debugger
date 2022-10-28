import React, { useContext } from 'react';
import { UIStateContext } from '../../contexts/UIStateContext';

export default function FramesVis() {
    const uiState = useContext(UIStateContext);

    return (
        <div className="spector2-viz">
            {uiState.replays.map((replay, ndx) => (
                <button
                    key={`b${ndx}`}
                    onClick={() => {
                        uiState.setReplay(replay);
                    }}
                >
                    replay {ndx + 1}
                </button>
            ))}
        </div>
    );
}
