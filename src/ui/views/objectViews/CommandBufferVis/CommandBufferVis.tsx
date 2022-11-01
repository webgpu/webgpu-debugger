import React from 'react';
import { ReplayCommandBuffer } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function CommandBufferVis({ data }: { data: ReplayCommandBuffer }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
