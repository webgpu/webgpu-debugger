import React from 'react';
import { ReplayBindGroupLayout } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function BindGroupLayoutVis({ data }: { data: ReplayBindGroupLayout }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
