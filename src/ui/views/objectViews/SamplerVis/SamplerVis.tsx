import React from 'react';
import { ReplaySampler } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function SamplerVis({ data }: { data: ReplaySampler }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
