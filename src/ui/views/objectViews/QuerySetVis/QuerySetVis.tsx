import React from 'react';
import { ReplayQuerySet } from '../../../../replay';
import { JsonValueObject } from '../../../components/JsonValue/JsonValue';

export default function QuerySetVis({ data }: { data: ReplayQuerySet }) {
    return (
        <div className="wgdb-vis">
            <JsonValueObject data={data} />
        </div>
    );
}
