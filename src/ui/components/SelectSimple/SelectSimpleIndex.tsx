import React from 'react';

interface Props {
    label: string;
    value: number;
    options: string[];
    onChange: (v: number) => void;
}

// Given a array of strings shows a <select> element. Value is by index.
// If you want value by string see SelectSimple
// If you need to display a Record<string, any> see SelectSimpleKeyValue
export default function SelectSimpleIndex({ label, value, options, onChange }: Props) {
    return (
        <label>
            {label}
            <select value={value} onChange={e => onChange(parseInt(e.target.value))}>
                {options.map((option, ndx) => (
                    <option key={`o${ndx}`} value={ndx}>
                        {option}
                    </option>
                ))}
            </select>
        </label>
    );
}
