import React from 'react';
import { ReplayPipelineLayout } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function PipelineLayoutVis({ data }: { data: ReplayPipelineLayout }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
