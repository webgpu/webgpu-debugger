import React from 'react';
import { ReplayQueue } from '../../../../replay';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';

export default function QueueVis({ data }: { data: ReplayQueue }) {
    return (
        <div className="wgdb-vis">
            <JsonValueObject data={data} />
        </div>
    );
}
