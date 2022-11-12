import React, { useState } from 'react';
import { ReplayRenderPipeline } from '../../../replay';
import JsonValue from '../../components/JsonValue/JsonValue';
import { DrawPreviewViewer } from '../../components/DrawPreviewViewer/DrawPreviewViewer';

/* it's not clear what this is ATM. */
interface StateVisProps {
    data: any;
}

export default function StateVis({ data }: StateVisProps) {
    return (
        <div className="spector2-vis">
            <JsonValue data={data} />
            {data?.pipeline instanceof ReplayRenderPipeline &&
                <div>
                    <hr/>
                    <DrawPreviewViewer state={data} />
                </div>
            }
        </div>
    );
}
