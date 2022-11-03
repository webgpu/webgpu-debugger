import React from 'react';

interface Props {
    value: number;
    options: string[];
    onChange: (v: number) => void;
}

// Given a array of strings shows a <select> element. Value is by index.
// If you want value by string see SelectSimple
// If you need something more complicated like value/label pairs then make a new component.
export default function SelectSimpleIndex({ value, options, onChange }: Props) {
    return (
        <select value={value} onChange={e => onChange(parseInt(e.target.value))}>
            {options.map((option, ndx) => (
                <option key={`o${ndx}`} value={ndx}>
                    {option}
                </option>
            ))}
        </select>
    );
}
