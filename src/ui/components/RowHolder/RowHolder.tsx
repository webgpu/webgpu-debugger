import React from 'react';
import { classNames } from '../../lib/css';
import './RowHolder.css';

interface Props {
    className?: string;
}

export default function RowHolder({ className, children }: React.PropsWithChildren<Props>) {
    return <div className={classNames('spector2-row-holder', className)}>{children}</div>;
}
