import React from 'react';
import './Overflow.css';

export default function Column({ children }: React.PropsWithChildren) {
    return <div className="spector2-overflow">{children}</div>;
}
