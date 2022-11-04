import React from 'react';

import './ValueNumber.css';

const identity = (v: number) => v.toString();

export default function ValueNumber({ data, format = identity }: { data: number; format?: (v: number) => string }) {
    return Number.isNaN(data) ? (
        <div className="spector2-value-nan">NaN</div>
    ) : Number.isFinite(data) ? (
        <div className="spector2-value-number">{format(data)}</div>
    ) : (
        <div className="spector2-value-inf">{data}</div>
    );
}
