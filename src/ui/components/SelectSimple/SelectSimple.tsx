import React from 'react';

interface SelectSimpleProps {
    value: string;
    options: string[];
    onChange: (v: string) => void;
}

// Given a array of strings shows a <select> element. Returns one of the strings onChange
// If you want value by index see SelectSimpleIndex
// If you need something more complicated like value/label pairs then make a new component.
export default function SelectSimple({ value, options, onChange }: SelectSimpleProps) {
    return (
        <select value={value} onChange={e => onChange(e.target.value)}>
            {options.map((option, ndx) => (
                <option key={`o${ndx}`} value={option}>
                    {option}
                </option>
            ))}
        </select>
    );
}
