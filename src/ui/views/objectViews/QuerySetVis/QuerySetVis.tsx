import React from 'react';
import { ReplayQuerySet } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function QuerySetVis({ data }: { data: ReplayQuerySet }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
