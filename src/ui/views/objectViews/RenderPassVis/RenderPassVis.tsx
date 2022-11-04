import React from 'react';
import { ReplayRenderPass } from '../../../../replay';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';

export default function RenderPassVis({ data }: { data: ReplayRenderPass }) {
    return (
        <div className="spector2-vis">
            <JsonValueObject data={data} />
        </div>
    );
}
