import React from 'react';

interface Props {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const Checkbox: React.FC<Props> = ({ label, checked, onChange }) => {
    return (
        <label>
            {label}
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        </label>
    );
};

export default Checkbox;
