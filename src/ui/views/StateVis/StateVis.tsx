import React, { useState } from 'react';
import { ReplayRenderPipeline } from '../../../replay';
import JsonValue from '../../components/JsonValue/JsonValue';
import { RenderPipelinePreviewLayoutVis } from '../../components/RenderPipelinePreviewLayoutVis/RenderPipelinePreviewLayoutVis';

/* it's not clear what this is ATM. */
interface StateVisProps {
    data: any;
}

export default function StateVis({ data }: StateVisProps) {
    const [previewOpen] = useState(false);

    return (
        <div className="spector2-vis">
            {data?.pipeline instanceof ReplayRenderPipeline &&
                <div>
                    <details open={previewOpen}>
                        <summary><b>Render pipeline preview attributes</b></summary>
                        <RenderPipelinePreviewLayoutVis key={data.pipeline.replayObjectKey} data={data.pipeline.previewLayout} />
                    </details>
                    <hr/>
                </div>
            }
            <JsonValue data={data} />
        </div>
    );
}
