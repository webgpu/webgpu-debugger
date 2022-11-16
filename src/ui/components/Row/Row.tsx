import React from 'react';
import { classNames } from '../../lib/css';
import './Row.css';

interface Props {
    expand?: boolean;
    className?: string;
}

export default function Row({ children, className, expand }: React.PropsWithChildren<Props>) {
    return <div className={classNames('spector2-row', { 'spector2-row-expand': !!expand }, className)}>{children}</div>;
}
