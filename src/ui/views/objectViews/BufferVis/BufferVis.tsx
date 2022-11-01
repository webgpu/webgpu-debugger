import React from 'react';
import { ReplayBuffer } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function BufferVis({ data }: { data: ReplayBuffer }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
