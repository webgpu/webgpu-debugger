import React from 'react';
import { ReplayCommandBuffer } from '../../../../replay';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';

export default function CommandBufferVis({ data }: { data: ReplayCommandBuffer }) {
    return (
        <div className="wgdb-vis">
            <JsonValueObject data={data} />
        </div>
    );
}
