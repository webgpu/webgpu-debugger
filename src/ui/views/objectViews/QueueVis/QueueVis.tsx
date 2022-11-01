import React from 'react';
import { ReplayQueue } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function QueueVis({ data }: { data: ReplayQueue }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
