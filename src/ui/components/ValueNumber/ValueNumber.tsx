import React from 'react';

import './ValueNumber.css';

const identity = (v: number) => v.toString();

export default function ValueNumber({ data, format = identity }: { data: number; format?: (v: number) => string }) {
    return Number.isNaN(data) ? (
        <div className="wgdb-value-nan">NaN</div>
    ) : Number.isFinite(data) ? (
        <div className="wgdb-value-number">{format(data)}</div>
    ) : (
        <div className="wgdb-value-inf">{data}</div>
    );
}
