import React from 'react';
import { ReplayRenderPipeline } from '../../../../replay';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';

export default function RenderPipelineVis({ data }: { data: ReplayRenderPipeline }) {
    return (
        <div className="wgdb-vis">
            <JsonValueObject data={data} />
        </div>
    );
}
