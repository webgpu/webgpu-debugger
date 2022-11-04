import React from 'react';
import { ReplayCommandBuffer } from '../../../../replay';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';

export default function CommandBufferVis({ data }: { data: ReplayCommandBuffer }) {
    return (
        <div className="spector2-vis">
            <JsonValueObject data={data} />
        </div>
    );
}
