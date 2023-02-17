import React from 'react';
import './Overflow.css';

export default function Column({ children }: React.PropsWithChildren) {
    return <div className="wgdb-overflow">{children}</div>;
}
