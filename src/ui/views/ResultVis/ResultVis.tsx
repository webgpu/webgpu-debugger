import React, { useRef, useEffect } from 'react';

import './ResultVis.css';

type ResultsVisProps = {
    data: HTMLCanvasElement;
};

const draw = (ctx: CanvasRenderingContext2D, srcCanvas: HTMLCanvasElement) => {
    if (srcCanvas) {
        ctx.canvas.width = srcCanvas.width;
        ctx.canvas.height = srcCanvas.height;
        ctx.drawImage(srcCanvas, 0, 0);
    } else {
        const { width, height } = ctx.canvas;
        ctx.clearRect(0, 0, width, height);
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'white';
        ctx.strokeText('no result', width / 2, height / 2);
        ctx.fillText('no result', width / 2, height / 2);
    }
};

const ResultVis = ({ data }: ResultsVisProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        //Our draw come here
        draw(context, data);
    }, [draw]);

    return (
        <div className="spector2-viz">
            <canvas ref={canvasRef} />
        </div>
    );
};

export default ResultVis;
