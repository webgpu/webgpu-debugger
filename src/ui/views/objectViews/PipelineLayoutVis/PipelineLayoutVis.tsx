import React from 'react';
import { ReplayPipelineLayout } from '../../../../replay';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';

export default function PipelineLayoutVis({ data }: { data: ReplayPipelineLayout }) {
    return (
        <div className="spector2-vis">
            <JsonValueObject data={data} />
        </div>
    );
}
