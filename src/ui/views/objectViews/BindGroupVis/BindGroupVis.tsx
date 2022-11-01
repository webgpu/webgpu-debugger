import React from 'react';
import { ReplayBindGroup } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function BindGroupVis({ data }: { data: ReplayBindGroup }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
