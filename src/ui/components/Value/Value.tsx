/* eslint-disable @typescript-eslint/ban-types */
import React from 'react';
import { isBaseObject, isExcludedPropertyName } from '../../lib/object-utils';
import { getComponentForReplayClass, getSpecialPropertiesForClass, ValueComponent } from '../VisValue/VisValue';
import ValueNumber from '../ValueNumber/ValueNumber';

import './Value.css';
import { isTypedArray } from '../../lib/typedarray-utils';

/*
function PlaceHolder({ data }: { data: any }) {
    return <div>placeholder{`<${Object.getPrototypeOf(data).constructor.name}>`}</div>;
}
*/

function ValueProperty({ component, depth, data }: { component?: ValueComponent; depth: number; data: any }) {
    return component ? React.createElement(component, { data }) : <Value depth={depth} data={data} />;
}

export function ValueObject({ depth, data }: { depth?: number; data: Record<string, any> }) {
    const childDepth = (depth || 0) + 1;
    const ctor = Object.getPrototypeOf(data).constructor;
    const specialProperties = getSpecialPropertiesForClass(ctor);
    return (
        <table className={`wgdb-value-object wgdb-value-depth${depth}`}>
            <tbody>
                {Object.entries(data).map(([key, value], ndx) =>
                    isExcludedPropertyName(key) ? (
                        <React.Fragment key={`p${ndx}`} />
                    ) : (
                        <tr className="wgdb-value-key-value" key={`p${ndx}`}>
                            <td key={`k${ndx}`} className="wgdb-value-key">
                                {key}:
                            </td>
                            <td>
                                <ValueProperty
                                    component={specialProperties[key]}
                                    key={`v${ndx}`}
                                    depth={childDepth}
                                    data={value}
                                />
                            </td>
                        </tr>
                    )
                )}
            </tbody>
        </table>
    );
}

// 0 - 4 values (should be 0-8?)
function ValueSmallArray({ depth, data }: { depth?: number; data: any[] }) {
    const childDepth = (depth || 0) + 1;
    // convert typedarray to array so map works.
    const arr = Array.isArray(data) ? data : Array.from(data);
    return (
        <table className={`wgdb-value-array wgdb-value-depth${depth}`}>
            <tbody>
                <tr>
                    {arr.map((v, ndx) => (
                        <td key={`e${ndx}`}>
                            <Value depth={childDepth} data={v} />
                        </td>
                    ))}
                </tr>
            </tbody>
        </table>
    );
}

// 4 or more values
function ValueLargeArray({ depth, data }: { depth?: number; data: any[] }) {
    const childDepth = (depth || 0) + 1;
    // convert typedarray to array so map works.
    const arr = Array.isArray(data) ? data : Array.from(data);
    return (
        <table className={`wgdb-value-array wgdb-value-depth${depth}`}>
            <tbody>
                {arr.map((v, ndx) => (
                    <tr key={`e${ndx}`}>
                        <td>{ndx}</td>
                        <td>
                            <Value depth={childDepth} data={v} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function ValueArray({ depth, data }: { depth?: number; data: any[] }) {
    return data.length <= 4 ? (
        <ValueSmallArray data={data} depth={depth} />
    ) : (
        <ValueLargeArray data={data} depth={depth} />
    );
}

export default function Value({ depth, data }: { depth?: number; data: any }) {
    if (data === undefined) {
        return <div className="wgdb-value-undefined">undefined</div>;
    } else if (data === null) {
        return <div className="wgdb-value-null">null</div>;
    } else if (typeof data === 'boolean') {
        return <div className="wgdb-value-boolean">{data ? 'true' : 'false'}</div>;
    } else if (typeof data === 'number') {
        return <ValueNumber data={data} />;
    } else if (typeof data === 'string') {
        return <div className="wgdb-value-string">&quot;{data}&quot;</div>;
    } else if (Array.isArray(data) || isTypedArray(data)) {
        return <ValueArray depth={depth} data={data} />;
    } else if (typeof data === 'function') {
        return <div className="wgdb-value-function">{data.name}</div>;
    } else if (typeof data === 'object') {
        if (isBaseObject(data)) {
            return <ValueObject depth={depth} data={data} />;
        } else {
            const proto = Object.getPrototypeOf(data);
            const component = getComponentForReplayClass(proto.constructor);
            if (component) {
                return React.createElement(component, { data });
            }
            return <div>unsupported type: {proto.constructor.name}</div>;
        }
    } else {
        return <div>--unsupported-type--</div>;
    }
}
