import React, { useState, useRef, useEffect, useCallback } from 'react';

import './DualRange.css';

interface Props {
    label: string;
    min?: number;
    max: number;
    minValue?: number;
    maxValue?: number;
    step?: number;
    valueFormatFn?: (min: number, max: number) => string;
    onChange: (min: number, max: number) => void;
}

const defaultFormat = (minV: number, maxV: number) => `${minV.toString()} - ${maxV.toString()}`;

export default function DualRange({
    label,
    min = 0,
    max,
    step = 1,
    minValue,
    maxValue,
    valueFormatFn = defaultFormat,
    onChange,
}: Props) {
    const [minVal, setMinVal] = useState(minValue ?? min);
    const [maxVal, setMaxVal] = useState(maxValue ?? max);

    const minValRef = useRef<HTMLInputElement>(null);
    const maxValRef = useRef<HTMLInputElement>(null);

    const range = useRef<HTMLDivElement>(null);

    const percent = useCallback(
        (v: number): number => {
            return Math.round(((v - min) / (max - min)) * 100);
        },
        [min, max]
    );

    useEffect(() => {
        if (maxValRef.current) {
            const minPercent = percent(minVal);
            const maxPercent = percent(+maxValRef.current.value);

            if (range.current) {
                range.current.style.left = `${minPercent}%`;
                range.current.style.width = `${maxPercent - minPercent}%`;
            }
        }
    }, [minVal, percent]);

    useEffect(() => {
        if (minValRef.current) {
            const minPercent = percent(+minValRef.current.value);
            const maxPercent = percent(maxVal);

            if (range.current) {
                range.current.style.width = `${maxPercent - minPercent}%`;
            }
        }
    }, [maxVal, percent]);

    useEffect(() => {
        onChange(minVal, maxVal);
    }, [minVal, maxVal, onChange]);

    return (
        <label className={'spector2-dualrange'}>
            <div>{label}</div>
            <div className={'spector2-dualrange-container'}>
                <input
                    ref={minValRef}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={minVal}
                    onChange={e => setMinVal(Math.min(parseFloat(e.target.value), maxVal - step))}
                    className={minVal > min ? 'spector2-dualrange-thumb raised-thumb' : 'spector2-dualrange-thumb'}
                />
                <input
                    ref={maxValRef}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={maxVal}
                    onChange={e => setMaxVal(Math.max(parseFloat(e.target.value), minVal + step))}
                    className={maxVal < max ? 'spector2-dualrange-thumb raised-thumb' : 'spector2-dualrange-thumb'}
                />
                <div className="spector2-dualrange-track" />
                <div ref={range} className="spector2-dualrange-range" />
            </div>
            <div>{valueFormatFn(minVal, maxVal)}</div>
        </label>
    );
}
