import React from 'react';
import { ReplayRenderPipeline } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function RenderPipelineVis({ data }: { data: ReplayRenderPipeline }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
