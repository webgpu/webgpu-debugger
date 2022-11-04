import React, { useState } from 'react';
import { Replay } from '../../../../replay';
import Value from '../../../components/Value/Value';

import './ReplayVis.css';

// A ReplayVis visualized a Replay object which is the object
// that contains references to all other object so effectively
// this is a "list of resources" view.

// Wasn't sure if this should list the fields we want to see or
// show all the fields and have an exclusion list.

const s_propertyNames = [
    'adapters',
    'bindGroupLayouts',
    'bindGroups',
    'buffers',
    'commandBuffers',
    'devices',
    'pipelineLayouts',
    'querySets',
    'queues',
    'renderPipelines',
    'samplers',
    'shaderModules',
    'textures',
    'textureViews',
];

type ObjectKey = keyof Replay;

export default function ReplayVis({ data }: { data: Replay }) {
    const [open, setOpen] = useState(new Array(s_propertyNames.length).fill(false));
    const [allOpen, setAllOpen] = useState(true);

    const setOpenNdx = (ndx: number, opened: boolean) => {
        const newOpen = [...open];
        newOpen[ndx] = opened;
        setOpen(newOpen);
    };

    const toggleAll = () => {
        const newOpen = [...open].fill(allOpen);
        setOpen(newOpen);
        setAllOpen(!allOpen);
    };

    return (
        <div className="spector2-vis">
            <div className="spector2-replay-vis">
                <div>
                    <button onClick={toggleAll}>Toggle all open/closed</button>
                </div>
                {s_propertyNames.map((name, nameNdx) => {
                    const key = name as ObjectKey;
                    const resources: Record<string, any> = data[key];

                    return (
                        <details
                            open={open[nameNdx]}
                            className="spector2-replay-group"
                            key={`n${nameNdx}`}
                            onToggle={e => {
                                e.stopPropagation();
                                setOpenNdx(nameNdx, (e.target as HTMLDetailsElement).open);
                            }}
                        >
                            <summary className="spector2-replay-heading">
                                {name} ({Object.values(resources).length})
                            </summary>
                            <div className="spector2-replay-resources">
                                {Object.values(resources).map((resource, ndx) => (
                                    <Value key={`r${ndx}`} data={resource} />
                                ))}
                            </div>
                        </details>
                    );
                })}
            </div>
        </div>
    );
}
