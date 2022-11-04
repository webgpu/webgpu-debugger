/* eslint-disable @typescript-eslint/ban-types */
import React from 'react';
import { isBaseObject, isExcludedPropertyName } from '../../lib/object-utils';
import { getComponentForReplayClass, getSpecialPropertiesForClass, ValueComponent } from '../VisValue/VisValue';
import ValueNumber from '../ValueNumber/ValueNumber';

import './Value.css';

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
        <table className={`spector2-value-object spector2-value-depth${depth}`}>
            <tbody>
                {Object.entries(data).map(([key, value], ndx) =>
                    isExcludedPropertyName(key) ? (
                        <React.Fragment key={`p${ndx}`} />
                    ) : (
                        <tr className="spector2-value-key-value" key={`p${ndx}`}>
                            <td key={`k${ndx}`} className="spector2-value-key">
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

function ValueArray({ depth, data }: { depth?: number; data: any[] }) {
    const childDepth = (depth || 0) + 1;
    return (
        <table className={`spector2-value-array spector2-value-depth${depth}`}>
            <tbody>
                {data.map((v, ndx) => (
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

export default function Value({ depth, data }: { depth?: number; data: any }) {
    if (data === undefined) {
        return <div className="spector2-value-undefined">undefined</div>;
    } else if (data === null) {
        return <div className="spector2-value-null">null</div>;
    } else if (typeof data === 'boolean') {
        return <div className="spector2-value-boolean">{data ? 'true' : 'false'}</div>;
    } else if (typeof data === 'number') {
        return <ValueNumber data={data} />;
    } else if (typeof data === 'string') {
        return <div className="spector2-value-string">&quot;{data}&quot;</div>;
    } else if (Array.isArray(data)) {
        return <ValueArray depth={depth} data={data} />;
    } else if (typeof data === 'function') {
        return <div className="spector2-value-function">{data.name}</div>;
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
