import React, { useState, useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { ReplayBuffer } from '../../../../replay';
import { ValueNumber, ValueObject } from '../../../components/Value/Value';
import { roundUpToMultipleOf } from '../../../lib/math-utils';

import './BufferVis.css';

interface SelectSimpleProps {
    value: string;
    options: string[];
    onChange: (v: string) => void;
}

function SelectSimple({ value, options, onChange }: SelectSimpleProps) {
    return (
        <select value={value} onChange={e => onChange(e.target.value)}>
            {options.map((option, ndx) => (
                <option key={`o${ndx}`} value={option}>
                    {option}
                </option>
            ))}
        </select>
    );
}

type TypedArrayConstructor =
    | Int8ArrayConstructor
    | Uint8ArrayConstructor
    | Int16ArrayConstructor
    | Uint16ArrayConstructor
    | Int32ArrayConstructor
    | Uint32ArrayConstructor
    | Float32ArrayConstructor
    | Float64ArrayConstructor;

type TypedArrayInfo = {
    // eslint-disable-next-line @typescript-eslint/ban-types
    View: TypedArrayConstructor;
    minWidth: number;
    format: (v: number) => string;
};

const positiveHexFormatter = (padding: number) => {
    return (v: number) => v.toString(16).padStart(padding, '0');
};
const negativeHexFormatter = (SrcType: TypedArrayConstructor, DstType: TypedArrayConstructor, padding: number) => {
    const src = new SrcType(1);
    const dst = new DstType(src.buffer);

    return (v: number) => {
        src[0] = v;
        return dst[0].toString(16).padStart(padding, '0');
    };
};

// prettier-ignore
const s_types: Record<string, TypedArrayInfo> = {
    i8:  { View: Int8Array,    minWidth:  34, format: negativeHexFormatter(Int8Array, Uint8Array, 2) },
    u8:  { View: Uint8Array,   minWidth:  34, format: positiveHexFormatter(2) },
    i16: { View: Int16Array,   minWidth:  48, format: negativeHexFormatter(Int16Array, Uint16Array, 4) },
    u16: { View: Uint16Array,  minWidth:  48, format: positiveHexFormatter(4) },
    i32: { View: Int32Array,   minWidth:  80, format: negativeHexFormatter(Int32Array, Uint32Array, 8) },
    u32: { View: Uint32Array,  minWidth:  80, format: positiveHexFormatter(8) },
    f64: { View: Float64Array, minWidth: 100, format: (v: number) => v.toString() },
    f32: { View: Float32Array, minWidth: 100, format: (v: number) => v.toString() },
};
const s_typesKeys = [...Object.keys(s_types)];

interface Props {
    type: string;
    columns: number;
    buffer: ReplayBuffer;
    hex: boolean;
}

const BufferGrid: React.FC<Props> = ({ type, columns, hex, buffer }) => {
    const [arrayBuffer, setArrayBuffer] = useState(new ArrayBuffer(0));

    // TODO: Virtualize this so we don't need the entire buffers?
    const getBufferData = async (replayBuffer: ReplayBuffer) => {
        const device = replayBuffer.device.webgpuObject!;

        const dstBuffer = device.createBuffer({
            size: replayBuffer.size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // Copy buffer to something we can read
        const srcBuffer = replayBuffer.webgpuObject;
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(srcBuffer, 0, dstBuffer, 0, replayBuffer.size);
        device.queue.submit([commandEncoder.finish()]);

        // Copy data from buffer
        await dstBuffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = dstBuffer.getMappedRange();
        const copy = arrayBuffer.slice(0);
        dstBuffer.unmap();

        setArrayBuffer(copy);
    };

    // TODO: Handle non-mappable buffers?
    useEffect(() => {
        getBufferData(buffer);
    }, [buffer]);

    const { View, minWidth, format } = s_types[type];
    const view = new View(arrayBuffer);
    const numValues = view.length;
    const rows = roundUpToMultipleOf(numValues, columns) / columns;

    // fill the view with consecutive values for debugging.
    // view.forEach((v, ndx) => (view[ndx] = ndx % 2 ? -ndx : ndx));

    const formatFn = hex ? format : (v: number) => v.toString();

    /*  size 10  columns = 4

        cell indices       data indices
    ------------------------------------
     0,  1,  2,  3,  4,    ?  ?  ?  ?  ?
     5,  6,  7,  8,  9,    ?  0  1  2  3
    10, 11, 12, 13, 14,    ?  4  5  6  7
    15, 16, 17, 18, 19,    ?  8  9  .  .
    */

    const viewColumns = columns + 1;
    const viewRows = rows + 1;
    const lastViewColumn = (numValues % columns) + 1;
    const lastViewRow = numValues / columns + 1;

    // If the size is small, try not to cause a scrollbar
    const widthFudge = 10;
    return (
        <AutoSizer>
            {({ width, height }) => (
                <Grid
                    columnCount={viewColumns}
                    columnWidth={Math.max(minWidth, ((width - widthFudge) / viewColumns) | 0)}
                    height={height}
                    rowCount={viewRows}
                    rowHeight={16}
                    width={width}
                >
                    {({ columnIndex, rowIndex, style }) => {
                        const dataIndex = (rowIndex - 1) * columns + columnIndex - 1;
                        const byteOffset = dataIndex * view.BYTES_PER_ELEMENT;

                        return (
                            <div
                                className={`spector2-buffer-data-elem ${
                                    columnIndex === 0
                                        ? 'spector2-buffer-data-offset'
                                        : rowIndex === 0
                                        ? 'spector2-buffer-data-headings'
                                        : ''
                                }`}
                                style={style}
                                title={`index: ${dataIndex} (0x${dataIndex.toString(
                                    16
                                )}) byteOffset: ${byteOffset} (0x${byteOffset.toString(16)})`}
                            >
                                {rowIndex === 0 ? (
                                    <div className="spector2-grid-header">
                                        {columnIndex === 0 ? 'offset' : columnIndex - 1}
                                    </div>
                                ) : columnIndex === 0 ? (
                                    `0x${((rowIndex - 1) * columns).toString(16)}`
                                ) : rowIndex >= lastViewRow && columnIndex >= lastViewColumn ? (
                                    <div className="spector2-buffer-data-empty">.</div>
                                ) : (
                                    <ValueNumber format={formatFn} data={view[dataIndex]} />
                                )}
                            </div>
                        );
                    }}
                </Grid>
            )}
        </AutoSizer>
    );
};

export default function BufferVis({ data }: { data: ReplayBuffer }) {
    const [type, setType] = useState('f32');
    const [columns, setColumns] = useState(4);
    const [hex, setHex] = useState(false);

    return (
        <div className="spector2-vis">
            <div className="spector2-buffer-vis">
                <ValueObject data={data} />
                <div>
                    <SelectSimple value={type} options={s_typesKeys} onChange={setType} />
                    <input
                        type="range"
                        min="1"
                        max="64"
                        value={columns}
                        onChange={e => setColumns(parseInt(e.target.value))}
                    />
                    <input type="checkbox" checked={hex} onChange={e => setHex(e.target.checked)} />
                </div>
                <div className="spector2-buffer-data">
                    <BufferGrid type={type} columns={columns} hex={hex} buffer={data} />
                </div>
            </div>
        </div>
    );
}
