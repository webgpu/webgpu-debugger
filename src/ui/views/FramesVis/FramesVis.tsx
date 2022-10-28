import React, { useContext } from 'react';
import { UIStateContext } from '../../contexts/UIStateContext';

export default function FramesVis() {
    const { helper } = useContext(UIStateContext);

    return (
        <div className="spector2-viz">
            {helper.state.replays.map((replay, ndx) => (
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
