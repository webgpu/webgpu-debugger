import React from 'react';
import { ReplayDevice } from '../../../../replay';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';

export default function DeviceVis({ data }: { data: ReplayDevice }) {
    return (
        <div className="wgdb-vis">
            <JsonValueObject data={data} />
        </div>
    );
}
