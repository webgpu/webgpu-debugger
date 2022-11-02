import React from 'react';

interface Props {
    label: string;
    min?: number;
    max: number;
    value: number;
    step?: number;
    valueFormatFn?: (v: number) => string;
    onChange: (value: number) => void;
}

const identity = (v: number) => v.toString();

export default function Range({ label, min = 0, max, step = 1, value, valueFormatFn = identity, onChange }: Props) {
    return (
        <label>
            {label}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
            />
            {valueFormatFn(value)}
        </label>
    );
}
