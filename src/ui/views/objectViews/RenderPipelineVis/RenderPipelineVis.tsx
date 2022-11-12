import React, { useState } from 'react';
import { ReplayRenderPipeline } from '../../../../replay';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';
import { DrawPreviewAttribLayout } from '../../../components/DrawPreviewAttribLayout/DrawPreviewAttribLayout';

export default function RenderPipelineVis({ data }: { data: ReplayRenderPipeline }) {
    const [previewOpen] = useState(false);
    return (
        <div className="spector2-vis">
            <details open={previewOpen}>
                <summary><b>Setup preview attributes</b></summary>
                <DrawPreviewAttribLayout key={data.replayObjectKey} data={data} />
            </details>
            <hr/>
            <JsonValueObject data={data} />
        </div>
    );
}
