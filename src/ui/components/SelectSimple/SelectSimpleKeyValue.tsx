import React from 'react';

interface Props {
    label: string;
    value: string;
    options: Record<string, any>;
    valueToString?: (v: any) => string;
    onChange: (v: string) => void;
}

const identity = (v: string) => v;

// Given an Record<string, any> shows a <select> element. Value is by string (key)
// If you just have an array of strings see SelectSimple
// If you want value to be an index see SelectSimpleIndex
export default function SelectSimpleKeyValue({ label, value, options, onChange, valueToString = identity }: Props) {
    return (
        <label>
            {label}
            <select value={value} onChange={e => onChange(e.target.value)}>
                {Object.entries(options).map(([key, value], ndx) => (
                    <option key={`o${ndx}`} value={key}>
                        {valueToString(value)}
                    </option>
                ))}
            </select>
        </label>
    );
}
