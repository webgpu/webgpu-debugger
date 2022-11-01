import React from 'react';
import { ReplayDevice } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function DeviceVis({ data }: { data: ReplayDevice }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
