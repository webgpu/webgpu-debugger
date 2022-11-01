import React from 'react';
import { ReplayRenderPass } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function RenderPassVis({ data }: { data: ReplayRenderPass }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
