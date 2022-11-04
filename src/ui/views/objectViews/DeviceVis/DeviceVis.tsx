import React from 'react';
import { ReplayDevice } from '../../../../replay';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';

export default function DeviceVis({ data }: { data: ReplayDevice }) {
    return (
        <div className="spector2-vis">
            <JsonValueObject data={data} />
        </div>
    );
}
