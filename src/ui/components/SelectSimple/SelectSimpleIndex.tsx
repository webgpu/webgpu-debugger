import React from 'react';

interface Props {
    label?: string;
    value: number;
    options: string[];
    noneOption?: string;
    onChange: (v: number) => void;

}

// Given a array of strings shows a <select> element. Value is by index.
// If you want value by string see SelectSimple
// If you need something more complicated like value/label pairs then make a new component.
export default function SelectSimpleIndex({ label = '', value, options, noneOption, onChange }: Props) {
    return (
        <label>
            {label}
            <select value={value} onChange={e => onChange(parseInt(e.target.value))}>
                {noneOption && (
                    <option key={`o-1`} value={-1}>
                        {noneOption}
                    </option>
                )}
                {options.map((option, ndx) => (
                    <option key={`o${ndx}`} value={ndx}>
                        {option}
                    </option>
                ))}
            </select>
        </label>
    );
}
