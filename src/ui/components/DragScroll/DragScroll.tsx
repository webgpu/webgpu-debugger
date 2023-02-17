import React, { useEffect, useRef } from 'react';
import { getRelativeMousePosition } from '../../lib/event-utils';

import './DragScroll.css';

const DragScroll: React.FC<React.PropsWithChildren> = ({ children }) => {
    const elemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const elem = elemRef.current!;

        let mouseStartX = 0;
        let mouseStartY = 0;
        let scrollStartX = 0;
        let scrollStartY = 0;

        const handleMouseMove = (e: MouseEvent) => {
            const { x, y } = getRelativeMousePosition(elem, e);
            const dx = mouseStartX - x;
            const dy = mouseStartY - y;
            elem.scrollLeft = scrollStartX + dx;
            elem.scrollTop = scrollStartY + dy;
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        const handleMouseDown = (e: MouseEvent) => {
            const { x, y } = getRelativeMousePosition(elem, e);
            mouseStartX = x;
            mouseStartY = y;
            scrollStartX = elem.scrollLeft;
            scrollStartY = elem.scrollTop;
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        };

        elem.addEventListener('mousedown', handleMouseDown);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            elem.removeEventListener('mousedown', handleMouseDown);
        };
    });

    return (
        <div className="wgdb-drag-scroll" ref={elemRef}>
            {children}
        </div>
    );
};

export default DragScroll;
