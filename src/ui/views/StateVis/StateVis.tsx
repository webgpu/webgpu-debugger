import React from 'react';
import JsonValue from '../../components/JsonValue/JsonValue';

/* it's not clear what this is ATM. */
interface StateVisProps {
    data: any;
}

export default function StateVis({ data }: StateVisProps) {
    return (
        <div className="wgdb-vis">
            <JsonValue data={data} />
        </div>
    );
}
