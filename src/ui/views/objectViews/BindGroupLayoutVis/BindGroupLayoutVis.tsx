import React from 'react';
import { ReplayBindGroupLayout } from '../../../../replay';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';

export default function BindGroupLayoutVis({ data }: { data: ReplayBindGroupLayout }) {
    return (
        <div className="spector2-vis">
            <JsonValueObject data={data} />
        </div>
    );
}
