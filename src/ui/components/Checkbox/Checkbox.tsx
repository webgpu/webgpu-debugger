import React from 'react';

interface Props {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

export default function Checkbox({ label, checked, onChange }: Props) {
    return (
        <label>
            {label}
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        </label>
    );
}
